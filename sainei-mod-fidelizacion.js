(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'fidelizacion',label:'Fidelización',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  api.addAction('fidelizacion-configurar',function(){
   var s=api.state();s.loyalty=s.loyalty||{gsPerPoint:10000,enabled:true};
   api.openModal('<h2>Configurar puntos</h2><p class="muted">Definí cuántos guaraníes equivalen a un punto. El cálculo usa ventas válidas y descuenta devoluciones registradas.</p><label>Gs. por punto<input id="loyalty-rate" class="input" type="number" min="1" step="1" value="'+Math.max(1,Number(s.loyalty.gsPerPoint)||10000)+'"></label><p id="loyalty-error" class="err" role="alert"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="fidelizacion-guardar">Guardar</button></div>');
  });
  api.addAction('fidelizacion-guardar',function(){
   var s=api.state(),el=document.getElementById('loyalty-rate'),err=document.getElementById('loyalty-error'),rate=Math.floor(Number(el&&el.value));
   if(!Number.isSafeInteger(rate)||rate<1){if(err)err.textContent='Ingresá un monto válido mayor que cero.';return;}
   s.loyalty=s.loyalty||{};s.loyalty.gsPerPoint=rate;s.loyalty.enabled=true;
   Promise.resolve(api.save()).then(function(ok){if(ok===false){if(err)err.textContent='El servidor no confirmó el cambio.';return;}api.closeModal();api.refresh();api.toast('Regla de puntos guardada.');}).catch(function(){if(err)err.textContent='No se pudo guardar. Revisá la conexión.';});
  });
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function render(sec){
   var s=api.state(),cfg=s.loyalty||{gsPerPoint:10000},rate=Math.max(1,Number(cfg.gsPerPoint)||10000),sales=s.sales||[],returns=s.returns||s.devoluciones||[],clients=s.clients||[];
   var valid=sales.filter(function(x){return !x.void&&Number(x.clientId)>0;});
   var rows=clients.map(function(c){
    var cs=valid.filter(function(x){return Number(x.clientId)===Number(c.id);});
    var gross=cs.reduce(function(a,x){return a+Math.max(0,Number(x.total)||0);},0);
    var refunded=cs.reduce(function(a,x){return a+(x.returns||[]).reduce(function(t,r){return t+Math.max(0,Number(r.amount)||0);},0);},0);
    var net=Math.max(0,gross-refunded),points=Math.floor(net/rate);
    return {c:c,gross:gross,refunded:refunded,net:net,points:points,count:cs.length};
   }).filter(function(x){return x.count>0;}).sort(function(a,b){return b.points-a.points||b.net-a.net;});
   var total=rows.reduce(function(a,x){return a+x.points;},0),volume=rows.reduce(function(a,x){return a+x.net;},0);
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div class="sec-head"><h2>Fidelización de clientes</h2><button class="btn" data-a="fidelizacion-configurar">Configurar regla</button></div><p class="muted">Acumulación informativa: '+money(rate)+' en compras netas = 1 punto. No se canjean puntos automáticamente ni se altera el precio de las ventas.</p><div class="tiles">'+tile('Clientes participantes',String(rows.length))+tile('Puntos calculados',String(total))+tile('Compras netas',money(volume))+'</div><p class="hint">Los puntos se recalculan desde el historial de ventas asociado a cada cliente. Las ventas anuladas no suman. Verificá que las devoluciones estén registradas correctamente.</p></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Cliente</th><th>Teléfono</th><th class="r">Ventas</th><th class="r">Compras netas</th><th class="r">Puntos</th></tr></thead><tbody>'+(rows.length?rows.map(function(x){return '<tr><td>'+esc(x.c.name)+'</td><td>'+esc(x.c.phone||'—')+'</td><td class="r">'+x.count+'</td><td class="r">'+money(x.net)+'</td><td class="r"><strong>'+x.points+'</strong></td></tr>';}).join(''):'<tr><td colspan="5">Todavía no hay ventas asociadas a clientes.</td></tr>')+'</tbody></table><button class="btn" data-a="fidelizacion-csv">Exportar CSV</button></div>';
  }
  api.addAction('fidelizacion-csv',function(){
   var s=api.state(),cfg=s.loyalty||{gsPerPoint:10000},rate=Math.max(1,Number(cfg.gsPerPoint)||10000),sales=s.sales||[],clients=s.clients||[],rows=clients.map(function(c){var a=sales.filter(function(x){return !x.void&&Number(x.clientId)===Number(c.id);}),net=a.reduce(function(t,x){return t+Math.max(0,Number(x.total)||0);},0);return [c.name||'',c.phone||'',a.length,Math.round(net),Math.floor(net/rate)];}).filter(function(x){return x[2]>0;});
   var csv=[['Cliente','Telefono','Ventas','Compras Gs','Puntos']].concat(rows).map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
   var url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='sainei-fidelizacion.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
  function tile(label,value){return '<div class="tile"><div class="muted">'+esc(label)+'</div><strong class="num">'+esc(value)+'</strong></div>';}
 }
});
})();