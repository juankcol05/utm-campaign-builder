# UTM Campaign Builder Banfondesa · Mercadeo — Google Sheets

## Estado
- Google Sheets central creado y probado con una UTM real. Primer registro confirmado con consecutivo 1 y enlace corto.
- Apps Script publicado por el propietario. La URL publicada es la aplicación **/exec** indicada más abajo.
- El enlace de GitHub Pages ya redirige a esa aplicación y no consulta Supabase.
- **Pendiente de aplicar en Apps Script:** las mejoras visuales de `Index.html` y `Styles.html` guardadas en este repositorio. Tras copiarlas, crear una **nueva versión** en la implementación existente.
- Los archivos de Apps Script no se sincronizan automáticamente desde GitHub. El editor de Google contiene su propia copia.
- La implementación actual tiene permisos **Solo yo** y el servidor valida `OWNER_EMAIL`. Otros empleados no pueden usarla con sus propias cuentas hasta configurar permisos corporativos específicos.

## Enlaces
- Web histórica: https://juankcol05.github.io/utm-campaign-builder/ (redirige a Apps Script)
- Web Apps Script: https://script.google.com/macros/s/AKfycbxngeiiYUSIf4uDfLyLjox3_Sis4yaSk046KydcnsVEdu1ZI20IZskBv4g65AFOJ7DbkA/exec
- Bitácora central: https://docs.google.com/spreadsheets/d/13GH9JD9HgHQOXwFvoKFk9hUvIEbCYLHtRRL3fTxt7eQ/edit

## Archivos de Google Apps Script
- `Code.gs` — lectura, escritura, consecutivos bajo bloqueo y acortador is.gd.
- `Index.html` — formulario/dashboard y panel visual de exportaciones ordenado.
- `Styles.html` — estilos originales, con ajustes responsivos exclusivos del módulo historial.
- `Client.html` — cliente que utiliza `google.script.run`; sin Supabase ni `localStorage`.

## Actualización de los estilos del historial
1. En Apps Script, abrir `Index.html` y reemplazar el contenido íntegro por la versión de `google-apps-script/Index.html` de esta rama.
2. Hacer lo mismo para `Styles.html`, con `google-apps-script/Styles.html`.
3. Guardar ambos.
4. `Implementar > Administrar implementaciones > Editar > Versión: Nueva versión > Implementar`. Conserva el mismo enlace /exec.
5. Abrir /exec y confirmar los dos grupos visuales de botones: **Hoja compartida** y **Otras exportaciones**.
6. Comprobar que la fila 1 sigue intacta en Sheets y que el dashboard muestra el mismo total.

## Seguridad
- La implementación pública está restringida a la cuenta propietaria.
- No publicar una clave de acceso o token de Apps Script en GitHub ni activar ejecución anónima con permisos del propietario.
- Para múltiples usuarios, definir cuentas autorizadas con Google Workspace y comprobar que Google Apps Script puede identificarlas de forma segura en el modo de ejecución seleccionado.
- No hacer cambios de acceso hasta que haya autorización corporativa.
- Historial anterior preservado en la rama de respaldo `backup/supabase-before-sheets-cutover-2026-11-24`; datos del proyecto Supabase suspendidos, no copiados automáticamente a Sheets.
