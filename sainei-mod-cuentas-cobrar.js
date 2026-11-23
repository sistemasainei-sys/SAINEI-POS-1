(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'creditos-reporte',label:'Cuentas por cobrar',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function date(v){var d=new Date(v);return isNaN(d)?null:d;}
  function fmt(v){var d=date(v);return d?d.toLocaleDateString('es-PY'):'—';}
  function render(sec){
   var s=api.state();if(!s)return;
   var today=new Date(),rows=[];
   (s.clients||[]).forEach(function(c){
    var sales=(s.sales||[]).filter(function(x){return x.clientId===c.id&&x.method==='credito'&&!x.void;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
    var pays=(s.payments||[]).filter(function(p){return p.clientId===c.id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
    var balance=sales.reduce(function(a,x){return a+Number(x.total||0);},0)-pays.reduce(function(a,x){return a+Number(x.amount||0);},0);
    var paid=pays.reduce(function(a,x){return a+Number(x.amount||0);},0),remaining=paid,overdue=0,oldest=null;
    sales.forEach(function(x){var out=Number(x.total||0);if(remaining>=out){remaining-=out;out=0;}else{out-=remaining;remaining=0;}
     if(out>0){var due=date(x.due);if(due&&due<today)overdue+=out;if(!oldest||new Date(x.date)<oldest.date)oldest={date:new Date(x.date),due:x.due,amount:out};}
    });
    if(balance>0.5)rows.push({client:c,balance:balance,paid:paid,overdue:overdue,oldest:oldest});
   });
   rows.sort(function(a,b){return b.overdue-a.overdue||b.balance-a.balance;});
   var total=rows.reduce(function(a,x){return a+x.balance;},0),late=rows.reduce(function(a,x){return a+x.overdue;},0);
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Cuentas por cobrar</h2><p class="muted">Antigüedad calculada con ventas a crédito y pagos registrados, aplicando los pagos a las ventas más antiguas primero.</p><div class="tiles">'+tile('Saldo pendiente',money(total))+tile('Vencido',money(late))+tile('Clientes con saldo',String(rows.length))+'</div><button class="btn" data-cr="csv">Exportar CSV</button></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Cliente</th><th>Teléfono</th><th class="r">Saldo</th><th class="r">Vencido</th><th>Venta pendiente más antigua</th><th>Vencimiento</th></tr></thead><tbody>'+(rows.length?rows.map(function(x){return '<tr><td>'+esc(x.client.name)+'</td><td>'+esc(x.client.phone||'—')+'</td><td class="r">'+money(x.balance)+'</td><td class="r">'+money(x.overdue)+'</td><td>'+(x.oldest?fmt(x.oldest.date):'—')+'</td><td>'+(x.oldest?fmt(x.oldest.due):'—')+'</td></tr>';}).join(''):'<tr><td colspan="6">No hay saldos pendientes.</td></tr>')+'</tbody></table></div>';
   sec.querySelector('[data-cr="csv"]').addEventListener('click',function(){
    var data=[['Cliente','Telefono','Saldo Gs','Vencido Gs','Venta pendiente mas antigua','Vencimiento']].concat(rows.map(function(x){return [x.client.name,x.client.phone||'',Math.round(x.balance),Math.round(x.overdue),x.oldest?fmt(x.oldest.date):'',x.oldest?fmt(x.oldest.due):''];}));
    var csv=data.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='sainei-cuentas-por-cobrar.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
   });
  }
  function tile(label,value){return '<div class="tile"><div class="muted">'+esc(label)+'</div><strong class="num">'+esc(value)+'</strong></div>';}
 }
});
})();