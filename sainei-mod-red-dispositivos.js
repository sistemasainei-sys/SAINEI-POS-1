(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({init:function(api){
 api.addTab({id:'red-dispositivos',label:'Red y dispositivos',canView:function(u){return !!u&&u.role==='admin';},render:render});
 function esc(v){return api.escape(v==null?'':String(v));}
 function fmt(t){var d=new Date(t);return isNaN(d.getTime())?'—':d.toLocaleString('es-PY');}
 function device(ua){ua=String(ua||'');if(/iPhone|iPad/i.test(ua))return 'iPhone / iPad · Safari';if(/Android/i.test(ua))return 'Android';if(/Windows/i.test(ua))return 'Windows';if(/Macintosh/i.test(ua))return 'Mac';return 'Navegador / dispositivo';}
 function render(sec){
  sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h2>Red y dispositivos</h2><p class="muted">Estado de la red local y equipos que se conectaron recientemente.</p></div><span id="red-state" class="pill tag">Consultando…</span></div><div id="red-content"><p class="muted">Cargando información del servidor…</p></div><p class="muted" style="font-size:12px">La detección se basa en solicitudes recientes al servidor. Los equipos inactivos desaparecen de la lista después de 2 minutos; el historial temporal se conserva hasta 30 minutos.</p></div>';
  load(sec);
 }
 function load(sec){
  var box=sec.querySelector('#red-content'),badge=sec.querySelector('#red-state');
  if(!api.isServer()){badge.textContent='Solo servidor local';box.innerHTML='<p>La información de red está disponible en el equipo que ejecuta el servidor SAINEI POS.</p>';return;}
  api.request('GET','/api/network/status').then(function(r){
   if(!sec.isConnected)return;
   badge.className='pill ok';badge.textContent='Servidor activo';
   var urls=(r.addresses||[]).map(function(ip){return 'http://'+ip+':'+r.port;});
   var clients=r.clients||[];
   box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:12px 0"><div class="panel" style="padding:14px"><small class="muted">IP DEL SERVIDOR</small><div style="font-size:25px;font-weight:800;overflow-wrap:anywhere">'+(urls.length?esc((r.addresses||[]).join(' · ')):'No detectada')+'</div><small class="muted">Puerto '+esc(r.port)+'</small></div><div class="panel" style="padding:14px"><small class="muted">DISPOSITIVOS RECIENTES</small><div style="font-size:28px;font-weight:800">'+clients.length+'</div></div><div class="panel" style="padding:14px"><small class="muted">BASE DE DATOS</small><div style="font-size:20px;font-weight:800;color:var(--ok)">'+(r.database?'Disponible':'No encontrada')+'</div></div><div class="panel" style="padding:14px"><small class="muted">SESIONES ABIERTAS</small><div style="font-size:28px;font-weight:800">'+esc(r.activeSessions)+'</div></div></div>'+
   '<div class="panel" style="padding:14px;margin:12px 0"><h3>Direcciones para conectar</h3>'+(urls.length?urls.map(function(u){return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0"><code style="overflow-wrap:anywhere">'+esc(u)+'</code><button class="btn" data-a="red-copy" data-url="'+esc(u)+'">Copiar</button></div>';}).join(''):'<p class="muted">No se encontraron direcciones IPv4 locales.</p>')+'</div>'+
   '<div class="panel scroll" style="padding:14px;margin:12px 0"><h3>Dispositivos detectados</h3><table><thead><tr><th>IP</th><th>Equipo / navegador</th><th>Usuario</th><th>Estado</th><th>Última actividad</th></tr></thead><tbody>'+(clients.length?clients.map(function(c){return '<tr><td>'+esc(c.ip)+'</td><td>'+esc(device(c.ua))+'</td><td>'+esc(c.name)+(c.authenticated?' · '+esc(c.role):' · sin iniciar sesión')+'</td><td><span class="pill ok">Activo</span></td><td>'+esc(fmt(c.lastSeen))+'</td></tr>';}).join(''):'<tr><td colspan="5" class="muted">Todavía no hay otros dispositivos detectados. Abrí SAINEI POS desde otra PC o celular conectado al mismo Wi-Fi.</td></tr>')+'</tbody></table></div>'+
   '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" data-a="red-refresh">Actualizar ahora</button><small class="muted">Actualizado: '+esc(fmt(r.updatedAt))+'</small></div>';
  }).catch(function(e){if(!sec.isConnected)return;badge.className='pill low';badge.textContent='Sin conexión';box.innerHTML='<p>'+esc(e.message||'No se pudo consultar el estado de red.')+'</p><button class="btn" data-a="red-refresh">Reintentar</button>';});
 }
 api.addAction('red-refresh',function(){var sec=document.querySelector('#v-red-dispositivos');if(sec)load(sec);});
 api.addAction('red-copy',function(el){var u=el&&el.getAttribute('data-url');if(!u)return;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){api.toast('Dirección copiada');}).catch(function(){api.toast('Mantené presionada la dirección para copiarla');});else api.toast('Mantené presionada la dirección para copiarla');});
}});
})();