# SAINEI POS para Windows

Este paquete prepara una aplicación de escritorio que ejecuta el servidor local de SAINEI POS y abre la interfaz en una ventana propia.

## Datos del comercio
La base SQLite y las copias se guardan en la carpeta de datos de usuario de Windows de la aplicación, separada de los archivos instalados. Desinstalar la aplicación no debe eliminar esa carpeta. Las copias de seguridad siguen siendo necesarias ante daños o formateo del disco.

## Preparar el instalador
Desde esta carpeta, en una computadora Windows con Node.js 22.13 o superior:

```powershell
npm install
npm run build:win
```

El instalador NSIS se genera en `desktop/dist`.

## Importante
Esta primera estructura debe superar pruebas en Windows antes de distribuirse comercialmente: inicio, creación de administrador, ventas sin internet, cierre/reapertura, desinstalación/reinstalación conservando datos y restauración de copias.
