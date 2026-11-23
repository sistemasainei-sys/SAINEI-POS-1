(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'arqueos-xz',label:'Arqueos X/Z',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function summary(s,sh){
   var by={efectivo:0,tarjeta:0,transferencia:0,credito:0},cobros=0,gastos=0,pagos=0;
   (s.sales||[]).forEach(function(x){if(x.shiftId===sh.id&&!x.void)by[x.method]=(by[x.method]||0)+Number(x.total||0);});
   (s.payments||[]).forEach(function(x){if(x.shiftId===sh.id&&x.method==='efectivo')cobros+=Number(x.amount||0);});
   (s.expenses||[]).forEach(function(x){if(x.shiftId===sh.id&&x.method==='caja')gastos+=Number(x.amount||0);});
   (s.spay||[]).forEach(function(x){if(x.shiftId===sh.id&&x.method==='caja')pagos+=Number(x.amount||0);});
   return {by:by,cobros:cobros,gastos:gastos,pagos:pagos,expected:Number(sh.openAmt||0)+by.efectivo+cobros-gastos-pagos};
  }
  function render(sec){
   var s=api.state();if(!s)return;
   var shifts=(s.shifts||[]).slice().sort(function(a,b){return new Date(b.openAt)-new Date(a.openAt);});
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Arqueos de caja X / Z</h2><p class="muted">X: consulta de una caja abierta sin cerrarla. Z: resumen del turno una vez cerrado, con efectivo esperado, contado y diferencia.</p><button class="btn" data-xz="csv">Exportar historial CSV</button></div>'+shifts.map(function(sh){
    var v=summary(s,sh),open=!sh.closedAt;
    return '<div class="card" style="padding:16px;margin:12px 0"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+ (open?'Reporte X · Caja abierta':'Reporte Z · Caja cerrada')+'</strong><span class="muted">'+esc(new Date(sh.openAt).toLocaleString('es-PY'))+'</span></div><div class="kv"><span>Responsable</span><strong>'+esc(sh.closedBy||sh.by||'—')+'</strong></div><div class="kv"><span>Fondo inicial</span><strong>'+money(sh.openAmt)+'</strong></div><div class="kv"><span>Ventas efectivo</span><strong>'+money(v.by.efectivo)+'</strong></div><div class="kv"><span>Cobros crédito efectivo</span><strong>'+money(v.cobros)+'</strong></div><div class="kv"><span>Gastos y pagos caja</span><strong>− '+money(v.gastos+v.pagos)+'</strong></div><div class="kv"><span>Tarjeta / transferencia / crédito</span><strong>'+money(v.by.tarjeta)+' / '+money(v.by.transferencia)+' / '+money(v.by.credito)+'</strong></div><div class="kv"><strong>Efectivo esperado</strong><strong>'+money(v.expected)+'</strong></div>'+(open?'':'<div class="kv"><span>Efectivo contado</span><strong>'+money(sh.counted)+'</strong></div><div class="kv"><span>Diferencia</span><strong>'+money(sh.diff)+'</strong></div><div class="muted">Cerrada: '+esc(sh.closedAt?new Date(sh.closedAt).toLocaleString('es-PY'):'—')+' · '+esc(sh.note||'Sin observación')+'</div>')+'</div>';
   }).join('')||'<div class="card" style="padding:16px">Todavía no hay turnos de caja registrados.</div>';
   sec.querySelector('[data-xz="csv"]').addEventListener('click',function(){
    var lines=[['Tipo','Apertura','Cierre','Responsable','Fondo inicial','Efectivo esperado','Contado','Diferencia','Tarjeta','Transferencia/QR','Crédito']];
    shifts.forEach(function(sh){var v=summary(s,sh);lines.push([sh.closedAt?'Z':'X',sh.openAt,sh.closedAt||'',sh.closedBy||sh.by||'',sh.openAmt,v.expected,sh.counted==null?'':sh.counted,sh.diff==null?'':sh.diff,v.by.tarjeta,v.by.transferencia,v.by.credito]);});
    var csv=lines.map(function(r){return r.map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='sainei-arqueos-x-z.csv';a.click();setTimeout(function(){URL.revokeObjectURL(u);},1000);
   });
  }
 }
});
})();