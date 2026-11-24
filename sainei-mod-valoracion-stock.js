(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'valoracion-stock',label:'Valoración de stock',canView:function(u){return !!u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function render(sec){
   var s=api.state(),rows=(s.products||[]).map(function(p){
    var stock=Math.max(0,Number(p.stock)||0),cost=Math.max(0,Number(p.cost)||0);
    return {id:p.id,name:p.name||'Sin nombre',code:p.code||p.plu||'',cat:p.cat||'Sin categoría',stock:stock,cost:cost,value:stock*cost,unit:p.unit||'u'};
   }).sort(function(a,b){return b.value-a.value||String(a.name).localeCompare(String(b.name),'es');});
   var total=rows.reduce(function(a,p){return a+p.value;},0),without=rows.filter(function(p){return p.stock>0&&p.cost<=0;}),stockUnits=rows.reduce(function(a,p){return a+p.stock;},0);
   var cats={};rows.forEach(function(p){cats[p.cat]=(cats[p.cat]||0)+p.value;});
   var categoryRows=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];});
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div class="sec-head"><div><h2>Valoración de inventario</h2><p class="muted">Estimación del valor del stock usando el costo unitario cargado en cada producto. Es un informe informativo; no modifica existencias ni costos.</p></div><button class="btn primary" data-vs="csv">Exportar CSV</button></div><div class="tiles"><div class="tile"><div class="muted">Valor total a costo</div><strong>'+money(total)+'</strong></div><div class="tile"><div class="muted">Productos con stock</div><strong>'+rows.filter(function(p){return p.stock>0;}).length+'</strong></div><div class="tile"><div class="muted">Unidades / cantidades</div><strong>'+esc(stockUnits.toFixed(3))+'</strong></div><div class="tile"><div class="muted">Sin costo cargado</div><strong>'+without.length+'</strong></div></div></div>'+
   '<div class="card" style="padding:16px;margin:12px 0"><h3>Valor por categoría</h3><div style="overflow:auto"><table class="table"><thead><tr><th>Categoría</th><th class="r">Valor a costo</th></tr></thead><tbody>'+(categoryRows.length?categoryRows.map(function(c){return '<tr><td>'+esc(c)+'</td><td class="r">'+money(cats[c])+'</td></tr>';}).join(''):'<tr><td colspan="2">No hay productos cargados.</td></tr>')+'</tbody></table></div></div>'+
   '<div class="card" style="padding:16px;margin:12px 0"><h3>Detalle de productos</h3><div style="overflow:auto"><table class="table"><thead><tr><th>Producto / código</th><th>Categoría</th><th class="r">Stock</th><th class="r">Costo unitario</th><th class="r">Valor a costo</th></tr></thead><tbody>'+(rows.length?rows.map(function(p){return '<tr><td><strong>'+esc(p.name)+'</strong><br><small class="muted">'+esc(p.code)+'</small></td><td>'+esc(p.cat)+'</td><td class="r">'+esc(p.stock.toFixed(3))+' '+esc(p.unit)+'</td><td class="r">'+money(p.cost)+'</td><td class="r"><strong>'+money(p.value)+'</strong></td></tr>';}).join(''):'<tr><td colspan="5">No hay productos cargados.</td></tr>')+'</tbody></table></div></div>'+
   (without.length?'<div class="card" style="padding:16px;margin:12px 0"><h3>Atención: productos sin costo</h3><p class="muted">Estos productos tienen existencia, pero no tienen costo unitario cargado; por eso no aumentan el valor total informado.</p>'+without.map(function(p){return '<div class="kv"><span>'+esc(p.name)+' · '+esc(p.code)+'</span><strong>'+esc(p.stock.toFixed(3))+' '+esc(p.unit)+'</strong></div>';}).join('')+'</div>':'');
   var btn=sec.querySelector('[data-vs="csv"]');
   if(btn)btn.addEventListener('click',function(){
    var lines=[['Producto','Codigo','Categoria','Stock','Unidad','Costo unitario Gs','Valor a costo Gs']].concat(rows.map(function(p){return [p.name,p.code,p.cat,p.stock,p.unit,p.cost,Math.round(p.value)];}));
    var csv=lines.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='sainei-valoracion-stock.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
   });
  }
 }
});
})();