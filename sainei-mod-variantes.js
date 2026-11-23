(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'variantes',label:'Variantes',canView:function(u){return !!u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  api.addAction('var-nueva',openAssign);
  api.addAction('var-guardar',saveAssign);
  api.addAction('var-quitar',detach);
  function esc(v){return api.escape(v==null?'':String(v));}
  function render(sec){
   var s=api.state(),products=s.products||[],groups={};
   products.forEach(function(p){var g=String(p.variantGroup||'').trim();if(!g)return;(groups[g]=groups[g]||[]).push(p);});
   var names=Object.keys(groups).sort();
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div class="sec-head"><h2>Variantes de productos</h2><button class="btn primary" data-a="var-nueva">Vincular producto</button></div><p class="muted">Cada variante conserva su propio código, precio y existencia. Creá primero cada presentación como producto independiente y después vinculalas bajo un mismo grupo (por ejemplo: Remera / S, M, L).</p><div class="tiles">'+tile('Grupos',String(names.length))+tile('Productos vinculados',String(products.filter(function(p){return !!String(p.variantGroup||'').trim();}).length))+'</div></div>'+ (names.length?names.map(function(g){var list=groups[g];return '<div class="card" style="padding:16px;margin:12px 0;overflow:auto"><h3>'+esc(g)+'</h3><table class="table"><thead><tr><th>Variante</th><th>Producto / SKU</th><th class="r">Precio</th><th class="r">Stock propio</th><th></th></tr></thead><tbody>'+list.map(function(p){return '<tr><td><strong>'+esc(p.variantName||'Sin nombre')+'</strong></td><td>'+esc(p.name)+'<small class="muted"> · '+esc(p.code||'Sin código')+'</small></td><td class="r">'+api.money(p.price)+'</td><td class="r">'+esc(p.stock)+' '+esc(p.unit||'u')+'</td><td><button class="btn" data-a="var-quitar" data-id="'+p.id+'">Desvincular</button></td></tr>';}).join('')+'</tbody></table><div class="kv"><span>Existencia total del grupo</span><strong>'+esc(list.reduce(function(a,p){return a+Number(p.stock||0);},0))+'</strong></div></div>';}).join(''):'<div class="card" style="padding:16px;margin:12px 0"><p class="muted">Todavía no hay grupos de variantes. Vinculá productos existentes para comenzar.</p></div>');
  }
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
  function openAssign(){
   var s=api.state(),products=(s.products||[]).filter(function(p){return p.active!==false;});
   if(!products.length){api.toast('Primero cargá los productos en el catálogo.');return;}
   var opts=products.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+' · '+esc(p.code||'sin código')+' · stock '+esc(p.stock)+'</option>';}).join('');
   api.openModal('<h2>Vincular variante</h2><label>Grupo (nombre común)<input id="var-group" class="input" maxlength="60" placeholder="Ej.: Remera clásica"></label><label>Producto existente<select id="var-product" class="input">'+opts+'</select></label><label>Nombre de variante<input id="var-name" class="input" maxlength="40" placeholder="Ej.: Azul · Talle M"></label><p class="muted">No se crea ni modifica el stock. Se asigna el producto seleccionado a un grupo y mantiene su código, precio y existencia independientes.</p><p id="var-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="var-guardar">Guardar vínculo</button></div>');
  }
  function saveAssign(){
   var s=api.state(),g=document.getElementById('var-group'),sel=document.getElementById('var-product'),n=document.getElementById('var-name'),err=document.getElementById('var-error');if(!g||!sel||!n||!err)return;
   var group=String(g.value||'').trim(),name=String(n.value||'').trim(),p=(s.products||[]).filter(function(x){return Number(x.id)===Number(sel.value);})[0];
   if(!group||!name||!p){err.textContent='Completá el grupo, el producto y el nombre de la variante.';return;}
   p.variantGroup=group;p.variantName=name;
   Promise.resolve(api.save()).then(function(ok){if(ok===false){err.textContent='No se confirmó el guardado.';return;}api.closeModal();api.refresh();api.toast('Variante vinculada.');}).catch(function(){err.textContent='No se pudo guardar. Revisá la conexión.';});
  }
  function detach(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),p=(s.products||[]).filter(function(x){return Number(x.id)===id;})[0];if(!p)return;
   p.variantGroup='';p.variantName='';
   Promise.resolve(api.save()).then(function(ok){if(ok===false){api.toast('No se confirmó el cambio.');return;}api.refresh();api.toast('Producto desvinculado; su stock no cambió.');}).catch(function(){api.toast('No se pudo guardar el cambio.');});
  }
 }
});
})();