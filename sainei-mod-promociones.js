(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({init:function(api){
  function list(){var s=api.state();s.check=s.check||{};s.check.saineiPromotions=Array.isArray(s.check.saineiPromotions)?s.check.saineiPromotions:[];return s.check.saineiPromotions;}
  function esc(v){return api.escape(String(v==null?'':v));}
  function active(p){var n=new Date(),a=p.from?new Date(p.from+'T00:00:00'):null,b=p.to?new Date(p.to+'T23:59:59'):null;return p.enabled!==false&&(!a||n>=a)&&(!b||n<=b);}
  function render(){var root=document.getElementById('v-promociones');if(!root)return;var admin=api.isAdmin(),items=list();
    root.innerHTML='<div class="section-head"><div><h2>Promociones y cupones</h2><p>Descuentos porcentuales con vigencia y control de permisos.</p></div></div>'+
    '<div class="card"><h3>Aplicar cupón</h3><label>Código del cupón<input id="saineiCoupon" maxlength="24" autocomplete="off" placeholder="BIENVENIDO10"></label><button class="primary" data-a="saineiCouponApply">Aplicar al ticket actual</button><p class="muted">Respeta el límite de descuento autorizado para tu usuario.</p></div>'+
    (admin?'<div class="card"><h3>Crear promoción</h3><div class="form-grid"><label>Código<input id="saineiPromoCode" maxlength="24" placeholder="VERANO10"></label><label>Descuento (%)<input id="saineiPromoPct" type="number" min="1" max="100" value="10"></label><label>Desde<input id="saineiPromoFrom" type="date"></label><label>Hasta<input id="saineiPromoTo" type="date"></label></div><button class="primary" data-a="saineiPromoAdd">Guardar promoción</button></div>':'')+
    '<div class="card"><h3>Promociones registradas</h3><div class="table-wrap"><table><thead><tr><th>Código</th><th>Descuento</th><th>Vigencia</th><th>Estado</th>'+(admin?'<th></th>':'')+'</tr></thead><tbody>'+
    (items.length?items.map(function(p){return '<tr><td><strong>'+esc(p.code)+'</strong></td><td>'+Number(p.percent)+'%</td><td>'+esc(p.from||'Sin inicio')+' – '+esc(p.to||'Sin vencimiento')+'</td><td>'+(active(p)?'Activa':'Inactiva/vencida')+'</td>'+(admin?'<td><button data-a="saineiPromoToggle" data-v="'+esc(p.id)+'">'+(p.enabled===false?'Activar':'Desactivar')+'</button></td>':'')+'</tr>';}).join(''):'<tr><td colspan="'+(admin?5:4)+'">Todavía no hay promociones.</td></tr>')+'</tbody></table></div></div>';
  }
  api.addAction('saineiPromoAdd',function(){if(!api.isAdmin())return;var code=(document.getElementById('saineiPromoCode').value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,''),pct=Number(document.getElementById('saineiPromoPct').value),from=document.getElementById('saineiPromoFrom').value,to=document.getElementById('saineiPromoTo').value;
    if(code.length<3||!Number.isFinite(pct)||pct<=0||pct>100||(from&&to&&from>to)){api.toast('Revisá código, porcentaje y fechas.');return;}var a=list();if(a.some(function(p){return p.code===code;})){api.toast('Ese código ya existe.');return;}a.push({id:api.newId('promo'),code:code,percent:pct,from:from,to:to,enabled:true,createdAt:new Date().toISOString()});api.save();render();api.toast('Promoción guardada.');});
  api.addAction('saineiPromoToggle',function(el){if(!api.isAdmin())return;var p=list().find(function(x){return String(x.id)===String(el.getAttribute('data-v'));});if(!p)return;p.enabled=p.enabled===false;api.save();render();api.toast('Estado actualizado.');});
  api.addAction('saineiCouponApply',function(){var code=(document.getElementById('saineiCoupon').value||'').trim().toUpperCase(),p=list().find(function(x){return x.code===code&&active(x);});if(!p){api.toast('Cupón inválido, inactivo o fuera de vigencia.');return;}if(!api.applyDiscount(p.percent)){api.toast('El descuento supera el límite permitido para tu usuario.');return;}api.log('Aplicó cupón '+p.code+' ('+p.percent+'%)');api.save();api.toast('Cupón aplicado: '+p.percent+'%.');});
  api.addTab({id:'promociones',label:'Promociones',canView:true,render:render});
}});
})();