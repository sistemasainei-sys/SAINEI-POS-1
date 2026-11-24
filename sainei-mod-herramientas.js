(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'etiquetas',label:'Etiquetas',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:labels});
  api.addTab({id:'proveedores-hist',label:'Proveedores',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:suppliers});
  var payingPurchaseId=0;
  api.addAction('proveedor-pagar',function(el){
   payingPurchaseId=Number(el.dataset.id)||0;
   var st=api.state(),pu=(st.purchases||[]).filter(function(x){return Number(x.id)===payingPurchaseId;})[0];
   if(!pu){api.toast('No se encontró la compra.');return;}
   var paid=(st.spay||[]).filter(function(x){return Number(x.purchId)===payingPurchaseId;}).reduce(function(a,x){return a+Number(x.amount||0);},0),out=Math.max(0,Number(pu.total||0)-paid);
   if(!out){api.toast('Esta compra ya está pagada.');return;}
   api.openModal('<h2>Registrar pago a '+esc(pu.supplier)+'</h2><p class="muted">Compra '+esc(pu.docNo||('#'+pu.id))+' · Saldo pendiente: <strong>'+money(out)+'</strong></p><label>Monto a pagar (Gs.)<input id="ph-pay-amount" type="number" min="1" max="'+out+'" step="1" value="'+out+'" inputmode="numeric"></label><label>Medio de pago<select id="ph-pay-method"><option value="banco">Transferencia / banco</option><option value="otro">Otro medio fuera de caja</option></select></label><p id="ph-pay-error" class="err" role="alert"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="proveedor-confirmar-pago">Guardar pago</button></div>',{wide:false});
  });
  api.addAction('proveedor-confirmar-pago',function(){
   var st=api.state(),pu=(st.purchases||[]).filter(function(x){return Number(x.id)===payingPurchaseId;})[0],err=document.getElementById('ph-pay-error');
   if(!pu||!err)return;
   var paid=(st.spay||[]).filter(function(x){return Number(x.purchId)===payingPurchaseId;}).reduce(function(a,x){return a+Number(x.amount||0);},0),out=Math.max(0,Number(pu.total||0)-paid),amount=Math.round(Number(document.getElementById('ph-pay-amount').value)||0);
   if(!(amount>0)||amount>out){err.textContent='Ingresá un monto mayor a cero y no superior al saldo pendiente.';return;}
   var method=document.getElementById('ph-pay-method').value,record={id:api.newId('spay'),date:new Date().toISOString(),purchId:payingPurchaseId,amount:amount,method:method==='banco'?'banco':'otro',shiftId:0};
   st.spay=Array.isArray(st.spay)?st.spay:[];
   st.spay.push(record);
   Promise.resolve(api.save()).then(function(ok){
    if(ok===false){st.spay=st.spay.filter(function(x){return x!==record;});err.textContent='El servidor no confirmó el pago. Revisá la conexión y volvé a intentar.';return;}
    api.closeModal();api.refresh();api.toast('Pago al proveedor registrado.');
   }).catch(function(){st.spay=st.spay.filter(function(x){return x!==record;});err.textContent='No se pudo guardar el pago. Revisá la conexión.';});
  });
  function esc(v){return api.escape(v==null?'':String(v));}
  function money(v){return api.money(Math.round(Number(v)||0));}
  function labels(sec){
   var s=api.state(),q=sec.querySelector('#et-q')?sec.querySelector('#et-q').value:'';
   var rows=(s.products||[]).filter(function(p){return !q||String(p.name||'').toLowerCase().includes(q.toLowerCase())||String(p.code||'').includes(q);});
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Etiquetas de productos</h2><p class="muted">Seleccioná productos para imprimir etiquetas con nombre, precio y código. La impresión utiliza la impresora configurada en el equipo.</p><label>Buscar<input id="et-q" type="search" placeholder="Nombre o código" value="'+esc(q)+'"></label><div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0"><button class="btn" data-et="all">Marcar todos</button><button class="btn" data-et="none">Limpiar</button><button class="btn primary" data-et="print">Imprimir seleccionados</button></div></div><div class="card" style="padding:12px;margin:12px 0">'+(rows.length?rows.map(function(p){return '<label class="chk" style="display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid var(--line)"><input type="checkbox" data-et-id="'+p.id+'"><span style="flex:1">'+esc(p.name)+' <small class="muted">'+esc(p.code||'Sin código')+'</small></span><strong>'+money(p.price)+'</strong></label>';}).join(''):'No hay productos coincidentes.')+'</div>';
   sec.querySelector('#et-q').addEventListener('input',function(){var v=this.value;labels(sec);var x=sec.querySelector('#et-q');x.focus();x.setSelectionRange(v.length,v.length);});
   sec.querySelector('[data-et="all"]').onclick=function(){sec.querySelectorAll('[data-et-id]').forEach(function(x){x.checked=true;});};
   sec.querySelector('[data-et="none"]').onclick=function(){sec.querySelectorAll('[data-et-id]').forEach(function(x){x.checked=false;});};
   sec.querySelector('[data-et="print"]').onclick=function(){
    var ids=Array.prototype.slice.call(sec.querySelectorAll('[data-et-id]:checked')).map(function(x){return Number(x.dataset.etId);});
    var chosen=rows.filter(function(p){return ids.indexOf(Number(p.id))>=0;});if(!chosen.length){api.toast('Seleccioná al menos un producto.');return;}
    var w=window.open('','_blank');if(!w){api.toast('Permití las ventanas emergentes para imprimir.');return;}
    var html='<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas SAINEI POS</title><style>@page{margin:6mm}body{font-family:Arial,sans-serif;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.tag{border:1px solid #bbb;padding:4mm;min-height:24mm;break-inside:avoid;text-align:center}.name{font-size:11pt;font-weight:bold}.price{font-size:15pt;font-weight:bold;margin:3mm}.code{font-size:9pt;letter-spacing:1px}</style></head><body><div class="grid">'+chosen.map(function(p){return '<div class="tag"><div class="name">'+esc(p.name)+'</div><div class="price">'+money(p.price)+'</div><div class="code">'+esc(p.code||'')+'</div></div>';}).join('')+'</div><script>window.onload=function(){window.print();};<\/script></body></html>';
    w.document.open();w.document.write(html);w.document.close();
   };
  }
  function suppliers(sec){
   var s=api.state(),purchases=s.purchases||[],payments=s.spay||[],names={};
   purchases.forEach(function(p){var n=String(p.supplier||'').trim();if(n)names[n]=(names[n]||[]).concat([p]);});
   var keys=Object.keys(names).sort(function(a,b){return a.localeCompare(b,'es');});
   var rows=keys.map(function(n){var ps=names[n].slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}),total=ps.reduce(function(t,p){return t+Number(p.total||0);},0),out=ps.reduce(function(t,p){var paid=payments.filter(function(x){return Number(x.purchId)===Number(p.id);}).reduce(function(a,x){return a+Number(x.amount||0);},0);return t+Math.max(0,Number(p.total||0)-paid);},0),late=ps.reduce(function(t,p){var paid=payments.filter(function(x){return Number(x.purchId)===Number(p.id);}).reduce(function(a,x){return a+Number(x.amount||0);},0),bal=Math.max(0,Number(p.total||0)-paid);return t+(p.due&&new Date(p.due)<new Date()&&bal>0?bal:0);},0);return {name:n,ps:ps,total:total,out:out,late:late};});
   var total=rows.reduce(function(t,x){return t+x.out;},0),late=rows.reduce(function(t,x){return t+x.late;},0);
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Historial de proveedores</h2><p class="muted">Resumen basado en compras y pagos registrados. Los saldos se calculan con los datos existentes de cada compra.</p><div class="tiles">'+tile('Proveedores',String(rows.length))+tile('Saldo por pagar',money(total))+tile('Vencido',money(late))+'</div></div>'+(rows.length?rows.map(function(x,i){return '<details class="card" style="padding:14px;margin:10px 0"><summary><strong>'+esc(x.name)+'</strong> · Saldo '+money(x.out)+' · '+x.ps.length+' compras</summary><div class="kv"><span>Total histórico comprado</span><strong>'+money(x.total)+'</strong></div><div class="kv"><span>Saldo vencido</span><strong>'+money(x.late)+'</strong></div><div style="overflow:auto"><table class="table"><thead><tr><th>Fecha</th><th>Documento</th><th>Vence</th><th class="r">Total</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Acción</th></tr></thead><tbody>'+x.ps.map(function(p){var paid=payments.filter(function(z){return Number(z.purchId)===Number(p.id);}).reduce(function(a,z){return a+Number(z.amount||0);},0),out=Math.max(0,Number(p.total||0)-paid);return '<tr><td>'+esc(date(p.date))+'</td><td>'+esc(p.doc||p.invoice||'—')+'</td><td>'+esc(date(p.due))+'</td><td class="r">'+money(p.total)+'</td><td class="r">'+money(paid)+'</td><td class="r">'+money(out)+'</td><td><button class="btn" data-a="proveedor-pagar" data-id="'+p.id+'"'+(out<=0?' disabled':'')+'>Pagar</button></td></tr>';}).join('')+'</tbody></table></div></details>';}).join(''):'<div class="card" style="padding:16px">Todavía no hay compras con proveedor registrado.</div>');
  }
  function date(v){var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('es-PY');}
  function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
 }
});
})();
