# SAINEI POS — Compatibilidad de periféricos

Este documento define el alcance de conexión de impresoras, lectores y balanzas. No afirma compatibilidad con un modelo que todavía no fue identificado y probado físicamente.

## Impresoras

- La impresión disponible desde el navegador utiliza el cuadro de impresión del sistema operativo.
- Para tickets térmicos, instalar el controlador oficial del fabricante en cada PC y configurar el papel (58 mm u 80 mm) en las preferencias de impresión.
- Desactivar encabezados y pies del navegador cuando se quiera un ticket limpio.
- La impresión directa ESC/POS, el corte automático y la apertura del cajón por pulso no se consideran compatibles de forma universal; requieren integración específica por marca/modelo.

## Lectores de códigos

- Los lectores USB configurados en modo HID/teclado pueden escribir el código en el campo de búsqueda del POS.
- Configurar el lector para enviar Enter al finalizar cada lectura, si el fabricante ofrece esa opción.
- Los lectores Bluetooth deben emparejarse con el equipo y funcionar como teclado.
- Los lectores seriales/COM y los que requieren SDK propietario necesitan integración específica.

## Balanzas

- No se garantiza lectura automática de balanzas USB, seriales o Ethernet sin conocer el protocolo del fabricante.
- Como alternativa, se puede ingresar el peso manualmente en la caja o utilizar etiquetas con código de barras que incluyan el peso/precio, siempre que el formato coincida con la configuración de lectura del comercio.
- Para integrar una balanza directamente se necesita marca, modelo, interfaz (USB/RS-232/Ethernet), protocolo y ejemplo de etiqueta o trama.

## Datos necesarios para habilitar una integración específica

Registrar por cada dispositivo:
1. Marca y modelo exactos.
2. Interfaz: USB, Bluetooth, RS-232, Ethernet o Wi-Fi.
3. Sistema operativo y versión del equipo al que se conectará.
4. Controlador, SDK o manual del fabricante, si corresponde.
5. Formato de ticket, ancho de papel y funciones requeridas (corte/cajón).

## Lista de configuración en el comercio

- [ ] Instalar el controlador oficial de la impresora y seleccionarla como impresora predeterminada o específica.
- [ ] Configurar papel de 58 mm u 80 mm y márgenes.
- [ ] Conectar el lector en modo HID/teclado y definir el sufijo Enter.
- [ ] Confirmar el formato de códigos de barras que usa el comercio.
- [ ] Identificar el protocolo de la balanza antes de prometer lectura automática.
- [ ] Hacer una impresión y una lectura de código con cada equipo real antes de iniciar ventas.

**Estado:** guía preparada; configuración y compatibilidad física pendientes hasta disponer de los modelos exactos. No se habilita acceso directo a puertos ni se instalan controladores de terceros desde el POS.
