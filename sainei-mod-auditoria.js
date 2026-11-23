(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'auditoria',label:'Auditoría',canView:function(u){return !!u&&u.role==='admin';},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function date(v){var d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleString('es-PY');}
  function render(sec){
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2>Auditoría del sistema</h2><p class="muted">Registro de acciones realizadas por los usuarios.</p></div><button class="btn" data-a="auditoria-refresh">Actualizar</button></div><p class="muted" id="auditoria-status">Cargando actividad…</p><div class="panel scroll"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th></tr></thead><tbody id="auditoria-rows"><tr><td colspan="3">Cargando…</td></tr></tbody></table></div></div>';
   load(sec);
  }
  function load(sec){
   var status=sec.querySelector('#auditoria-status'),body=sec.querySelector('#auditoria-rows');
   if(!status||!body)return;
   status.textContent='Cargando actividad…';
   api.request('GET','/api/audit?limit=500').then(function(r){
    if(!sec.isConnected)return;
    var rows=Array.isArray(r.rows)?r.rows:[];
    body.innerHTML=rows.length?rows.map(function(x){return '<tr><td>'+esc(date(x.t))+'</td><td>'+esc(x.u)+'</td><td>'+esc(x.a)+'</td></tr>';}).join(''):'<tr><td colspan="3">Todavía no hay actividad registrada.</td></tr>';
    status.textContent=rows.length+' registros recientes';
   }).catch(function(e){if(!sec.isConnected)return;status.textContent=e.message||'No se pudo cargar la auditoría.';body.innerHTML='<tr><td colspan="3">No se pudo consultar el registro.</td></tr>';});
  }
  api.addAction('auditoria-refresh',function(){var sec=document.querySelector('#v-auditoria');if(sec)load(sec);});
 }
});
})();