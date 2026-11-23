(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'informesplus',label:'Informes +',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function money(n){return api.money(Math.round(Number(n)||0));}
  function esc(s){return api.escape(s==null?'':String(s));}
  function dateKey(v){var d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10);}
  function fmtDate(v){var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('es-PY');}
  function sum(a,f){return a.reduce(function(t,x){return t+(Number(f(x))||0);},0);}
  function render(sec){
   var s=api.state();if(!s)return;
   var sales=(s.sales||[]).filter(function(x){return !x.void;});
   var today=new Date().toISOString().slice(0,10);
   var first=new Date();first.setDate(1);
   var from=sec.querySelector('#ip-from')?sec.querySelector('#ip-from').value:first.toISOString().slice(0,10);
   var to=sec.querySelector('#ip-to')?sec.querySelector('#ip-to').value:today;
   if(!from)from=first.toISOString().slice(0,10);if(!to)to=today;
   var rows=sales.filter(function(x){var d=dateKey(x.date);return d>=from&&d<=to;});
   var gross=sum(rows,function(x){return x.total;});
   var refunds=(s.sales||[]).filter(function(x){return !x.void&&dateKey(x.date)>=from&&dateKey(x.date)<=to;}).reduce(function(a,x){return a+(x.returns||[]).reduce(function(b,r){return b+Number(r.amount||0);},0);},0);
   var returnedCmv=rows.reduce(function(a,x){return a+(x.returns||[]).reduce(function(b,r){return b+(r.items||[]).reduce(function(c,it){var src=(x.items||[])[Number(it.lineIndex)];return c+(src?Number(src.cost||0)*Number(it.qty||0):0);},0);},0);},0);
   var cmv=sum(rows,function(x){return x.cmv;})-returnedCmv;
   var margin=gross-refunds-cmv;
   var expenses=(s.expenses||[]).filter(function(x){var d=dateKey(x.date);return d>=from&&d<=to;});
   var expenseTotal=sum(expenses,function(x){return x.amount;});
   var net=margin-expenseTotal;
   var iva10=sum(rows,function(x){return x.iva10;});
   var iva5=sum(rows,function(x){return x.iva5;});
   var ex=sum(rows,function(x){return x.ex;});
   var methods={efectivo:0,tarjeta:0,transferencia:0,credito:0};
   rows.forEach(function(x){var ps=Array.isArray(x.payParts)&&x.payParts.length?x.payParts:[{method:x.method,amount:x.total}];ps.forEach(function(p){methods[p.method]=(methods[p.method]||0)+Number(p.amount||0);});});
   var products={};
   rows.forEach(function(x){(x.items||[]).forEach(function(i){
    var k=String(i.id||i.name),p=products[k]||(products[k]={name:i.name||'Producto',qty:0,sales:0,cost:0});
    var rq=(x.returns||[]).reduce(function(a,r){return a+(r.items||[]).filter(function(z){return z.lineIndex!=null?Number(z.lineIndex)===(x.items||[]).indexOf(i):Number(z.id)===Number(i.id);}).reduce(function(b,z){return b+Number(z.qty||0);},0);},0);var grossLine=Number(i.amount!=null?i.amount:(i.price||0)*(i.qty||0));var returnedLine=(x.returns||[]).reduce(function(a,r){return a+(r.items||[]).filter(function(z){return z.lineIndex!=null?Number(z.lineIndex)===(x.items||[]).indexOf(i):Number(z.id)===Number(i.id);}).reduce(function(b,z){return b+Number(z.amount||0);},0);},0);p.qty+=Math.max(0,Number(i.qty||0)-rq);p.sales+=Math.max(0,grossLine-returnedLine);p.cost+=Number(i.cost||0)*Math.max(0,Number(i.qty||0)-rq);
   });});
   var top=Object.keys(products).map(function(k){return products[k];}).sort(function(a,b){return b.sales-a.sales;}).slice(0,15);
   var low=(s.products||[]).filter(function(p){return Number(p.stock||0)<=Number(p.min||0);});
   var head='<div class="card" style="padding:16px;margin:12px 0"><h2>Informes avanzados</h2><p class="muted">Análisis de ventas, costo de mercadería, margen estimado, gastos e IVA. No modifica ventas ni existencias.</p><div class="fields" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label>Desde<input id="ip-from" type="date" value="'+esc(from)+'"></label><label>Hasta<input id="ip-to" type="date" value="'+esc(to)+'"></label><button class="btn primary" data-ip="apply">Aplicar</button><button class="btn" data-ip="csv">Exportar CSV</button></div></div>';
   var tiles='<div class="tiles">'+tile('Ventas',money(gross))+tile('Costo de mercadería',money(cmv))+tile('Margen bruto',money(margin))+tile('Gastos',money(expenseTotal))+tile('Resultado estimado',money(net))+tile('Operaciones',String(rows.length))+'</div>';
   var iva='<div class="card" style="padding:16px;margin:12px 0"><h3>Resumen de IVA registrado</h3><div class="kv"><span>IVA 10%</span><strong>'+money(iva10)+'</strong></div><div class="kv"><span>IVA 5%</span><strong>'+money(iva5)+'</strong></div><div class="kv"><span>Ventas exentas</span><strong>'+money(ex)+'</strong></div><p class="muted">Cálculo informativo basado en los datos guardados en cada venta; no constituye liquidación fiscal ni factura electrónica.</p></div>';
   var pay='<div class="card" style="padding:16px;margin:12px 0"><h3>Ventas por medio de pago</h3><p class="muted">Devoluciones registradas: '+money(refunds)+'</p>'+Object.keys(methods).map(function(k){return '<div class="kv"><span>'+esc(({efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia / QR',credito:'Crédito'})[k]||k)+'</span><strong>'+money(methods[k])+'</strong></div>';}).join('')+'</div>';
   var table='<div class="card" style="padding:16px;margin:12px 0"><h3>Productos más vendidos</h3><div style="overflow:auto"><table class="table"><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Venta</th><th class="r">Costo</th><th class="r">Margen</th></tr></thead><tbody>'+(top.length?top.map(function(p){return '<tr><td>'+esc(p.name)+'</td><td class="r">'+esc(p.qty.toFixed(3))+'</td><td class="r">'+money(p.sales)+'</td><td class="r">'+money(p.cost)+'</td><td class="r">'+money(p.sales-p.cost)+'</td></tr>';}).join(''):'<tr><td colspan="5">No hay ventas en este período.</td></tr>')+'</tbody></table></div></div>';
   var stock='<div class="card" style="padding:16px;margin:12px 0"><h3>Alertas de stock mínimo ('+low.length+')</h3><div style="overflow:auto"><table class="table"><thead><tr><th>Producto</th><th class="r">Existencia</th><th class="r">Mínimo</th></tr></thead><tbody>'+(low.length?low.slice(0,30).map(function(p){return '<tr><td>'+esc(p.name)+'</td><td class="r">'+esc(p.stock)+'</td><td class="r">'+esc(p.min)+'</td></tr>';}).join(''):'<tr><td colspan="3">No hay productos bajo el mínimo.</td></tr>')+'</tbody></table></div></div>';
   sec.innerHTML=head+tiles+iva+pay+table+stock;
   sec.querySelector('[data-ip="apply"]').addEventListener('click',function(){render(sec);});
   sec.querySelector('[data-ip="csv"]').addEventListener('click',function(){
    var lines=[['Producto','Cantidad','Venta Gs','Costo Gs','Margen Gs']].concat(top.map(function(p){return [p.name,p.qty,p.sales,p.cost,p.sales-p.cost];}));
    var csv=lines.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='sainei-informe-productos-'+from+'-'+to+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
   });
  }
  function tile(label,value){return '<div class="tile"><div class="muted">'+esc(label)+'</div><strong class="num">'+esc(value)+'</strong></div>';}
 }
});
})();