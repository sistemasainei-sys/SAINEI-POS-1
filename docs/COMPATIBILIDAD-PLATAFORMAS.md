# Compatibilidad de plataformas — SAINEI POS

## Alcance acordado

SAINEI POS tendrá una instalación principal sencilla en Windows 10 y Windows 11. Los demás dispositivos podrán ingresar como cajas o puestos de consulta mediante un navegador compatible, sin instalar Node.js ni crear otra base de datos.

| Dispositivo | Uso previsto | Requisito |
|---|---|---|
| PC Windows 10 | Servidor principal o caja cliente | Windows 10 actualizado; servidor requiere Node.js 22.13 o superior |
| PC Windows 11 | Servidor principal o caja cliente | Servidor requiere Node.js 22.13 o superior |
| Mac | Caja cliente / consulta | Navegador moderno |
| iPhone | Caja cliente / consulta | Safari actualizado |
| iPad | Caja cliente / consulta | Safari actualizado |
| Android | Caja cliente / consulta | Chrome u otro navegador moderno |
| Tablet | Caja cliente / consulta | Navegador moderno |

## Instalación y conexión local

1. Instalar SAINEI POS en una PC con Windows 10 u 11. Esa computadora será el servidor principal del comercio.
2. Conectar los demás equipos a la misma red Wi-Fi o cableada.
3. Abrir desde cada dispositivo el navegador e ingresar a la dirección local del servidor.
4. Iniciar sesión con el usuario autorizado para ese puesto.

Las cajas comparten la información del servidor. No se debe crear una base de datos independiente en cada dispositivo. La computadora principal debe permanecer encendida para que las demás cajas registren operaciones.

## Límites que no se deben ocultar

- El instalador de servidor disponible en esta versión es para Windows 10/11. Mac, iPhone, iPad y Android se contemplan como clientes web; no se declara que puedan alojar el servidor local.
- El acceso desde fuera del comercio (por ejemplo, desde la casa) requiere habilitar y probar HTTPS y un acceso remoto seguro. No se debe abrir el puerto del POS directamente a Internet.
- La instalación como aplicación/PWA depende del navegador y de que el sitio se sirva en un contexto seguro. En la red local por HTTP, se puede usar el POS desde el navegador aunque el navegador no permita instalarlo como aplicación.
- Impresoras, lectores y balanzas dependen del sistema operativo, navegador, controlador y modelo. Deben probarse físicamente antes de iniciar ventas reales.
- La compatibilidad visual adaptable está preparada en la interfaz mediante viewport móvil y reglas CSS para pantallas de hasta 480, 700, 800 y 900 píxeles; esto no sustituye pruebas reales en cada dispositivo.

## Criterio de aceptación

- [ ] Instalación limpia en Windows 10.
- [ ] Instalación limpia en Windows 11.
- [ ] Servidor Windows y caja cliente Windows en la misma red.
- [ ] Acceso desde Safari en iPhone y iPad.
- [ ] Acceso desde Android.
- [ ] Acceso desde navegador en Mac.
- [ ] Verificar ventas, stock, caja y reportes sincronizados entre puestos.
- [ ] Probar impresora y lector reales del comercio.
- [ ] Probar respaldo y restauración antes de usar datos comerciales reales.

**Estado:** alcance y documentación incorporados en la rama de compatibilidad. Las pruebas físicas y la publicación siguen pendientes; no se declara compatibilidad validada hasta ejecutarlas.
