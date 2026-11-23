(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'promociones',label:'Promociones',canView:function(u){return !!u;},render:render});
  api.addAction('promo-nueva',openForm);
  api.addAction('promo-guardar',save);
  api.addAction('promo-aplicar',apply);
  api.addAction('promo-eliminar',remove);
  function esc(v){return api.escape(v==null?'':String(v));}
  function admin(){return api.isAdmin();}
  function active(p){var today=new Date().toISOString().slice(0,10);return p.enabled!==false&&(!p.from||p.from<=today)&&(!p.to||p.to>=today);}
  function render(sec){
   var s=api.state(),rows=Array.isArray(s.promotions)?s.promotions.slice().sort(function(a,b){return String(b.from||'').localeCompare(String(a.from||''));}):[];
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><div class="sec-head"><h2>Promociones</h2>'+(admin()?'<button class="btn primary" data-a="promo-nueva">Nueva promoción</button>':'')+'</div><p class="muted">Configurá descuentos porcentuales con fechas de vigencia. Aplicar una promoción carga el descuento en la caja; el límite de descuento de cada usuario sigue vigente.</p><div class="tiles">'+tile('Campañas',String(rows.length))+tile('Vigentes',String(rows.filter(active).length))+'</div></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Promoción</th><th class="r">Descuento</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>'+(rows.length?rows.map(function(p){return '<tr><td><strong>'+esc(p.name)+'</strong></td><td class="r">'+Number(p.percent||0)+'%</td><td>'+esc(p.from||'Desde ahora')+' – '+esc(p.to||'Sin vencimiento')+'</td><td>'+(active(p)?'<span class="pill ok">Vigente</span>':(p.enabled===false?'<span class="pill low">Pausada</span>':'<span class="pill">Fuera de fecha</span>'))+'</td><td><button class="btn" data-a="promo-aplicar" data-id="'+p.id+'" '+(!active(p)?'disabled':'')+'>Aplicar en caja</button> '+(admin()?'<button class="btn" data-a="promo-eliminar" data-id="'+p.id+'">Eliminar</button>':'')+'</td></tr>';}).join(''):'<tr><td colspan="5">No hay promociones configuradas.</td></tr>')+'</tbody></table></div>';
  }
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
  function openForm(){
   if(!admin()){api.toast('Solo el administrador puede configurar promociones.');return;}
   api.openModal('<h2>Nueva promoción</h2><label>Nombre<input id="promo-name" class="input" maxlength="60" placeholder="Ej.: Descuento de lanzamiento"></label><label>Descuento (%)<input id="promo-percent" class="input" type="number" min="0.1" max="100" step="0.1" value="5"></label><label>Desde<input id="promo-from" class="input" type="date"></label><label>Hasta<input id="promo-to" class="input" type="date"></label><p class="muted">El descuento se aplicará a toda la venta actual cuando se seleccione. No se acumula automáticamente con otros descuentos.</p><p id="promo-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="promo-guardar">Guardar</button></div>');
  }
  function save(){
   var s=api.state(),name=document.getElementById('promo-name'),percent=document.getElementById('promo-percent'),from=document.getElementById('promo-from'),to=document.getElementById('promo-to'),err=document.getElementById('promo-error');if(!err)return;
   var n=String(name&&name.value||'').trim(),p=Number(percent&&percent.value),f=String(from&&from.value||''),t=String(to&&to.value||'');
   if(!admin()){err.textContent='Acción reservada al administrador.';return;}
   if(!n||!Number.isFinite(p)||p<=0||p>100|| (f&&t&&f>t)){err.textContent='Revisá el nombre, el porcentaje y las fechas.';return;}
   s.promotions=Array.isArray(s.promotions)?s.promotions:[];
   s.promotions.push({id:api.newId('move'),name:n,percent:p,from:f,to:t,enabled:true,createdAt:new Date().toISOString()});
   Promise.resolve(api.save()).then(function(ok){if(ok===false){err.textContent='No se confirmó el guardado.';return;}api.closeModal();api.refresh();api.toast('Promoción guardada.');}).catch(function(){err.textContent='No se pudo guardar la promoción.';});
  }
  function apply(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),p=(s.promotions||[]).filter(function(x){return Number(x.id)===id;})[0];
   if(!p||!active(p))return;
   if(!api.applyDiscount(p.percent)){api.toast('El descuento supera tu límite autorizado ('+api.maxDiscount()+'%).');return;}
   api.toast('Promoción aplicada a la venta actual. Revisá el total antes de cobrar.');
  }
  function remove(el){
   if(!admin())return;
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id);if(!window.confirm('¿Eliminar esta promoción?'))return;
   s.promotions=(s.promotions||[]).filter(function(x){return Number(x.id)!==id;});
   Promise.resolve(api.save()).then(function(ok){if(ok===false){api.toast('No se confirmó el cambio.');return;}api.refresh();api.toast('Promoción eliminada.');}).catch(function(){api.toast('No se pudo guardar.');});
  }
 }
});
})();