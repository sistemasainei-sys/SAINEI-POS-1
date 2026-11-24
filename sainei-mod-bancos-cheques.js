(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({init:function(api){
 api.addTab({id:'bancos-cheques',label:'Bancos y cheques',canView:function(u){return u&&['admin','encargado'].indexOf(u.role)>=0;},render:render});
 var editing=0;
 function esc(v){return api.escape(v==null?'':String(v));}
 function money(v){return api.money(Math.round(Number(v)||0));}
 function rows(){var s=api.state();s.bankEntries=Array.isArray(s.bankEntries)?s.bankEntries:[];return s.bankEntries.slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))||b.id-a.id;});}
 function render(sec){
  var a=rows(),bank=a.filter(function(x){return x.kind==='movimiento';}),checks=a.filter(function(x){return x.kind==='cheque';});
  var balance=bank.reduce(function(t,x){return t+(x.direction==='entrada'?Number(x.amount): -Number(x.amount));},0);
  var pending=checks.filter(function(x){return ['emitido','depositado'].indexOf(x.status)>=0;}).reduce(function(t,x){return t+Number(x.amount||0);},0);
  sec.innerHTML='<div class="card" style="padding:16px;margin:12px 0"><h2>Bancos y cheques</h2><p class="muted">Libro interno de movimientos y seguimiento de cheques. Registrá los movimientos según el extracto bancario; no se conecta automáticamente con el banco.</p><div class="tiles">'+tile('Movimientos',bank.length)+tile('Saldo neto registrado',money(balance))+tile('Cheques pendientes',money(pending))+'</div><div class="actions"><button class="btn primary" data-bank="new-move">Registrar movimiento</button><button class="btn" data-bank="new-check">Registrar cheque</button><button class="btn" data-bank="csv">Exportar CSV</button></div></div><div class="card" style="padding:14px;margin:12px 0"><h3>Movimientos bancarios</h3>'+table(bank,false)+'</div><div class="card" style="padding:14px;margin:12px 0"><h3>Cheques</h3>'+table(checks,true)+'</div>';
  sec.querySelectorAll('[data-bank]').forEach(function(b){b.addEventListener('click',function(){var a=b.dataset.bank;if(a==='new-move')form(sec,'movimiento');if(a==='new-check')form(sec,'cheque');if(a==='csv')csv();});});
  sec.querySelectorAll('[data-bank-status]').forEach(function(b){b.addEventListener('click',function(){status(Number(b.dataset.id),b.dataset.bankStatus);});});
 }
 function tile(l,v){return '<div class="tile"><div class="muted">'+esc(l)+'</div><strong>'+esc(v)+'</strong></div>';}
 function table(a,isCheck){
  if(!a.length)return '<p class="muted">Todavía no hay registros.</p>';
  return '<div style="overflow:auto"><table class="table"><thead><tr><th>Fecha</th><th>Banco / cuenta</th><th>Detalle</th><th>Referencia</th><th class="r">Importe</th><th>Estado</th>'+(isCheck?'<th>Acción</th>':'')+'</tr></thead><tbody>'+a.map(function(x){
   var actions=isCheck&&x.status!=='anulado'?'<td><select class="input" data-bank-status="'+esc(x.status)+'" data-id="'+x.id+'"><option value="emitido" '+(x.status==='emitido'?'selected':'')+'>Emitido</option><option value="depositado" '+(x.status==='depositado'?'selected':'')+'>Depositado</option><option value="cobrado" '+(x.status==='cobrado'?'selected':'')+'>Cobrado</option><option value="rechazado" '+(x.status==='rechazado'?'selected':'')+'>Rechazado</option><option value="anulado" '+(x.status==='anulado'?'selected':'')+'>Anulado</option></select></td>':'';
   return '<tr><td>'+esc(date(x.date))+'</td><td>'+esc(x.account)+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.reference||x.checkNo||'—')+'</td><td class="r">'+(x.direction==='salida'?'− ':'')+money(x.amount)+'</td><td>'+esc(x.status|| (x.reconciled?'Conciliado':'Pendiente'))+'</td>'+actions+'</tr>';
  }).join('')+'</tbody></table></div>';
 }
 function form(sec,kind){
  editing=kind;
  api.openModal('<h2>'+ (kind==='cheque'?'Registrar cheque':'Registrar movimiento bancario')+'</h2><div class="form"><label>Fecha<input id="bk-date" type="date" class="input" value="'+new Date().toISOString().slice(0,10)+'"></label><label>Banco / cuenta<input id="bk-account" class="input" maxlength="80" placeholder="Banco y cuenta"></label><label>Detalle<input id="bk-desc" class="input" maxlength="120" placeholder="Concepto"></label><label>Importe (Gs.)<input id="bk-amount" class="input" type="number" min="1" step="1"></label>'+(kind==='movimiento'?'<label>Tipo<select id="bk-direction" class="input"><option value="entrada">Ingreso</option><option value="salida">Egreso</option></select></label><label>Referencia / N° comprobante<input id="bk-ref" class="input" maxlength="80"></label>':'<label>Número de cheque<input id="bk-check" class="input" maxlength="40"></label><label>Beneficiario<input id="bk-payee" class="input" maxlength="100"></label>')+'</div><p id="bk-error" class="err"></p><div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" id="bk-save">Guardar</button></div>',{wide:true});
  document.getElementById('bk-save').onclick=function(){
   var date=document.getElementById('bk-date').value,account=document.getElementById('bk-account').value.trim(),description=document.getElementById('bk-desc').value.trim(),amount=Number(document.getElementById('bk-amount').value),error=document.getElementById('bk-error');
   var checkNo=kind==='cheque'?document.getElementById('bk-check').value.trim():'',payee=kind==='cheque'?document.getElementById('bk-payee').value.trim():'';
   if(!date||!account||!description||!Number.isSafeInteger(amount)||amount<=0||(kind==='cheque'&&(!checkNo||!payee))){error.textContent='Completá los campos y verificá el importe entero mayor a cero.';return;}
   var entry={id:api.newId('bank'),kind:kind,date:new Date(date+'T12:00:00').toISOString(),account:account,description:description,amount:amount,direction:kind==='cheque'?'salida':document.getElementById('bk-direction').value,reference:kind==='movimiento'?document.getElementById('bk-ref').value.trim():'',checkNo:checkNo,payee:payee,status:kind==='cheque'?'emitido':'pendiente',reconciled:false};
   var st=api.state();st.bankEntries=Array.isArray(st.bankEntries)?st.bankEntries:[];st.bankEntries.push(entry);
   Promise.resolve(api.save()).then(function(ok){if(ok===false){st.bankEntries=st.bankEntries.filter(function(x){return x!==entry;});error.textContent='No se confirmó el guardado en el servidor.';return;}api.closeModal();api.refresh();api.toast('Registro bancario guardado.');}).catch(function(){st.bankEntries=st.bankEntries.filter(function(x){return x!==entry;});error.textContent='No se pudo guardar. Revisá la conexión.';});
  };
 }
 function status(id,next){
  var s=api.state(),x=(s.bankEntries||[]).filter(function(z){return Number(z.id)===id&&z.kind==='cheque';})[0];if(!x)return;
  var prev=x.status;if(['emitido','depositado','cobrado','rechazado','anulado'].indexOf(next)<0)return;
  x.status=next;x.reconciled=next==='cobrado';
  Promise.resolve(api.save()).then(function(ok){if(ok===false){x.status=prev;return;}api.refresh();api.toast('Estado del cheque actualizado.');}).catch(function(){x.status=prev;});
 }
 function date(v){var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('es-PY');}
 function csv(){
  var a=rows(),head=['Fecha','Tipo','Banco/cuenta','Detalle','Referencia','Importe','Dirección','Estado'];
  var lines=[head].concat(a.map(function(x){return [date(x.date),x.kind,x.account,x.description,x.reference||x.checkNo,x.amount,x.direction,x.status];}));
  var csv=lines.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),ael=document.createElement('a');ael.href=url;ael.download='sainei-pos-bancos-cheques.csv';ael.click();URL.revokeObjectURL(url);
 }
}});
})();
