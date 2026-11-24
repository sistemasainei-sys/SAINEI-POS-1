(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  var editingId=null,query='',payId=0;
  function esc(v){return api.escape(v==null?'':String(v));}
  function gs(v){return api.money(Math.round(Number(v)||0));}
  function state(){return api.state();}
  function directory(){var s=state();if(!s.shop)s.shop={};if(!Array.isArray(s.shop.suppliers))s.shop.suppliers=[];return s.shop.suppliers;}
  function purchasesFor(name,s){return (s.purchases||[]).filter(function(p){return String(p.supplier||'').trim().toLowerCase()===String(name||'').trim().toLowerCase();});}
  function balance(p,s){return Math.max(0,Number(p.total||0)-(s.spay||[]).filter(function(x){return Number(x.purchId)===Number(p.id);}).reduce(function(a,x){return a+Number(x.amount||0);},0));}
  api.addAction('proveedor-pagar',function(el){
   var id=Number(el&&el.dataset&&el.dataset.id)||0,s=state(),pu=(s.purchases||[]).filter(function(x){return Number(x.id)===id;})[0];if(!pu)return;
   payId=id;var due=balance(pu,s);
   api.openModal('<h2>Pagar a '+esc(pu.supplier)+'</h2><p class="muted">Saldo: '+gs(due)+'</p><div class="form"><label>Monto (Gs.)<input id="proveedor-pago-monto" class="input" inputmode="numeric" value="'+due+'"></label><label>Pagado con<select id="proveedor-pago-medio" class="input"><option value="banco">Transferencia u otro medio</option><option value="caja">Efectivo de la caja</option></select></label></div><p id="proveedor-pago-error" class="err"></p><div class="actions"><button class="btn primary" data-a="proveedor-confirmar-pago">Registrar pago</button></div>');
  });
  api.addAction('proveedor-confirmar-pago',function(){
   var s=state(),pu=(s.purchases||[]).filter(function(x){return Number(x.id)===payId;})[0];if(!pu)return;
   var amount=Math.round(api.number((document.querySelector('#proveedor-pago-monto')||{}).value)),method=(document.querySelector('#proveedor-pago-medio')||{}).value||'banco',due=balance(pu,s);
   if(!(amount>0)||amount>due){var er=document.querySelector('#proveedor-pago-error');if(er)er.textContent='Ingresá un monto válido que no supere el saldo.';return;}
   s.spay=s.spay||[];s.spay.push({id:api.newId('spay'),date:new Date().toISOString(),purchId:pu.id,amount:amount,method:method,shiftId:0});
   api.save();api.toast('Pago a proveedor registrado');api.refresh();
  });
  api.addTab({id:'proveedores-hist',label:'Proveedores',canView:function(u){return !!u&&u.role==='admin';},render:render});
  function render(sec){
   var s=state();if(!s)return;
   var all=directory(),known=(s.purchases||[]).map(function(p){return String(p.supplier||'').trim();}).filter(Boolean);
   known.forEach(function(n){if(!all.some(function(x){return String(x.name||'').toLowerCase()===n.toLowerCase();}))all.push({id:'hist-'+n,name:n,active:true,historyOnly:true});});
   var q=query.toLowerCase(),visible=all.filter(function(x){return !q||[x.name,x.ruc,x.phone,x.email].join(' ').toLowerCase().indexOf(q)>=0;});
   var total=0,debt=0,rows='';
   visible.forEach(function(x){
    var ps=purchasesFor(x.name,s),spent=ps.reduce(function(a,p){return a+Number(p.total||0);},0),due=ps.reduce(function(a,p){return a+balance(p,s);},0);total+=spent;debt+=due;
    rows+='<tr><td><strong>'+esc(x.name)+'</strong><div class="muted">'+esc(x.ruc||'Sin RUC')+'</div></td><td>'+esc(x.phone||'—')+'</td><td class="r num">'+gs(spent)+'</td><td class="r num">'+gs(due)+'</td><td>'+(x.active===false?'<span class="pill low">Inactivo</span>':'<span class="pill ok">Activo</span>')+'</td><td class="r">'+(x.historyOnly?'':'<button class="btn" type="button" data-sup-edit="'+esc(x.id)+'">Editar</button>')+'</td></tr>';
    ps.filter(function(p){return balance(p,s)>0;}).forEach(function(p){rows+='<tr><td colspan="3">'+esc(x.name)+' · '+esc(p.docNo||'Compra #'+p.id)+'</td><td class="r num">'+gs(balance(p,s))+'</td><td colspan="2"><button class="btn" type="button" data-a="proveedor-pagar" data-id="'+p.id+'">Pagar</button></td></tr>';});
   });
   var editing=all.filter(function(x){return String(x.id)===String(editingId);})[0]||null;
   sec.innerHTML='<div class="sec-head"><h2>Proveedores</h2><div class="controls"><input id="sup-search" class="input" type="search" placeholder="Buscar proveedor" value="'+esc(query)+'"></div></div>'+
    '<div class="tiles">'+tile('Proveedores',all.length)+tile('Compras acumuladas',gs(total))+tile('Saldo por pagar',gs(debt))+'</div>'+
    '<div class="card" style="padding:16px;margin:12px 0"><h3>'+(editing?'Editar proveedor':'Registrar proveedor')+'</h3><form id="sup-form"><div class="fields">'+
    '<label>Nombre o razón social<input class="input" name="name" maxlength="100" required value="'+esc(editing&&editing.name)+'"></label>'+
    '<label>RUC<input class="input" name="ruc" maxlength="30" value="'+esc(editing&&editing.ruc)+'"></label>'+
    '<label>Teléfono<input class="input" name="phone" maxlength="40" value="'+esc(editing&&editing.phone)+'"></label>'+
    '<label>Correo<input class="input" name="email" type="email" maxlength="120" value="'+esc(editing&&editing.email)+'"></label>'+
    '<label>Dirección<input class="input" name="address" maxlength="160" value="'+esc(editing&&editing.address)+'"></label>'+
    '<label>Observaciones<input class="input" name="note" maxlength="240" value="'+esc(editing&&editing.note)+'"></label></div>'+
    '<div class="actions"><button class="btn primary" type="submit">'+(editing?'Guardar cambios':'Agregar proveedor')+'</button>'+(editing?'<button class="btn" type="button" data-sup-cancel>Cancelar</button>':'')+'</div><p id="sup-error" class="err" role="alert"></p></form></div>'+
    '<div class="panel scroll"><table><thead><tr><th>Proveedor / documento</th><th>Teléfono</th><th class="r">Compras</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="empty">Todavía no hay proveedores ni compras registradas.</td></tr>')+'</tbody></table></div>'+
    '<p class="note">Registrá compras desde Stock → Compras. El proveedor registrado aparecerá como opción al cargar una compra; los saldos se pagan desde esta pantalla o Finanzas → Por pagar.</p>';
   if(!sec.querySelector)return;
   var search=sec.querySelector('#sup-search');if(search)search.addEventListener('input',function(){query=this.value;render(sec);});
   var form=sec.querySelector('#sup-form');if(form)form.addEventListener('submit',function(e){
    e.preventDefault();var fd=new FormData(form),name=String(fd.get('name')||'').trim(),dup=all.some(function(x){return !x.historyOnly&&String(x.id)!==String(editingId)&&String(x.name||'').toLowerCase()===name.toLowerCase();});
    if(!name||dup){var er=sec.querySelector('#sup-error');if(er)er.textContent=!name?'Ingresá el nombre del proveedor.':'Ya existe un proveedor con ese nombre.';return;}
    if(editing&&name.toLowerCase()!==String(editing.name).toLowerCase()&&purchasesFor(editing.name,s).length){sec.querySelector('#sup-error').textContent='No se puede cambiar el nombre porque tiene compras registradas.';return;}
    var data={name:name,ruc:String(fd.get('ruc')||'').trim(),phone:String(fd.get('phone')||'').trim(),email:String(fd.get('email')||'').trim(),address:String(fd.get('address')||'').trim(),note:String(fd.get('note')||'').trim()};
    if(editing)Object.assign(editing,data);else all.push(Object.assign({id:api.newId('sup'),active:true,createdAt:new Date().toISOString()},data));
    editingId=null;api.save();api.toast('Proveedor guardado');render(sec);
   });
   if(sec.dataset&&!sec.dataset.supBound){sec.dataset.supBound='1';sec.addEventListener('click',function(e){var b=e.target.closest('[data-sup-edit],[data-sup-cancel]');if(!b)return;if(b.hasAttribute('data-sup-cancel'))editingId=null;else editingId=b.getAttribute('data-sup-edit');render(sec);});}
  }
  function tile(label,value){return '<div class="tile"><div class="muted">'+esc(label)+'</div><strong class="num">'+esc(value)+'</strong></div>';}
 }
});
})();