# Mis XV de Camila

Invitación del 20 de febrero de 2027. La invitación, las fotografías, el carrusel y el panel se publican como archivos estáticos. Supabase guarda los pases y las confirmaciones.

## Uso de Camila

1. Abre `admin.html` en la dirección publicada e inicia sesión con el usuario y la contraseña compartidos para administrar los XV.
2. Descarga la plantilla o abre tu propio archivo `.xlsx`. En la hoja **Invitados**, escribe una fila por familia o por invitado individual. Si el libro tiene una sola hoja de datos, también puede usarse su primera hoja visible.
3. Selecciona el archivo en el panel. Revisa el total de familias, los boletos y los pases que se van a crear o actualizar. Pulsa **Guardar y descargar Excel con enlaces**.
4. Comparte por WhatsApp el enlace de la fila de cada familia. Al abrirlo, la familia ve su nombre, su cupo y el formulario de asistencia.
5. Para cambiar el nombre, la mesa o los boletos, edita el archivo descargado y conserva **Folio** y **Enlace**. El mismo enlace mostrará el cambio. También puedes usar **Editar** en el panel.

| Columna | Qué escribir |
| --- | --- |
| Familia o invitado | El nombre tal como aparecerá en la invitación. También se acepta el encabezado **Nombre**. |
| Boletos | Un número entero del 1 al 15. |
| Mesa | Opcional. Al omitir la columna se conserva la mesa anterior. Al vaciar una celda de esta columna se quita esa mesa. |
| Folio | Opcional la primera vez. Para dos familias con el mismo nombre, usa folios distintos como F-01 y F-02. |
| Enlace | El panel lo devuelve como un hipervínculo de Excel. Quien lo recibe puede consultar y responder por ese pase. |

En la primera carga, un nombre sin folio genera una referencia estable. También puedes volver a cargar el original si solo cambiaste boletos o mesa. Para corregir el nombre, usa la copia que ya contiene el folio. Quitar una fila del Excel deja su pase guardado. Un error en una fila detiene la carga completa y no cambia los otros pases. Un cupo inferior al número ya confirmado se señala para revisión.

El archivo devuelto conserva el orden, las demás hojas y las columnas propias de la lista. La base de datos recibe los datos del pase. **Descargar todos los pases en Excel** recupera la lista completa desde cualquier equipo con acceso al panel e incluye el estado, los nombres confirmados y los datos que cada familia haya compartido.

El acceso del panel pide **Usuario** y **Contraseña**. Usa **camila** y la contraseña de la cuenta **camila@admin.com**. El correo se utiliza internamente para Supabase Auth. La contraseña se administra en Supabase y su recuperación se realiza desde ese panel.

## Proyecto conectado y seguridad

El proyecto exclusivo de esta invitación es **XV_CAMILA**, referencia `bwwmrtxuninbqvoyuruo`, URL `https://bwwmrtxuninbqvoyuruo.supabase.co`. No usa ER_COACHING ni car-agency.

- `camila_xv.pases`: folio, token UUID aleatorio único, nombre individual/familiar, boletos (1–15), mesa, estado, confirmados, asistentes, teléfono, canción y mensaje.
- `camila_xv.organizadoras`: UUID de las cuentas Auth autorizadas. Una cuenta autenticada sin membresía no puede administrar.
- Ambas tablas tienen RLS habilitado, sin permisos directos para `anon` ni `authenticated`, y están en un esquema privado. La ausencia de políticas es intencional: denegación por defecto. Supabase Advisor puede mostrar dos avisos **informativos** `rls_enabled_no_policy`.
- La API pública ofrece `camila_xv_ver` y `camila_xv_responder`, limitadas al token recibido. No hay búsqueda de invitados por nombre ni listado público.
- `camila_xv_listar`, `camila_xv_importar` y `camila_xv_eliminar` verifican la membresía y que `session_id` siga existiendo en `auth.sessions`, incluso si el JWT aún no ha caducado tras cerrar sesión.
- Las funciones públicas usan `SECURITY INVOKER`; las operaciones privilegiadas están encapsuladas en funciones privadas, con `search_path` fijo y permisos explícitos.
- El límite de boletos, la cantidad y los nombres de asistentes se validan en PostgreSQL. La importación es transaccional; una fila inválida revierte el lote. Los tokens existentes se conservan al editar o reimportar.
- **Eliminar** requiere confirmación, borra el pase y su respuesta e invalida su enlace. Quitar filas del Excel no elimina pases.
- Las sesiones del panel usan `sessionStorage`. Las contraseñas se verifican en Supabase Auth; no se guardan en el código, archivos ni almacenamiento del navegador.

