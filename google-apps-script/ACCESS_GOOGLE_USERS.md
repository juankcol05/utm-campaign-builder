# Acceso al generador con cuentas Google autorizadas

## Antes de activar
- En la versión actual la aplicación se abrió bajo la cuenta propietaria. Esta rama prepara acceso con cuentas Google individuales y una lista autorizada.
- No publicar sin haber agregado los correos y compartido la hoja con ellos.
- Google Apps Script no garantiza el correo de usuario en una aplicación web ejecutada como propietario, así que **Ejecutar como: Usuario que accede** es obligatorio.
- El servicio de Apps Script usará los permisos Google del usuario. Para guardar en la hoja central cada cuenta autorizada debe tener permiso **Editor** en la hoja; no basta el permiso Lector. Esto también permite editar los registros directamente desde Sheets, por lo que no equivale a permisos de "solo formulario".

## Configuración
1. Crear y verificar lista de correos del equipo en `ALLOWED_EMAILS` (minúsculas), dentro de `Code.gs`.
2. Abrir https://docs.google.com/spreadsheets/d/13GH9JD9HgHQOXwFvoKFk9hUvIEbCYLHtRRL3fTxt7eQ/edit, pulsar Compartir y otorgar **Editor** solamente a las cuentas de esa lista, después de validar autorización corporativa.
3. En Apps Script, pegar este `Code.gs` y guardar. Los otros archivos (`Index.html`, `Styles.html`, `Client.html`) continúan como están.
4. `Implementar > Administrar implementaciones > Editar > Versión: Nueva versión`.
5. Configurar **Ejecutar como: Usuario que accede a la aplicación web**; **Quién tiene acceso: Cualquier usuario con una cuenta Google**. Ese último ajuste permite intentar entrar, pero `requireUser_` deniega acceso si no está en `ALLOWED_EMAILS`.
6. Publicar nueva versión de la misma implementación. Conservar la URL terminada en /exec y el enlace de GitHub Pages que la redirige.
7. En navegador privado, probar un correo **autorizado**; debe iniciar sesión, aceptar permisos, poder generar una UTM y verla en Sheets. Probar después un correo **no autorizado**; debe recibir `Acceso denegado` y no consultar datos.
8. Probar dos usuarios simultáneos. LockService mantiene la asignación única; los números pueden saltarse si se borra un registro.
9. No solicitar a los colaboradores el inicio de sesión con la cuenta principal; cada persona utiliza su propia cuenta de Google.

## Riesgo y límite de esta modalidad
- Cada Editor autorizado tiene acceso de edición directa al Google Sheets, no sólo al formulario.
- Para un banco donde los colaboradores no deben tener derecho a manipular el inventario, usar una solución administrada del dominio Google Workspace o backend que separe permisos de lectura y escritura.
- Si Google Workspace bloquea autorizaciones de Apps Script o los colaboradores usan correos de otros dominios, solicitar aprobación de TI.
- Los usuarios autorizados pueden ver las URLs UTM; no incluir identificadores de clientes ni información confidencial.
