# Historial compartido — preparación técnica

Estado 2026-11-24: proyecto Supabase CREADO y esquema APLICADO. Base operativa, clave publicable incorporada a shared-config.js. Integración NO desplegada aún; la versión main continúa funcionando con localStorage y el frontend original.

GitHub Pages es estático. Para mantener una misma URL web y un consecutivo global usamos PostgreSQL en Supabase. El campo id de la tabla se genera en el servidor. La secuencia no reutiliza números, pero puede tener saltos por borrados o transacciones fallidas.

## Activación
1. COMPLETADO: proyecto Supabase `cipleunksqyyzaamyydm` en `us-east-1` creado dentro de la organización personal autorizada.
2. COMPLETADO: archivo `supabase/schema.sql` aplicado, RLS probado y primer administrador agregado. PENDIENTE: confirmar y agregar correos de otros usuarios autorizados.
3. PENDIENTE: en https://supabase.com/dashboard/project/cipleunksqyyzaamyydm/auth/url-configuration configurar `Site URL` y `Redirect URLs` con `https://juankcol05.github.io/utm-campaign-builder/`.
4. COMPLETADO: SUPABASE_URL y clave pública no secreta configuradas en `shared-config.js`. Nunca publicar service_role ni secretos en GitHub.
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

## Comprobaciones realizadas
- La tabla está creada y el `id` es una columna `generated always as identity`.
- Prueba transaccional de dos inserciones con IDs consecutivos; rollback y reinicio seguro de la secuencia a 1 (tabla vacía).
- Rol `anon` sin permiso SELECT; cuenta autenticada no autorizada sin filas visibles.
- Se ejecutó el asesor de seguridad de Supabase: aviso INFO de `utm_team_members` sin política, intencional porque la tabla es solo administrativa, no visible desde el cliente.
- Validación sintáctica de JavaScript; falta prueba de navegador y autenticación Magic Link.
- La tabla está vacía hasta la migración desde los dispositivos; los registros antiguos solo existen en cada navegador local, por lo que cada usuario debe ingresar desde su equipo original al menos una vez para migrarlos.
- Sin autorización explícita de seguridad corporativa, no almacenar datos bancarios internos o confidenciales en este proyecto personal.