Los enlaces personalizados permiten acceder a esa invitación: compártelos únicamente con su familia. Las exportaciones contienen datos personales y enlaces; no deben subirse al repositorio.

## Cuenta administrativa genérica

La cuenta definitiva es **camila@admin.com**. Ya existe en Supabase Auth, está confirmada y fue autorizada mediante `supabase/autorizar_admin.sql`. El formulario conserva **Usuario** y **Contraseña**: escribe **camila** y la contraseña que estableciste en Supabase. El código convierte ese usuario en `camila@admin.com`; la contraseña no se copia a archivos ni a Git.

El script de autorización valida que la cuenta exista y esté confirmada, elimina otras membresías administrativas y autoriza exclusivamente esta cuenta. No crea ni elimina usuarios Auth y no modifica contraseñas. Para restablecer la contraseña, usa la administración de usuarios en Supabase.

**El registro público está deshabilitado en Supabase Auth** (`disable_signup: true`). El proveedor Email permanece habilitado para iniciar sesión con cuentas existentes y los accesos anónimos de Auth están deshabilitados. Se comprobó que `/auth/v1/signup` responde `signup_disabled`. Los invitados usan su token de invitación y no necesitan registrarse ni iniciar sesión.

Para recuperar la cuenta si se elimina: Authentication → Users → Add user → Create new user, correo `camila@admin.com`, contraseña segura y **Auto Confirm User** activado; después ejecuta `supabase/autorizar_admin.sql`. Mantén desactivado **Allow new users to sign up**. Esta opción se administra en el dashboard; no es una variable pública ni un cambio de SQL.

## Configuración y migraciones

`assets/js/config.js` contiene únicamente la URL y la clave **publicable**, que puede estar en Git. El sitio es estático; no lee `.env` en el navegador. La clave secreta y `service_role` nunca deben copiarse a este archivo.

Para regenerar la configuración pública con Node 22 o posterior:

```bash
cp .env.example .env
node --env-file=.env scripts/configure.mjs
```

`INVITATION_URL` vacío hace que los enlaces apunten al mismo directorio que `admin.html`. En localhost serán enlaces locales. Para distribuir invitaciones, genera el Excel desde el sitio publicado o configura la URL final completa, terminada en `/`.

La migración aplicada mediante MCP está en `supabase/migrations/20261125032250_camila_pases_seguros.sql`. `supabase/instalar.sql` conserva una copia idéntica compatible con SQL Editor; una prueba evita divergencias. No vuelvas a instalarla en este proyecto: ya está aplicada y registrada. Para otro entorno vacío, aplica una de las dos copias, no ambas. No expongas `camila_xv` en Data API; conserva `public` como esquema de API.

## Desarrollo y validación

