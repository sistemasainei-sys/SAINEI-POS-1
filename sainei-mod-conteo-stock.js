(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'conteo-stock',label:'Conteo stock',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
  function esc(v){return api.escape(v==null?'':String(v));}
  function render(sec){
   var s=api.state();if(!s)return;
   var q=sec.querySelector('#cs-q')?sec.querySelector('#cs-q').value:'';
   var rows=(s.products||[]).filter(function(p){return !q||String(p.name||'').toLowerCase().indexOf(q.toLowerCase())>=0||String(p.code||'').indexOf(q)>=0;}).sort(function(a,b){return String(a.name).localeCompare(String(b.name),'es');});
   sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Conteo físico de inventario</h2><p class="muted">Registrá la cantidad real contada. El sistema calcula la diferencia y guarda un movimiento de ajuste por cada producto aplicado.</p><label>Buscar producto o código<input id="cs-q" type="search" placeholder="Nombre o código" value="'+esc(q)+'"></label><p class="muted">'+rows.length+' productos encontrados</p></div><div class="card" style="padding:16px;margin:12px 0"><div style="overflow:auto"><table class="table"><thead><tr><th>Producto</th><th class="r">Sistema</th><th class="r">Conteo real</th><th class="r">Diferencia</th><th></th></tr></thead><tbody>'+rows.map(function(p){return '<tr data-cs-row="'+p.id+'"><td>'+esc(p.name)+'<br><small class="muted">'+esc(p.code||'')+'</small></td><td class="r">'+esc(p.stock)+'</td><td class="r"><input data-cs-qty="'+p.id+'" type="number" min="0" step="0.001" inputmode="decimal" placeholder="'+esc(p.stock)+'" style="width:100px;text-align:right"></td><td class="r" data-cs-diff="'+p.id+'">—</td><td><button class="btn" data-cs-apply="'+p.id+'">Aplicar</button></td></tr>';}).join('')+'</tbody></table></div></div>';
   sec.querySelector('#cs-q').addEventListener('input',function(){var pos=this.selectionStart;render(sec);var el=sec.querySelector('#cs-q');el.focus();el.setSelectionRange(pos,pos);});
   sec.querySelectorAll('[data-cs-qty]').forEach(function(input){input.addEventListener('input',function(){var p=(s.products||[]).find(function(x){return x.id===Number(input.dataset.csQty);});var cell=sec.querySelector('[data-cs-diff="'+input.dataset.csQty+'"]');if(!p||input.value===''){cell.textContent='—';return;}var n=Number(input.value);cell.textContent=Number.isFinite(n)&&n>=0?(n-Number(p.stock)).toFixed(3):'Inválido';});});
   sec.querySelectorAll('[data-cs-apply]').forEach(function(btn){btn.addEventListener('click',function(){
    var id=Number(btn.dataset.csApply),p=(s.products||[]).find(function(x){return x.id===id;}),input=sec.querySelector('[data-cs-qty="'+id+'"]');
    if(!p||!input||input.value===''){api.toast('Ingresá la cantidad contada.');return;}
    var actual=Number(input.value);if(!Number.isFinite(actual)||actual<0){api.toast('La cantidad debe ser cero o mayor.');return;}
    var before=Number(p.stock)||0,delta=api.round3(actual-before);if(Math.abs(delta)<0.0005){api.toast('El stock ya coincide con el conteo.');return;}
    if(!window.confirm('¿Confirmás el ajuste de '+p.name+'? Existencia: '+before+' · Conteo: '+actual+' · Diferencia: '+delta.toFixed(3)+'.'))return;
    p.stock=api.round3(actual);s.moves.push({id:api.newId('move'),date:new Date().toISOString(),pid:p.id,type:'ajuste',qty:delta,note:'Conteo físico de inventario. Sistema anterior: '+before+'; conteo real: '+actual});
    if(s.moves.length>5000)s.moves.splice(0,s.moves.length-5000);
    api.log('Conteo de inventario: '+p.name+' '+before+' → '+actual);
    Promise.resolve(api.save()).then(function(ok){api.refresh();api.toast(ok===false?'No se pudo confirmar el guardado. Revisá la conexión.':'Conteo aplicado y guardado.');});
   });});
  }
 }
});
})();