(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'devoluciones',label:'Devoluciones',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  api.addAction('return-open',function(el,id){openReturn(id);});
  api.addAction('return-save',function(){saveReturn();});
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function getSale(id){return (api.state().sales||[]).filter(function(x){return Number(x.id)===Number(id);})[0];}
  function returned(s,pid,index){return (s.returns||[]).reduce(function(n,r){return n+(r.items||[]).filter(function(i){return i.lineIndex!=null?Number(i.lineIndex)===Number(index):Number(i.id)===Number(pid);}).reduce(function(a,i){return a+Number(i.qty||0);},0);},0);}
  function available(s,i,index){return Math.max(0,Number(i.qty||0)-returned(s,i.id,index));}
  function render(sec){
   var s=api.state(),sales=(s.sales||[]).filter(function(x){return !x.void&&x.items&&x.items.length;}).slice().reverse();
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Devoluciones parciales y totales</h2><p class="muted">Registra la mercadería devuelta, repone el stock y deja el movimiento auditado. No permite devolver más unidades que las vendidas.</p><div class="tiles">'+tile('Ventas registradas',String(sales.length))+tile('Devoluciones registradas',String(sales.reduce(function(n,x){return n+(x.returns||[]).length;},0)))+'</div></div>'+
    '<div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table><thead><tr><th>Ticket</th><th>Fecha</th><th>Cliente</th><th class="r">Total</th><th>Estado</th><th></th></tr></thead><tbody>'+(sales.length?sales.map(function(x){var c=(s.clients||[]).filter(function(z){return z.id===x.clientId;})[0];var all=x.items.every(function(i){return available(x,i)<=0;});var returnedValue=(x.returns||[]).reduce(function(a,r){return a+Number(r.amount||0);},0);return '<tr><td>#'+esc(String(x.id).padStart(6,'0'))+'</td><td>'+esc(new Date(x.date).toLocaleDateString('es-PY'))+'</td><td>'+esc(c?c.name:'Consumidor final')+'</td><td class="r">'+money(x.total-returnedValue)+'</td><td>'+(all?'<span class="pill tag">Devuelta</span>':(x.returns&&x.returns.length?'<span class="pill low">Parcial</span>':'<span class="pill ok">Sin devolución</span>'))+'</td><td><button class="btn" data-a="return-open" data-id="'+x.id+'" '+(all?'disabled':'')+'>Registrar devolución</button></td></tr>';}).join(''):'<tr><td colspan="6">No hay ventas disponibles.</td></tr>')+'</tbody></table></div>';
  }
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
  function openReturn(id){
   var s=getSale(id);if(!s||s.void)return;
   var rows=s.items.map(function(i,n){var q=available(s,i,n);return '<label class="chk"><span style="flex:1">'+esc(i.name)+' · Vendido: '+esc(i.qty)+' · Disponible: '+esc(q)+' · '+money(i.price)+'</span><input type="number" class="input" style="width:100px" min="0" max="'+q+'" step="'+(i.type==='u'?'1':'0.001')+'" value="0" data-ret-idx="'+n+'" '+(q<=0?'disabled':'')+'></label>';}).join('');
   var shifts=(api.state().shifts||[]).filter(function(x){return !x.closedAt;});
   var methods='<option value="caja" '+(!shifts.length?'disabled':'')+'>Efectivo de caja'+(!shifts.length?' (abrir caja primero)':'')+'</option><option value="banco">Transferencia / tarjeta / otro medio</option>';
   api.openModal('<h2>Devolución del ticket #'+String(s.id).padStart(6,'0')+'</h2><p class="muted">Indicá las cantidades que regresan al stock. El importe se calcula proporcionalmente al precio realmente vendido, incluyendo el descuento.</p><div style="display:grid;gap:8px">'+rows+'</div><label>Reembolso<select id="ret-method" class="input">'+methods+'</select></label><p class="err" id="ret-err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="return-save" data-id="'+s.id+'">Confirmar devolución</button></div>',{wide:true});
  }
  function saveReturn(){
   var box=document.getElementById('overlay'),btn=box&&box.querySelector('[data-a="return-save"]');if(!btn)return;
   var s=getSale(Number(btn.dataset.id)),err=document.getElementById('ret-err');if(!s||s.void)return;
   var inputs=Array.prototype.slice.call(box.querySelectorAll('[data-ret-idx]')),items=[],amount=0,s0Products=(api.state().products||[]);
   var invalid=false;
   inputs.forEach(function(inp){var idx=Number(inp.dataset.retIdx),src=s.items[idx],raw=String(inp.value==null?'':inp.value).trim(),qty=raw===''?0:Number(raw);if(!src||qty===0)return;if(!Number.isFinite(qty)||qty<0||(src.type==='u'&&!Number.isInteger(qty))){invalid=true;err.textContent='Revisá las cantidades: los artículos por unidad deben devolverse en números enteros.';return;}var left=available(s,src,idx);if(qty>left+0.000001){invalid=true;err.textContent='La cantidad supera lo que todavía se puede devolver.';return;}var product=(s0Products||[]).filter(function(p){return Number(p.id)===Number(src.id);})[0];if(!product){invalid=true;err.textContent='No se encuentra el producto '+(src.name||'')+' en el inventario. No se registró la devolución.';return;}var line=Number(src.amount!=null?src.amount:Number(src.price||0)*Number(src.qty||0));var unit=line/Math.max(Number(src.qty||0),0.000001);var val=Math.round(unit*qty*(1-Math.max(0,Math.min(100,Number(s.discPct||0)))/100));items.push({id:src.id,lineIndex:idx,name:src.name,qty:qty,amount:val});amount+=val;});
   if(invalid){return;}
   if(!items.length){err.textContent='Ingresá al menos una cantidad a devolver.';return;}
   var method=document.getElementById('ret-method').value,shift=(api.state().shifts||[]).slice().reverse().filter(function(x){return !x.closedAt;})[0]||null;
   if(method==='caja'&&!shift){err.textContent='No hay una caja abierta. Abrí la caja o elegí otro medio de reembolso.';return;}
   var s0=api.state(),stamp=new Date().toISOString(),rid=api.newId('move');if(!Array.isArray(s0.moves))s0.moves=[];if(!Array.isArray(s0.expenses))s0.expenses=[];
   s.returns=s.returns||[];
   var oldReturns=s.returns.slice(),oldMoves=s0.moves.length,oldExpenses=s0.expenses.length,oldStocks={};
   items.forEach(function(it){var p=(s0.products||[]).filter(function(x){return Number(x.id)===Number(it.id);})[0];if(p&&!Object.prototype.hasOwnProperty.call(oldStocks,p.id))oldStocks[p.id]=p.stock;});
   s.returns.push({id:rid,date:stamp,amount:amount,method:method,items:items,user:(api.user()||{}).name||''});
   items.forEach(function(it){var p=(s0.products||[]).filter(function(x){return Number(x.id)===Number(it.id);})[0];if(p){p.stock=api.round3(Number(p.stock||0)+it.qty);s0.moves.push({id:api.newId('move'),date:stamp,pid:p.id,type:'devolucion',qty:it.qty,note:'Devolución ticket '+s.id});}});
   if(method==='caja')s0.expenses.push({id:api.newId('exp'),date:stamp,concept:'Reembolso devolución ticket '+s.id,cat:'Devolución',amount:amount,method:'caja',shiftId:shift.id});
   function rollback(){s.returns=oldReturns;Object.keys(oldStocks).forEach(function(id){var p=(s0.products||[]).filter(function(x){return Number(x.id)===Number(id);})[0];if(p)p.stock=oldStocks[id];});s0.moves.length=oldMoves;s0.expenses.length=oldExpenses;}
   Promise.resolve(api.save()).then(function(ok){if(ok===false){rollback();err.textContent='El servidor no confirmó el guardado. No se registró la devolución ni se modificó el stock.';return;}api.log('Devolución ticket #'+s.id+' · '+money(amount)+' · '+items.map(function(x){return x.name+' x '+x.qty;}).join(', '));api.closeModal();api.refresh();api.toast('Devolución registrada y stock actualizado.');}).catch(function(){rollback();err.textContent='No se pudo guardar. No se registró la devolución ni se modificó el stock.';});
  }
 }
});
})();