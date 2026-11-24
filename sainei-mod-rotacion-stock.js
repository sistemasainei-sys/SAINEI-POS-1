(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'rotacion-stock',label:'Rotación de stock',canView:function(u){return !!u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function day(v){var d=new Date(v);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function render(sec){
   var s=api.state();if(!s)return;
   var today=new Date(),limit=new Date(today);limit.setDate(limit.getDate()-30);
   var sold={},last={};
   (s.sales||[]).filter(function(x){return !x.void;}).forEach(function(sale){
    var dt=day(sale.date);if(!dt)return;
    (sale.items||[]).forEach(function(it){
     var id=String(it.id),entry=sold[id]||(sold[id]={qty:0,amount:0});
     var returned=(sale.returns||[]).reduce(function(n,r){return n+(r.items||[]).filter(function(z){return z.lineIndex!=null?Number(z.lineIndex)===(sale.items||[]).indexOf(it):Number(z.id)===Number(it.id);}).reduce(function(a,z){return a+Number(z.qty||0);},0);},0);
     entry.qty+=Math.max(0,Number(it.qty||0)-returned);entry.amount+=Math.max(0,Number(it.amount||0));
     if(!last[id]||dt>last[id])last[id]=dt;
    });
   });
   var rows=(s.products||[]).map(function(p){
    var id=String(p.id),stat=sold[id]||{qty:0,amount:0},lastDate=last[id]||null;
    var days=lastDate?Math.max(0,Math.floor((today-lastDate)/86400000)):null;
    return {name:p.name||'Sin nombre',code:p.code||p.plu||'',cat:p.cat||'Sin categoría',stock:Math.max(0,Number(p.stock)||0),min:Math.max(0,Number(p.min)||0),cost:Math.max(0,Number(p.cost)||0),qty:stat.qty,last:lastDate,days:days};
   });
   var filter=sec.querySelector('#rs-filter')?sec.querySelector('#rs-filter').value:'todos';
   var q=sec.querySelector('#rs-q')?sec.querySelector('#rs-q').value:'';
   var filtered=rows.filter(function(p){
    var match=!q||(p.name+' '+p.code+' '+p.cat).toLowerCase().indexOf(q.toLowerCase())>=0;
    var group=filter==='sin-venta'?p.days===null:filter==='30dias'?p.days!==null&&p.days>=30:filter==='bajo-minimo'?p.stock<=p.min:true;
    return match&&group;
   }).sort(function(a,b){return (b.days===null?999999:b.days)-(a.days===null?999999:a.days)||a.name.localeCompare(b.name,'es');});
   var stale=rows.filter(function(p){return p.days===null||p.days>=30;}),stockValue=stale.reduce(function(a,p){return a+p.stock*p.cost;},0);
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Rotación de inventario</h2><p class="muted">Identificá productos sin ventas recientes para decidir compras, promociones o revisión de precios. Se excluyen ventas anuladas y se descuentan cantidades devueltas cuando están detalladas. Informe de consulta: no modifica el inventario.</p><div class="tiles"><div class="tile"><div class="muted">Productos analizados</div><strong>'+rows.length+'</strong></div><div class="tile"><div class="muted">Sin venta registrada</div><strong>'+rows.filter(function(p){return p.days===null;}).length+'</strong></div><div class="tile"><div class="muted">Sin venta en 30+ días</div><strong>'+stale.length+'</strong></div><div class="tile"><div class="muted">Stock lento a costo</div><strong>'+money(stockValue)+'</strong></div></div></div>'+
   '<div class="card" style="padding:16px;margin:12px 0"><div class="fields" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label>Buscar producto<input id="rs-q" type="search" value="'+esc(q)+'" placeholder="Nombre, código o categoría"></label><label>Mostrar<select id="rs-filter"><option value="todos" '+(filter==='todos'?'selected':'')+'>Todos</option><option value="sin-venta" '+(filter==='sin-venta'?'selected':'')+'>Nunca vendidos</option><option value="30dias" '+(filter==='30dias'?'selected':'')+'>Sin venta hace 30+ días</option><option value="bajo-minimo" '+(filter==='bajo-minimo'?'selected':'')+'>Stock bajo mínimo</option></select></label><button class="btn" data-rs="csv">Exportar CSV</button></div><p class="muted">'+filtered.length+' productos en el resultado</p><div style="overflow:auto"><table class="table"><thead><tr><th>Producto / código</th><th>Categoría</th><th class="r">Stock</th><th class="r">Vendido histórico</th><th>Última venta</th><th class="r">Días sin venta</th><th>Estado</th></tr></thead><tbody>'+(filtered.length?filtered.map(function(p){var status=p.days===null?'Sin ventas':p.days>=30?'Rotación lenta':'Con movimiento';return '<tr><td><strong>'+esc(p.name)+'</strong><br><small class="muted">'+esc(p.code)+'</small></td><td>'+esc(p.cat)+'</td><td class="r">'+esc(p.stock)+'</td><td class="r">'+esc(p.qty.toFixed(3))+'</td><td>'+(p.last?p.last.toLocaleDateString('es-PY'):'—')+'</td><td class="r">'+(p.days===null?'—':p.days)+'</td><td>'+esc(status)+'</td></tr>';}).join(''):'<tr><td colspan="7">No hay productos para este filtro.</td></tr>')+'</tbody></table></div></div>';
   ['#rs-q','#rs-filter'].forEach(function(sel){sec.querySelector(sel).addEventListener(sel==='#rs-q'?'input':'change',function(){render(sec);});});
   sec.querySelector('[data-rs="csv"]').addEventListener('click',function(){
    var lines=[['Producto','Codigo','Categoria','Stock','Vendido historico','Ultima venta','Dias sin venta','Estado']].concat(filtered.map(function(p){return [p.name,p.code,p.cat,p.stock,p.qty,p.last?p.last.toLocaleDateString('es-PY'):'',p.days===null?'':p.days,p.days===null?'Sin ventas':p.days>=30?'Rotacion lenta':'Con movimiento'];}));
    var csv=lines.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sainei-rotacion-inventario.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
   });
  }
 }
});
})();