(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  var editingId=null,query='';
  api.addTab({id:'proveedores',label:'Proveedores',canView:function(u){return !!u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function gs(v){return api.money(Math.round(Number(v)||0));}
  function list(){var s=api.state();if(!s.shop)s.shop={};if(!Array.isArray(s.shop.suppliers))s.shop.suppliers=[];return s.shop.suppliers;}
  function purchasesFor(sup,s){return (s.purchases||[]).filter(function(p){return String(p.supplier||'').trim().toLowerCase()===String(sup.name||'').trim().toLowerCase();});}
  function balance(p,s){return Math.max(0,Number(p.total||0)-(s.spay||[]).filter(function(x){return Number(x.purchId)===Number(p.id);}).reduce(function(a,x){return a+Number(x.amount||0);},0));}
  function render(sec){
   var s=api.state();if(!s)return;
   var all=list(),active=all.filter(function(x){return x.active!==false;});
   var q=query.trim().toLowerCase();
   var visible=all.filter(function(x){return !q||[x.name,x.ruc,x.phone,x.email].join(' ').toLowerCase().indexOf(q)>=0;});
   var totalDebt=0,totalPurch=0;
   active.forEach(function(x){purchasesFor(x,s).forEach(function(p){totalPurch+=Number(p.total||0);totalDebt+=balance(p,s);});});
   var editing=all.filter(function(x){return String(x.id)===String(editingId);})[0]||null;
   var form='<div class="card" style="padding:16px;margin:12px 0"><h3>'+(editing?'Editar proveedor':'Registrar proveedor')+'</h3><form id="sup-form"><div class="fields">'+
    '<label>Nombre o razón social<input class="input" name="name" maxlength="100" required value="'+esc(editing&&editing.name)+'"></label>'+
    '<label>RUC<input class="input" name="ruc" maxlength="30" value="'+esc(editing&&editing.ruc)+'"></label>'+
    '<label>Teléfono<input class="input" name="phone" maxlength="40" value="'+esc(editing&&editing.phone)+'"></label>'+
    '<label>Correo electrónico<input class="input" name="email" type="email" maxlength="120" value="'+esc(editing&&editing.email)+'"></label>'+
    '<label>Dirección<input class="input" name="address" maxlength="160" value="'+esc(editing&&editing.address)+'"></label>'+
    '<label>Observaciones<input class="input" name="note" maxlength="240" value="'+esc(editing&&editing.note)+'"></label>'+
    '</div><p class="muted" style="margin:8px 0">Los proveedores se guardan en la configuración del comercio y quedan disponibles para seleccionar al registrar compras.</p><div class="actions"><button class="btn primary" type="submit">'+(editing?'Guardar cambios':'Agregar proveedor')+'</button>'+(editing?'<button class="btn" type="button" data-sup="cancel">Cancelar edición</button>':'')+'</div><p id="sup-error" class="err" role="alert"></p></form></div>';
   var rows=visible.map(function(x){
    var ps=purchasesFor(x,s),spent=ps.reduce(function(a,p){return a+Number(p.total||0);},0),due=ps.reduce(function(a,p){return a+balance(p,s);},0);
    return '<tr><td><strong>'+esc(x.name)+'</strong><div class="muted">'+esc(x.ruc||'Sin RUC')+'</div></td><td>'+esc(x.phone||'—')+'</td><td>'+esc(x.email||'—')+'</td><td class="r num">'+gs(spent)+'</td><td class="r num">'+gs(due)+'</td><td>'+(x.active===false?'<span class="pill low">Inactivo</span>':'<span class="pill ok">Activo</span>')+'</td><td class="r"><button class="btn" type="button" data-sup="edit" data-id="'+esc(x.id)+'">Editar</button> <button class="btn" type="button" data-sup="toggle" data-id="'+esc(x.id)+'">'+(x.active===false?'Activar':'Desactivar')+'</button></td></tr>';
   }).join('');
   sec.innerHTML='<div class="sec-head"><h2>Proveedores</h2><div class="controls"><input id="sup-search" class="input" type="search" placeholder="Buscar por nombre, RUC o teléfono" value="'+esc(query)+'"></div></div>'+
    '<div class="tiles">'+tile('Proveedores registrados',all.length)+tile('Activos',active.length)+tile('Compras acumuladas',gs(totalPurch))+tile('Saldo pendiente',gs(totalDebt))+'</div>'+
    form+'<div class="panel scroll"><table><thead><tr><th>Proveedor</th><th>Teléfono</th><th>Correo</th><th class="r">Compras</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="empty">Todavía no hay proveedores registrados. Agregá el primero arriba.</td></tr>')+'</tbody></table></div>'+
    '<p class="note">Las compras y los pagos se registran desde Stock → Compras y Finanzas → Por pagar. El historial se relaciona por el nombre del proveedor.</p>';
   var search=sec.querySelector('#sup-search');if(search)search.addEventListener('input',function(){query=this.value;var pos=this.selectionStart;render(sec);var next=sec.querySelector('#sup-search');if(next){next.focus();next.setSelectionRange(pos,pos);}});
   sec.querySelector('#sup-form').addEventListener('submit',function(e){
    e.preventDefault();var fd=new FormData(this),name=String(fd.get('name')||'').trim(),ruc=String(fd.get('ruc')||'').trim();
    if(!name){sec.querySelector('#sup-error').textContent='Ingresá el nombre o razón social.';return;}
    var dup=all.some(function(x){return String(x.id)!==String(editingId)&&String(x.name||'').trim().toLowerCase()===name.toLowerCase();});
    if(dup){sec.querySelector('#sup-error').textContent='Ya existe un proveedor con ese nombre.';return;}
    if(editing&&name.toLowerCase()!==String(editing.name).toLowerCase()&&purchasesFor(editing,s).length){sec.querySelector('#sup-error').textContent='No se puede cambiar el nombre porque ya tiene compras registradas. Conservamos el historial contable.';return;}
    var data={name:name,ruc:ruc,phone:String(fd.get('phone')||'').trim(),email:String(fd.get('email')||'').trim(),address:String(fd.get('address')||'').trim(),note:String(fd.get('note')||'').trim()};
    if(editing){Object.assign(editing,data);api.log('Actualizó proveedor '+name);}else{all.push(Object.assign({id:api.newId('sup'),active:true,createdAt:new Date().toISOString()},data));api.log('Registró proveedor '+name);}
    editingId=null;api.save();api.toast(editing?'Proveedor actualizado':'Proveedor registrado');render(sec);
   });
   if(!sec.dataset.supBound){
    sec.dataset.supBound='1';
    sec.addEventListener('click',function(e){
     var b=e.target.closest('[data-sup]');if(!b)return;var action=b.getAttribute('data-sup'),id=b.getAttribute('data-id');
     if(action==='cancel'){editingId=null;render(sec);return;}
     var item=list().filter(function(x){return String(x.id)===String(id);})[0];if(!item)return;
     if(action==='edit'){editingId=item.id;render(sec);var first=sec.querySelector('[name="name"]');if(first)first.focus();}
     if(action==='toggle'){item.active=item.active===false;api.log((item.active?'Activó':'Desactivó')+' proveedor '+item.name);api.save();api.toast(item.active?'Proveedor activado':'Proveedor desactivado');render(sec);}
    });
   }
  }
  function tile(label,value){return '<div class="tile"><div class="muted">'+esc(label)+'</div><strong class="num">'+esc(value)+'</strong></div>';}
 }
});
})();