# Migración a Google Sheets — UTM Campaign Builder Banfondesa · Mercadeo

**Estado: preparado en GitHub y Google Sheets; requiere publicar Google Apps Script. NO activar sustitución de GitHub Pages antes de desplegar y probar.**

## Google Sheets de producción
- [Bitácora central](https://docs.google.com/spreadsheets/d/13GH9JD9HgHQOXwFvoKFk9hUvIEbCYLHtRRL3fTxt7eQ/edit)
- Pestaña: `Bitácora UTMs`, columnas A:L; primera fila con encabezados y filtros.
- Es el **único almacenamiento persistente**. El cliente no utiliza localStorage ni Supabase.
- Los consecutivos se asignan desde el servidor, bajo `LockService`; no se reutilizan tras borrar.
- El dashboard y las exportaciones se calculan a partir de los registros compartidos.
- El historial se vuelve a leer al abrir y cada 30 segundos mientras el generador está visible.
- El acortador is.gd se solicita desde Apps Script y guarda la URL corta en la misma fila.

## Configuración necesaria (solo una vez)
1. Abre la hoja de cálculo desde la cuenta Google propietaria y entra en **Extensiones > Apps Script**.
2. Copia el contenido de `google-apps-script/Code.gs` al archivo `Code.gs` del proyecto Apps Script.
3. Crea TRES archivos de tipo HTML en el mismo proyecto con los nombres **Index**, **Styles**, **Client**. Copia respectivamente el contenido de `google-apps-script/Index.html`, `Styles.html` y `Client.html`.
4. En `Code.gs`, verifica que `OWNER_EMAIL` coincida con el correo real propietario de la hoja. Si Google Drive conectado es otra cuenta, corrige este valor con el correo Google autorizado, no una cuenta ajena.
5. En Apps Script: **Implementar > Nueva implementación > Aplicación web**. Para acceso de un solo administrador, ejecutar como **Yo** y autorizar acceso a **Solo yo**. Revisa los permisos solicitados. No uses **Cualquier persona** sin un sistema de autorización probado y aprobado.
6. Abre la URL `https://script.google.com/macros/s/.../exec`, inicia sesión en la misma cuenta Google y comprueba que aparece el generador con todos sus campos actuales.
7. Crea una UTM con `https://example.com/`, `source=test`, `medium=qa`, `campaign=test_google_sheets`. Comprueba que aparece en una fila de Google Sheets, que el consecutivo coincide con el dashboard y que el acortador se guarda. Elimina la fila de prueba si es necesario.
8. Envía la URL **real y verificada** de Apps Script para configurar en GitHub Pages la redirección desde la dirección habitual del generador; nunca inventar esa URL.
9. Sólo después de la prueba, retirar la dependencia Supabase y considerar pausar el proyecto anterior. No se debe hacer antes porque la versión actual publicada depende todavía de Supabase.

## Seguridad, privacidad y acceso del equipo
- Un único correo autorizado (`OWNER_EMAIL`) restringe el acceso a **esa identidad**, no a todo el equipo. Para otras personas se requerirán identidades autorizadas y una configuración de acceso distinta (preferentemente organización Google Workspace y políticas de permisos corporativas).
- Apps Script no ofrece una forma segura de dar acceso de escritura a visitantes anónimos desde un repositorio GitHub Pages público sin una capa de autenticación/autorización. No usar una API pública de escritura ni insertar un token compartido en JavaScript.
- Con `execute as me` y `only myself` sólo el propietario autenticado podrá usar el generador. Puede abrir desde diferentes dispositivos con esa misma cuenta.
- Los registros antiguos de localStorage no se transfieren automáticamente. Respaldarlos/exportarlos antes de cerrar el sistema anterior y migrarlos de forma controlada si se necesitan.

## Limitaciones conocidas
- La conexión de ChatGPT utilizada permite administrar Google Sheets pero **no** crear/desplegar proyectos de Google Apps Script de manera remota. El despliegue requiere el paso manual anterior o una herramienta adicional.
- La URL visible de Apps Script cambia frente a GitHub Pages. El enlace original de GitHub puede servir como redireccionador una vez comprobada la URL real; no hay servicio cross-origin directo confiable de `google.script.run` desde páginas GitHub.
- Google Apps Script tiene cuotas de ejecución y `UrlFetchApp`. La sincronización periódica es un sondeo de 30 segundos, no una conexión push real.
