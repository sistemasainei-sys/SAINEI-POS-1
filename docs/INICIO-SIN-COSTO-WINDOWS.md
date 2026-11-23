# SAINEI POS — Inicio sin costo en una PC Windows

## Objetivo

Permitir que el comercio use el servidor SAINEI POS en una computadora Windows sin contratar un plan de alojamiento pago. La computadora principal debe permanecer encendida y conectada a internet/red local mientras se usa el sistema.

## Inicio

1. Instalar Node.js 22.13 o superior en la computadora principal.
2. Copiar la carpeta completa del proyecto SAINEI POS a esa computadora.
3. Ejecutar `iniciar-sainei-pos-windows.bat`.
4. Mantener abierta la ventana del servidor mientras se trabaja.

El iniciador configura `SAINEI_DATA` en `%LOCALAPPDATA%\SAINEI-POS\datos`. La base SQLite y las copias automáticas quedan fuera de la carpeta del programa, por lo que una actualización de los archivos de la aplicación no las reemplaza.

## Acceso desde otras computadoras de la misma red

El servidor muestra las direcciones disponibles al iniciar. En las otras computadoras, abrir la dirección LAN indicada por el servidor, usando el mismo puerto. No publicar esa dirección ni abrir el puerto del router hacia internet.

## Límites importantes

- Este modo evita depender del servicio gratuito de Render para guardar la base de datos del comercio.
- La computadora principal debe estar encendida; si se apaga, las demás computadoras no podrán operar.
- El acceso desde fuera del local requiere una VPN o túnel autenticado configurado por separado. No está habilitado por este archivo.
- Las copias automáticas guardadas en la misma computadora no sustituyen una copia externa. El administrador debe descargar/exportar copias y guardarlas también en otro dispositivo o ubicación segura.
- No usar el enlace gratuito de Render para ventas reales: ese servicio puede suspenderse por inactividad y su disco no es persistente.

## Alcance

Este iniciador no instala Node.js, no configura VPN, no configura impresoras y no publica el sistema en internet. Tampoco habilita modo sin conexión: las computadoras cliente necesitan conexión con la computadora servidor para confirmar operaciones.
