# Historial compartido — preparación técnica

Estado: rama de integración; NO está activa en producción. La versión main sigue funcionando con localStorage y el frontend original.

GitHub Pages es estático. Para mantener una misma URL web y un consecutivo global usamos PostgreSQL en Supabase. El campo id de la tabla se genera en el servidor. La secuencia no reutiliza números, pero puede tener saltos por borrados o transacciones fallidas.

## Activación
1. Conectar un proyecto de Supabase autorizado para albergar datos de campañas.
2. Ejecutar el archivo supabase/schema.sql en SQL Editor y agregar los correos permitidos en public.utm_team_members, incluyendo al menos un administrador.
3. Configurar Auth / Magic Link y permitir redirección a https://juankcol05.github.io/utm-campaign-builder/.
4. Colocar SUPABASE_URL y solamente la clave publicable en shared-config.js. No poner contraseñas, service_role ni secretos en GitHub.
5. Probar 2 usuarios autorizados, 1 no autorizado, concurrencia, CSV/TXT, acortador, eliminaciones administrativas y migración desde localStorage.
6. Solo después de validar la seguridad y los datos, fusionar esta rama a main.

## Reglas
- index.html y styles.css deben permanecer intactos.
- El primer acceso solicita un correo autorizado por un aviso nativo del navegador; no altera los campos del generador.
- Cada equipo importa su historial local una vez, usando idempotencia por client_id. Los datos locales originales se conservan.
- Solo los administradores pueden eliminar registros globales.
- Si falla el servidor, no se guarda una UTM local con un consecutivo engañoso.
- La exportación CSV/TXT debe leer todos los registros del servidor mediante paginación.
- No incluir datos personales, financieros ni credenciales en las URLs UTM.
