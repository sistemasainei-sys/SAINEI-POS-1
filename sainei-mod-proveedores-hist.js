(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'proveedores-hist',label:'Proveedores',canView:function(u){return !!u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  api.addAction('proveedor-pagar',openPayment);
  api.addAction('proveedor-confirmar-pago',savePayment);
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function paid(purchId){return (api.state().spay||[]).filter(function(x){return Number(x.purchId)===Number(purchId);}).reduce(function(a,x){return a+Math.max(0,Number(x.amount)||0);},0);}
  function balance(p){return Math.max(0,Number(p.total||0)-paid(p.id));}
  function render(sec){
   var s=api.state(),rows=(s.purchases||[]).filter(function(p){return String(p.supplier||'').trim();}).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));}),out=rows.reduce(function(a,p){return a+balance(p);},0);
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Cuenta corriente de proveedores</h2><p class="muted">Consulta de compras registradas, pagos parciales y saldos pendientes por proveedor.</p><div class="tiles">'+tile('Documentos',String(rows.length))+tile('Saldo pendiente',money(out))+'</div></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Proveedor</th><th>Documento</th><th>Fecha</th><th class="r">Compra</th><th class="r">Pagado</th><th class="r">Saldo</th><th></th></tr></thead><tbody>'+(rows.length?rows.map(function(p){var b=balance(p);return '<tr><td>'+esc(p.supplier)+'</td><td>'+esc(p.docNo||('Compra #'+p.id))+'</td><td>'+esc(p.date?new Date(p.date).toLocaleDateString('es-PY'):'—')+'</td><td class="r">'+money(p.total)+'</td><td class="r">'+money(paid(p.id))+'</td><td class="r"><strong>'+money(b)+'</strong></td><td><button class="btn" data-a="proveedor-pagar" data-id="'+p.id+'" '+(b<=0?'disabled':'')+'>Pagar</button></td></tr>';}).join(''):'<tr><td colspan="7">No hay compras a proveedores registradas.</td></tr>')+'</tbody></table></div>';
  }
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
  function openPayment(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),p=(s.purchases||[]).filter(function(x){return Number(x.id)===id;})[0];if(!p)return;
   var b=balance(p);if(b<=0)return;
   api.openModal('<h2>Registrar pago a proveedor</h2><p><strong>'+esc(p.supplier)+'</strong> · '+esc(p.docNo||('Compra #'+p.id))+'</p><p class="muted">Saldo pendiente: '+money(b)+'</p><label>Importe a pagar<input id="prov-amount" class="input" type="number" min="1" max="'+b+'" step="1" value="'+b+'"></label><label>Medio de pago<select id="prov-method" class="input"><option value="banco">Transferencia / banco</option><option value="caja">Efectivo de caja</option></select></label><label>Observación<input id="prov-note" class="input" maxlength="120" placeholder="Referencia del pago (opcional)"></label><p id="prov-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="proveedor-confirmar-pago" data-id="'+id+'">Confirmar pago</button></div>');
  }
  function savePayment(el){
   var s=api.state(),id=Number(el&&el.dataset&&el.dataset.id),p=(s.purchases||[]).filter(function(x){return Number(x.id)===id;})[0],amt=document.getElementById('prov-amount'),method=document.getElementById('prov-method'),note=document.getElementById('prov-note'),err=document.getElementById('prov-error');if(!p||!err)return;
   var amount=Math.round(Number(amt&&amt.value)||0),b=balance(p),m=String(method&&method.value||'banco'),shift=(s.shifts||[]).slice().reverse().filter(function(x){return !x.closedAt;})[0]||null;
   if(amount<1||amount>b){err.textContent='El importe debe ser mayor que cero y no superar el saldo pendiente.';return;}
   if(m==='caja'&&!shift){err.textContent='No hay una caja abierta. Abrí la caja o elegí transferencia / banco.';return;}
   s.spay=Array.isArray(s.spay)?s.spay:[];
   var u=api.user()||{};
   s.spay.push({id:api.newId('spay'),purchId:id,amount:amount,method:m,date:new Date().toISOString(),note:String(note&&note.value||'').trim().slice(0,120),shiftId:shift&&m==='caja'?shift.id:0,uid:u.id||0,uname:u.name||''});
   Promise.resolve(api.save()).then(function(ok){if(ok===false){err.textContent='No se confirmó el guardado. Revisá la conexión.';return;}api.closeModal();api.refresh();api.toast('Pago a proveedor registrado.');}).catch(function(){err.textContent='No se pudo guardar el pago.';});
  }
 }
});
})();