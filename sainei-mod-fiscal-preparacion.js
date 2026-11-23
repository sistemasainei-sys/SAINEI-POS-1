(function(){
'use strict';
window.SAINEI_POS_MODULES=window.SAINEI_POS_MODULES||[];
window.SAINEI_POS_MODULES.push({
 init:function(api){
  api.addTab({id:'fiscal-opcional',label:'Fiscal (opcional)',canView:function(u){return !!u&&u.role==='admin';},render:function(sec){
   sec.innerHTML='<div class="card" style="padding:18px;margin:12px 0"><h2>Facturación electrónica</h2><p><strong>Estado: deshabilitado</strong></p><p class="muted">Este módulo queda reservado para una futura integración autorizada. SAINEI POS no emitirá comprobantes fiscales ni se conectará a DNIT mientras permanezca deshabilitado.</p><h3>Antes de habilitar</h3><ul><li>Confirmar RUC y datos tributarios del comercio.</li><li>Completar la habilitación y los trámites exigidos por DNIT.</li><li>Disponer de certificado o firma electrónica cuando corresponda.</li><li>Definir el sistema, ambiente de pruebas y credenciales oficiales.</li><li>Validar numeración, timbrado o CDC y respuestas del servicio oficial.</li><li>Probar contingencias, anulaciones y conservación de comprobantes.</li></ul><p class="muted">No ingreses contraseñas, claves privadas ni certificados en esta pantalla. La conexión solo debe incorporarse después de validar el procedimiento oficial y proteger las credenciales.</p><button class="btn" disabled>Integración fiscal no habilitada</button></div>';
  }});
 }
});
})();