No hace falta compilar el sitio. Para probarlo localmente:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000/admin.html`. Las herramientas de pruebas requieren Node 22 y Chrome instalado:

```bash
npm ci
npm test
node tests/visual.mjs
node tests/auth-settings.mjs
node tests/live.mjs
```

`npm test` comprueba recursos, rutas, anclas, configuración y correspondencia de migraciones. `visual.mjs` prueba música, carruseles, lightbox y el correo que envía el formulario, y genera capturas ignoradas por Git en `test-results/`. `auth-settings.mjs` verifica la configuración de Auth y el rechazo real de registros públicos; no intenta un registro si la opción sigue habilitada.

`live.mjs` es una prueba de integración supervisada contra **XV_CAMILA**. Genera una contraseña temporal exclusivamente en memoria, publica su hash bcrypt y pausa para crear/autorizar una cuenta ficticia por SQL. La infraestructura de QA debe crear la fila de `auth.users` con email confirmado y su identidad `email` de `auth.identities`; no se modifica la cuenta real. En su segunda pausa se revoca la membresía QA para probar el rechazo de cuentas autenticadas sin autorización. Al finalizar se elimina el usuario temporal por su UUID exacto. El script elimina los pases de su prefijo, cierra la sesión y nunca imprime la contraseña ni el JWT. Si se interrumpe, elimina también los registros del prefijo QA indicado al iniciar. No ejecutes estas pruebas con datos reales.

## Resultado de validación — 24 de noviembre de 2026

| Área | Resultado |
| --- | --- |
| Inicio/cierre de sesión y contraseña incorrecta | Correcto con cuenta temporal; JWT rechazado después del cierre confirmado |
| Registro público | Deshabilitado; endpoint de Auth rechaza con `signup_disabled` |
| Crear, editar y eliminar individuales/familias | Correcto; eliminar invalida el enlace |
| Excel: importar, reimportar y exportar | Correcto; enlaces únicos y estables, lote inválido revertido |
| Invitación personalizada y asistencia | Correcto; acepta asistencia y rechazo con persistencia real |
| Límite de boletos | Correcto en UI y API; tampoco permite reducir por debajo de lo confirmado |
| Recarga de invitación y panel | Datos y sesión recuperados correctamente |
| Acceso no autorizado | Anónimo y usuario autenticado sin membresía rechazados; metadatos falsificados no conceden acceso |
| Vista móvil | Chrome con tamaños de 320, 390 y 768 px, sin desbordamiento horizontal de página |
| Recursos y presentación | 117 archivos visuales idénticos al origen; música, carruseles y lightbox operativos |
| Limpieza | Sin pases, cuentas QA ni sesiones de prueba restantes; la cuenta definitiva se conserva |

Cuatro pruebas estáticas correctas, cero errores JavaScript detectados y cero vulnerabilidades en las dependencias de desarrollo conservadas. La prueba móvil usa emulación de Chrome, no dispositivos físicos. Security Advisor reportó los dos avisos informativos por denegación RLS descritos arriba y una advertencia: la [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) está desactivada en Auth. Este ajuste adicional queda disponible en el dashboard. Performance Advisor no reportó hallazgos.

La cuenta definitiva está autorizada y el registro público fue deshabilitado y verificado. El inicio/cierre y las operaciones se probaron con una cuenta temporal independiente; no se solicitó ni cambió la contraseña real. Antes de publicar, prueba también tu acceso **camila** con tu contraseña.

Para tu revisión local, deja el servidor del comando anterior ejecutándose:

- Panel: http://127.0.0.1:8000/admin.html
- Invitación: http://127.0.0.1:8000/
- Invitación personalizada: usa **Ver** en el panel; genera `/?invitado=TOKEN` con el token real de ese pase.

Los cambios que hagas en el panel local se guardan en el proyecto real de Supabase. Los enlaces generados localmente apuntan a `127.0.0.1`; para enviarlos a invitados, expórtalos desde la URL pública después de autorizar la publicación.

## GitHub y publicación

Repositorio existente: https://github.com/AlexHS2904/XV_CAMILA

GitHub Pages está configurado con **main / (root)**. Cada push a `main` activa automáticamente `pages-build-deployment` y publica en https://alexhs2904.github.io/XV_CAMILA/.

Esta actualización se entrega en la rama `revision/supabase-camila`, para revisión antes de publicar. El historial y la configuración de despliegue se conservan. **Fusionar esta rama a `main` publicará automáticamente**; no se ha realizado despliegue manual ni cambiado la fuente de Pages.

La versión fuente se tomó de `XV_CAMILA 3`. El HTML de la invitación, estilos, imágenes, audio, animaciones, galería y JavaScript visual se conservaron byte por byte. Solo se completaron conexión, administración, seguridad, documentación y pruebas.

La lista antigua guardada en un navegador puede migrarse desde su exportación CSV: ábrela en Excel, guárdala como `.xlsx` e impórtala. Se reconocen `Codigo`, `Invitado_Familia` y `Boletos_Asignados`. Las confirmaciones se registran cuando cada familia responde desde su nuevo enlace.
