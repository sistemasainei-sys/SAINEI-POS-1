(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'ventas-pausadas',label:'Ventas pausadas',canView:function(u){return !!u;},render:render});
  api.addAction('vs-pausar',pauseCurrent);
  api.addAction('vs-restaurar',restore);
  api.addAction('vs-eliminar',remove);
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function current(){return api.user()||{};}
  function visible(x){var u=current();return u.role==='admin'||Number(x.uid)===Number(u.id);}
  function render(sec){
   var s=api.state(),rows=(s.suspendedSales||[]).filter(function(x){return visible(x)&&x.status==='paused';}).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
   var cart=api.cartSnapshot(),u=current();
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Ventas pausadas</h2><p class="muted">Guardá una venta sin cobrarla para continuar después. El stock no queda reservado; al restaurar se comprueba nuevamente la existencia.</p><div class="sec-head"><span>'+cart.items.length+' artículos en la caja actual</span><button class="btn primary" data-a="vs-pausar" '+(!cart.items.length?'disabled':'')+'>Pausar venta actual</button></div></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Venta</th><th>Usuario</th><th>Fecha</th><th>Artículos</th><th class="r">Total estimado</th><th></th></tr></thead><tbody>'+(rows.length?rows.map(function(x){var total=x.items.reduce(function(a,l){var p=(s.products||[]).filter(function(z){return Number(z.id)===Number(l.id);})[0];return a+(l.amount!=null?Number(l.amount):Math.round(Number(l.price!=null?l.price:(p?p.price:0))*Number(l.qty||0)));},0);total=Math.round(total*(1-Math.max(0,Math.min(100,Number(x.disc)||0))/100));return '<tr><td>'+esc(x.label||('Pausa #'+x.id))+'</td><td>'+esc(x.uname||'')+'</td><td>'+esc(new Date(x.date).toLocaleString('es-PY'))+'</td><td>'+x.items.length+'</td><td class="r">'+money(total)+'</td><td><button class="btn" data-a="vs-restaurar" data-id="'+x.id+'" '+(cart.items.length?'disabled':'')+'>Continuar</button> <button class="btn" data-a="vs-eliminar" data-id="'+x.id+'">Eliminar</button></td></tr>';}).join(''):'<tr><td colspan="6">No hay ventas pausadas.</td></tr>')+'</tbody></table></div>';
  }
  function pauseCurrent(){
   var snap=api.cartSnapshot();if(!snap.items.length){api.toast('No hay artículos para pausar.');return;}
   api.openModal('<h2>Pausar venta</h2><label>Referencia (opcional)<input id="vs-label" class="input" maxlength="60" placeholder="Ej.: Cliente vuelve en unos minutos"></label><p class="muted">La venta quedará guardada y se vaciará la caja actual. Todavía no se registra como venta ni descuenta stock.</p><p id="vs-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="vs-confirmar-pausa">Guardar y pausar</button></div>');
   var btn=document.querySelector('[data-a="vs-confirmar-pausa"]');if(btn)btn.addEventListener('click',function(){confirmPause(snap);});
  }
  function confirmPause(snap){
   var s=api.state(),err=document.getElementById('vs-error');if(!err)return;
   s.suspendedSales=Array.isArray(s.suspendedSales)?s.suspendedSales:[];
   if(s.suspendedSales.length>=200){err.textContent='Se alcanzó el límite de 200 ventas pausadas. Eliminá algunas antes de continuar.';return;}
   var u=current(),label=document.getElementById('vs-label');
   s.suspendedSales.push({id:api.newId('move'),date:new Date().toISOString(),uid:Number(u.id)||0,uname:u.name||'',label:String(label&&label.value||'').trim().slice(0,60),items:snap.items,disc:snap.disc,clientId:snap.clientId,pendingBudget:snap.pendingBudget,status:'paused'});
   var saved=s.suspendedSales[s.suspendedSales.length-1];
   Promise.resolve(api.save()).then(function(ok){if(ok===false){s.suspendedSales=s.suspendedSales.filter(function(z){return z!==saved;});err.textContent='No se confirmó el guardado. La venta sigue en caja.';return;}api.closeModal();api.clearCart();api.refresh();api.toast('Venta pausada y guardada.');}).catch(function(){s.suspendedSales=s.suspendedSales.filter(function(z){return z!==saved;});err.textContent='No se pudo guardar. La venta sigue en caja.';});
  }
  function restore(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),x=(s.suspendedSales||[]).filter(function(z){return Number(z.id)===id&&z.status==='paused'&&visible(z);})[0];if(!x)return;
   if(api.cartSnapshot().items.length){api.toast('Primero terminá o pausá la venta actual.');return;}
   if(!api.restoreCart(x)){api.toast('No se pudo restaurar: revisá el stock disponible de los productos.');return;}
   x.status='restored';x.restoredAt=new Date().toISOString();
   Promise.resolve(api.save()).then(function(ok){if(ok===false){x.status='paused';delete x.restoredAt;api.clearCart();api.toast('No se confirmó la restauración. La venta pausada se conserva.');return;}api.refresh();api.toast('Venta restaurada. Revisá cantidades y precios antes de cobrar.');}).catch(function(){x.status='paused';delete x.restoredAt;api.clearCart();api.toast('Error al restaurar. La venta pausada se conserva.');});
  }
  function remove(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),x=(s.suspendedSales||[]).filter(function(z){return Number(z.id)===id&&z.status==='paused'&&visible(z);})[0];if(!x)return;
   if(!window.confirm('¿Eliminar esta venta pausada?'))return;
   x.status='deleted';x.deletedAt=new Date().toISOString();
   Promise.resolve(api.save()).then(function(ok){if(ok===false){x.status='paused';delete x.deletedAt;api.toast('No se confirmó el cambio.');return;}api.refresh();api.toast('Venta pausada eliminada.');}).catch(function(){x.status='paused';delete x.deletedAt;api.toast('No se pudo guardar el cambio.');});
  }
 }
});
})();