(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'canje-puntos',label:'Canje de puntos',canView:function(u){return !!u&&u.role==='admin';},render:render});
  api.addAction('lp-open',function(el){openRedeem(Number(el&&el.dataset&&el.dataset.id));});
  api.addAction('lp-save',saveRedeem);
  function esc(v){return api.escape(v==null?'':String(v));}
  function pointsFor(s,cid){
   var cfg=s.loyalty||{gsPerPoint:10000},rate=Math.max(1,Number(cfg.gsPerPoint)||10000);
   var sales=(s.sales||[]).filter(function(x){return !x.void&&Number(x.clientId)===cid;});
   var gross=sales.reduce(function(a,x){return a+Math.max(0,Number(x.total)||0);},0);
   var refunds=sales.reduce(function(a,x){return a+(x.returns||[]).reduce(function(b,r){return b+Math.max(0,Number(r.amount)||0);},0);},0);
   var earned=Math.floor(Math.max(0,gross-refunds)/rate);
   var used=(s.loyaltyRedemptions||[]).filter(function(x){return Number(x.clientId)===cid;}).reduce(function(a,x){return a+Math.max(0,Number(x.points)||0);},0);
   return {earned:earned,used:used,balance:Math.max(0,earned-used)};
  }
  function render(sec){
   var s=api.state();if(!s)return;
   var rows=(s.clients||[]).map(function(c){var p=pointsFor(s,Number(c.id));return {c:c,p:p};}).filter(function(x){return x.p.earned>0||x.p.used>0;}).sort(function(a,b){return b.p.balance-a.p.balance;});
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Canje de puntos</h2><p class="muted">Solo el administrador puede registrar canjes. Los puntos ganados se calculan sobre compras netas y se descuentan las devoluciones registradas.</p></div><div class="card" style="padding:16px;margin:12px 0;overflow:auto"><table class="table"><thead><tr><th>Cliente</th><th class="r">Ganados</th><th class="r">Canjeados</th><th class="r">Disponibles</th><th></th></tr></thead><tbody>'+(rows.length?rows.map(function(x){return '<tr><td>'+esc(x.c.name)+'</td><td class="r">'+x.p.earned+'</td><td class="r">'+x.p.used+'</td><td class="r"><strong>'+x.p.balance+'</strong></td><td><button class="btn" data-a="lp-open" data-id="'+x.c.id+'" '+(x.p.balance<1?'disabled':'')+'>Canjear</button></td></tr>';}).join(''):'<tr><td colspan="5">Todavía no hay puntos acumulados.</td></tr>')+'</tbody></table></div><div class="card" style="padding:16px;margin:12px 0"><h3>Historial de canjes</h3>'+(s.loyaltyRedemptions||[]).slice().reverse().map(function(x){var c=(s.clients||[]).filter(function(z){return Number(z.id)===Number(x.clientId);})[0];return '<div class="kv"><span>'+esc(c?c.name:'Cliente eliminado')+' · '+esc(x.note||'Sin detalle')+' · '+esc(x.user||'')+'</span><strong>'+Number(x.points||0)+' pts</strong></div>';}).join('')||'<p class="muted">Sin canjes registrados.</p>'+'</div>';
  }
  function openRedeem(cid){
   var s=api.state(),c=(s.clients||[]).filter(function(x){return Number(x.id)===cid;})[0];if(!c)return;
   var p=pointsFor(s,cid);
   api.openModal('<h2>Canjear puntos · '+esc(c.name)+'</h2><p class="muted">Disponibles: '+p.balance+' puntos</p><label>Puntos a canjear<input id="lp-points" class="input" type="number" min="1" max="'+p.balance+'" step="1" value="1"></label><label>Beneficio entregado<input id="lp-note" class="input" maxlength="120" placeholder="Ej.: producto de regalo o descuento"></label><p id="lp-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="lp-save" data-id="'+cid+'">Confirmar canje</button></div>');
  }
  function saveRedeem(el){
   var s=api.state(),cid=Number(el&&el.dataset&&el.dataset.id),c=(s.clients||[]).filter(function(x){return Number(x.id)===cid;})[0],inp=document.getElementById('lp-points'),note=document.getElementById('lp-note'),err=document.getElementById('lp-error');if(!c||!inp||!err)return;
   var n=Math.floor(Number(inp.value)||0),p=pointsFor(s,cid);
   if(!Number.isSafeInteger(n)||n<1||n>p.balance){err.textContent='El canje debe estar entre 1 y '+p.balance+' puntos.';return;}
   s.loyaltyRedemptions=Array.isArray(s.loyaltyRedemptions)?s.loyaltyRedemptions:[];
   var redemption={id:api.newId('move'),clientId:cid,points:n,note:String(note&&note.value||'').trim().slice(0,120),date:new Date().toISOString(),user:(api.user()||{}).name||''};s.loyaltyRedemptions.push(redemption);
   Promise.resolve(api.save()).then(function(ok){if(ok===false){s.loyaltyRedemptions=s.loyaltyRedemptions.filter(function(x){return x!==redemption;});err.textContent='El servidor no confirmó el canje. No se descontaron puntos.';return;}api.closeModal();api.refresh();api.toast('Canje registrado.');}).catch(function(){s.loyaltyRedemptions=s.loyaltyRedemptions.filter(function(x){return x!==redemption;});err.textContent='No se pudo guardar. No se descontaron puntos.';});
  }
 }
});
})();