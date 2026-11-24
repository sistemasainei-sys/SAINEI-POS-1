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
  function saleCredit(s){return s.creditAmount!=null?Math.max(0,Number(s.creditAmount)||0):(s.method==='credito'?Number(s.total)||0:0);}
  function returnTotal(r){return Math.max(0,Number(r.totalAmount!=null?r.totalAmount:r.amount)||0);}
  function returned(s,pid,index){return (s.returns||[]).reduce(function(n,r){return n+(r.items||[]).filter(function(i){return i.lineIndex!=null?Number(i.lineIndex)===Number(index):Number(i.id)===Number(pid);}).reduce(function(a,i){return a+Number(i.qty||0);},0);},0);}
  function available(s,i,index){return Math.max(0,Number(i.qty||0)-returned(s,i.id,index));}
  function render(sec){
   var s=api.state(),sales=(s.sales||[]).filter(function(x){return !x.void&&x.items&&x.items.length;}).slice().reverse();
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Devoluciones parciales y totales</h2><p class="muted">Registra la mercadería devuelta, repone el stock y distribuye el reembolso entre efectivo, banco o saldo a favor del cliente. No permite devolver más unidades que las vendidas.</p><div class="tiles">'+tile('Ventas registradas',String(sales.length))+tile('Devoluciones registradas',String(sales.reduce(function(n,x){return n+(x.returns||[]).length;},0)))+'</div></div>'+
    '<div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table><thead><tr><th>Ticket</th><th>Fecha</th><th>Cliente</th><th class="r">Total pendiente</th><th>Estado</th><th></th></tr></thead><tbody>'+(sales.length?sales.map(function(x){var cl=(s.clients||[]).filter(function(z){return z.id===x.clientId;})[0];var all=x.items.every(function(i){return available(x,i)<=0;});var returnedValue=(x.returns||[]).reduce(function(a,r){return a+returnTotal(r);},0);return '<tr><td>#'+esc(String(x.id).padStart(6,'0'))+'</td><td>'+esc(new Date(x.date).toLocaleDateString('es-PY'))+'</td><td>'+esc(cl?cl.name:'Consumidor final')+'</td><td class="r">'+money(Math.max(0,Number(x.total||0)-returnedValue))+'</td><td>'+(all?'<span class="pill tag">Devuelta</span>':(x.returns&&x.returns.length?'<span class="pill low">Parcial</span>':'<span class="pill ok">Sin devolución</span>'))+'</td><td><button class="btn" data-a="return-open" data-id="'+x.id+'" '+(all?'disabled':'')+'>Registrar devolución</button></td></tr>';}).join(''):'<tr><td colspan="6">No hay ventas disponibles.</td></tr>')+'</tbody></table></div>';
  }
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
  function openReturn(id){
   var s=getSale(id);if(!s||s.void)return;
   var rows=s.items.map(function(i,n){var q=available(s,i,n);return '<label class="chk"><span style="flex:1">'+esc(i.name)+' · Vendido: '+esc(i.qty)+' · Disponible: '+esc(q)+' · '+money(i.price)+'</span><input type="number" class="input" style="width:100px" min="0" max="'+q+'" step="'+(i.type==='u'?'1':'0.001')+'" value="0" data-ret-idx="'+n+'" '+(q<=0?'disabled':'')+'></label>';}).join('');
   var shifts=(api.state().shifts||[]).filter(function(x){return !x.closedAt;});
   var credit=saleCredit(s);
   api.openModal('<h2>Devolución del ticket #'+String(s.id).padStart(6,'0')+'</h2><p class="muted">El importe se calcula proporcionalmente al precio realmente vendido, incluyendo el descuento. Distribuí el importe exacto entre los medios de devolución.</p><div style="display:grid;gap:8px">'+rows+'</div><div class="card" style="padding:12px;margin-top:12px"><strong>Importe total a devolver: <span id="ret-total">'+money(0)+'</span></strong><p class="muted">La suma de los tres importes debe coincidir exactamente con el total.</p><label>Efectivo devuelto desde caja '+(!shifts.length?'(sin caja abierta)':'')+'<input id="ret-cash" type="number" min="0" step="1" class="input" value="0" '+(!shifts.length?'disabled':'')+'></label><label>Transferencia / tarjeta devuelta desde banco<input id="ret-bank" type="number" min="0" step="1" class="input" value="0"></label>'+(credit>0?'<label>Aplicar como saldo a favor / reducción de deuda<input id="ret-credit" type="number" min="0" step="1" class="input" value="0"></label>':'<input id="ret-credit" type="hidden" value="0">')+'<p class="muted">Pendiente de crédito original: '+money(credit)+'</p></div><p class="err" id="ret-err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="return-save" data-id="'+s.id+'">Confirmar devolución</button></div>',{wide:true});
   var box=document.getElementById('overlay');if(box){box.querySelectorAll('[data-ret-idx]').forEach(function(inp){inp.addEventListener('input',updateTotal);});}
   function updateTotal(){var total=calculateAmount(s,box);var out=box&&box.querySelector('#ret-total');if(out)out.textContent=money(total);}
  }
  function calculateAmount(s,box){
   if(!box)return 0;var total=0;
   Array.prototype.slice.call(box.querySelectorAll('[data-ret-idx]')).forEach(function(inp){var idx=Number(inp.dataset.retIdx),src=s.items[idx],qty=Math.max(0,Number(inp.value)||0);if(!src||!qty)return;var line=Number(src.amount!=null?src.amount:Number(src.price||0)*Number(src.qty||0));var unit=line/Math.max(Number(src.qty||0),0.000001);total+=Math.round(unit*qty*(1-Math.max(0,Math.min(100,Number(s.discPct||0)))/100));});
   return total;
  }
  function saveReturn(){
   var box=document.getElementById('overlay'),btn=box&&box.querySelector('[data-a="return-save"]');if(!btn)return;
   var s=getSale(Number(btn.dataset.id)),err=document.getElementById('ret-err');if(!s||s.void)return;
   var inputs=Array.prototype.slice.call(box.querySelectorAll('[data-ret-idx]')),items=[],amount=0,s0=api.state(),products=s0.products||[],invalid=false;
   inputs.forEach(function(inp){var idx=Number(inp.dataset.retIdx),src=s.items[idx],raw=String(inp.value==null?'':inp.value).trim(),qty=raw===''?0:Number(raw);if(!src||qty===0)return;if(!Number.isFinite(qty)||qty<0||(src.type==='u'&&!Number.isInteger(qty))){invalid=true;err.textContent='Revisá las cantidades: los artículos por unidad deben devolverse en números enteros.';return;}var left=available(s,src,idx);if(qty>left+0.000001){invalid=true;err.textContent='La cantidad supera lo que todavía se puede devolver.';return;}var product=products.filter(function(p){return Number(p.id)===Number(src.id);})[0];if(!product){invalid=true;err.textContent='No se encuentra el producto '+(src.name||'')+' en el inventario. No se registró la devolución.';return;}var line=Number(src.amount!=null?src.amount:Number(src.price||0)*Number(src.qty||0));var val=Math.round((line/Math.max(Number(src.qty||0),0.000001))*qty*(1-Math.max(0,Math.min(100,Number(s.discPct||0)))/100));items.push({id:src.id,lineIndex:idx,name:src.name,qty:qty,amount:val});amount+=val;});
   if(invalid)return;if(!items.length){err.textContent='Ingresá al menos una cantidad a devolver.';return;}
   var cash=Math.round(Number(box.querySelector('#ret-cash').value)||0),bank=Math.round(Number(box.querySelector('#ret-bank').value)||0),credit=Math.round(Number(box.querySelector('#ret-credit').value)||0);
   if([cash,bank,credit].some(function(v){return !Number.isSafeInteger(v)||v<0;})){err.textContent='Los importes deben ser números enteros no negativos.';return;}
   if(cash+bank+credit!==amount){err.textContent='La suma de efectivo, banco y saldo a favor debe ser igual a '+money(amount)+'.';return;}
   if(credit>saleCredit(s)){err.textContent='El saldo a favor no puede superar el crédito original pendiente de la venta.';return;}
   var shift=(s0.shifts||[]).slice().reverse().filter(function(x){return !x.closedAt;})[0]||null;
   if(cash>0&&!shift){err.textContent='No hay una caja abierta para registrar la devolución en efectivo.';return;}
   var stamp=new Date().toISOString(),rid=api.newId('move'),oldReturns=(s.returns||[]).slice(),oldMoves=(s0.moves||[]).length,oldExpenses=(s0.expenses||[]).length,oldStocks={};
   if(!Array.isArray(s0.moves))s0.moves=[];if(!Array.isArray(s0.expenses))s0.expenses=[];s.returns=s.returns||[];
   items.forEach(function(it){var p=products.filter(function(x){return Number(x.id)===Number(it.id);})[0];if(p&&!Object.prototype.hasOwnProperty.call(oldStocks,p.id))oldStocks[p.id]=p.stock;});
   var method=(cash>0?1:0)+(bank>0?1:0)+(credit>0?1:0)>1?'mixto':cash>0?'caja':bank>0?'banco':'credito';
   s.returns.push({id:rid,date:stamp,amount:amount,totalAmount:amount,cashAmount:cash,bankAmount:bank,creditAmount:credit,method:method,items:items,user:(api.user()||{}).name||''});
   items.forEach(function(it){var p=products.filter(function(x){return Number(x.id)===Number(it.id);})[0];if(p){p.stock=api.round3(Number(p.stock||0)+it.qty);s0.moves.push({id:api.newId('move'),date:stamp,pid:p.id,type:'devolucion',qty:it.qty,note:'Devolución ticket '+s.id});}});
   if(cash>0)s0.expenses.push({id:api.newId('exp'),date:stamp,concept:'Reembolso efectivo devolución ticket '+s.id,cat:'Devolución',amount:cash,method:'caja',shiftId:shift.id});
   if(bank>0)s0.expenses.push({id:api.newId('exp'),date:stamp,concept:'Reembolso banco devolución ticket '+s.id,cat:'Devolución',amount:bank,method:'banco',shiftId:0});
   function rollback(){s.returns=oldReturns;Object.keys(oldStocks).forEach(function(id){var p=products.filter(function(x){return Number(x.id)===Number(id);})[0];if(p)p.stock=oldStocks[id];});s0.moves.length=oldMoves;s0.expenses.length=oldExpenses;}
   Promise.resolve(api.save()).then(function(ok){if(ok===false){rollback();err.textContent='El servidor no confirmó el guardado. No se registró la devolución ni se modificó el stock.';return;}api.log('Devolución ticket #'+s.id+' · '+money(amount)+' · efectivo '+money(cash)+' · banco '+money(bank)+' · crédito '+money(credit));api.closeModal();api.refresh();api.toast('Devolución registrada y distribuida correctamente.');}).catch(function(){rollback();err.textContent='No se pudo guardar. No se registró la devolución ni se modificó el stock.';});
  }
 }
});
})();
