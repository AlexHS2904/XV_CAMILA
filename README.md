# Mis XV de Camila

Invitación del 20 de febrero de 2027. La invitación, las fotografías, el carrusel y el panel se publican como archivos estáticos. Supabase guarda los pases y las confirmaciones.

## Uso del panel

Inicia sesión con **camila** y la contraseña de **camila@admin.com**. La contraseña se administra exclusivamente en Supabase Auth.

1. En **Agregar familia o invitado**, escribe el nombre, los boletos (1–15) y, opcionalmente, la mesa. **Crear invitación** limpia el formulario y ofrece copiar o abrir el enlace guardado.
2. Consulta las estadísticas y busca en la lista por nombre. Puedes filtrar por respuesta, ordenar por nombre, mesa, boletos o estado y consultar los detalles. La lista muestra 12 invitaciones por página y tarjetas en móvil.
3. **Editar** conserva el enlace y las respuestas. **Eliminar** pide confirmación e invalida el enlace.
4. Para muchas familias, descarga la plantilla, completa una fila por familia y selecciona el Excel. Revisa las filas nuevas, actualizadas, sin cambios o con conflictos antes de guardar.
5. Descarga el Excel con enlaces y compártelos individualmente. Para cambios posteriores, utiliza esa copia exportada.

### Estadísticas

Los indicadores se calculan sobre todos los pases guardados, independientemente del filtro o la página de la lista.

| Indicador | Cálculo |
| --- | --- |
| Invitaciones generadas | Número de pases individuales o familiares |
| Boletos asignados | Suma del cupo de todos los pases |
| Boletos confirmados | Suma de personas confirmadas |
| Boletos pendientes | Cupo de los pases que todavía no respondieron |
| Boletos no utilizados | Cupo menos asistentes de los pases que ya respondieron, incluidos los rechazos |
| Familias respondidas / pendientes / que no asistirán | Número de pases en cada categoría |
| Porcentaje de confirmación | Boletos confirmados / boletos asignados |
| Porcentaje de respuesta | Invitaciones respondidas / invitaciones generadas |

Siempre se cumple **asignados = confirmados + pendientes + no utilizados**. Una familia con seis boletos que confirma cuatro aporta cuatro confirmados y dos no utilizados. **Confirmados** incluye respuestas parciales; el filtro **Confirmación parcial** permite verlas por separado.

La lista y el dashboard se actualizan después de las operaciones del panel, al recuperar el foco y cada 30 segundos mientras la pestaña está visible y la sesión activa. **Actualizar** permite hacerlo manualmente. Se usa consulta periódica para evitar suscripciones y permisos adicionales de Realtime. Si falla la conexión se conserva la última lectura y se indica que no pudo actualizarse.

### Excel e identidad de las invitaciones

La plantilla muestra únicamente **Familia o invitado**, **Boletos** y **Mesa**. Los identificadores se generan automáticamente; el organizador no debe escribir folios.

- La exportación incluye una columna **ID de invitación** oculta. Conserva esa columna y los enlaces para actualizar nombres, mesas o cupos sin cambiar de invitación.
- Volver a importar exactamente el archivo original conserva las identidades calculadas a partir del archivo, hoja y fila. Dos filas con el mismo nombre reciben identidades distintas.
- Un archivo nuevo o modificado que no contiene identidades y coincide por nombre con pases existentes requiere elegir cuál actualizar o crear una familia independiente. El nombre nunca se utiliza como identificador único. Para evitar resolver estas coincidencias, trabaja sobre el Excel exportado.
- La vista previa bloquea IDs eliminados, enlaces incompatibles, dos filas que apunten al mismo pase y cupos inferiores a la asistencia ya confirmada.
- La importación solo cambia nombre, cupo y mesa. **Nunca sobrescribe asistentes, estados, respuestas ni fechas de confirmación**. Omitir la columna Mesa conserva la anterior; vaciar una celda de Mesa la elimina.
- Quitar filas del Excel no elimina pases. Una fila inválida revierte la operación completa.

El archivo devuelto después de importar conserva las columnas adicionales del organizador y las otras hojas. Esas columnas adicionales permanecen en el archivo, no se almacenan como campos de Supabase. **Exportar invitaciones** recupera todos los pases actuales e incluye nombre, boletos asignados y confirmados, mesa, asistencia, enlace, asistentes, teléfono, canción, mensaje y fecha de confirmación.

Los archivos usan encabezados azules, filas alternadas, anchos adecuados, primera fila inmovilizada, filtros, tabla y colores por estado. Los enlaces muestran **Ver invitación** y son clicables. La exportación completa no agrega filas vacías. Las fechas se muestran en la zona horaria de Ciudad de México. El ID oculto sigue siendo un dato administrativo; el token del enlace es el que permite acceder al pase.

### Confirmación del invitado

Después de guardar en Supabase se abre `?invitado=TOKEN#respuesta-guardada`, con los datos devueltos por la base de datos. La pantalla distingue asistencia y rechazo, muestra el cupo, asistentes y un resumen de respuestas. Al recargar vuelve a consultar el mismo token. **Editar mi respuesta** precarga la respuesta existente y actualiza el mismo pase. Un error de guardado mantiene el formulario y no muestra éxito.

## Proyecto conectado y seguridad

El proyecto exclusivo de esta invitación es **XV_CAMILA**, referencia `bwwmrtxuninbqvoyuruo`, URL `https://bwwmrtxuninbqvoyuruo.supabase.co`. No usa ER_COACHING ni car-agency.

- `camila_xv.pases`: folio, token UUID aleatorio único, nombre individual/familiar, boletos (1–15), mesa, estado, confirmados, asistentes, teléfono, canción, mensaje y fecha real de última confirmación (`confirmado_en`).
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

`INVITATION_URL` vacío hace que los enlaces apunten al mismo directorio que `admin.html`. En localhost serán enlaces locales. Para distribuir invitaciones, genera el Excel desde el sitio publicado o configura la URL final completa, terminada en `/`: `https://alexhs2904.github.io/XV_CAMILA/`. En una página pública se rechaza una configuración que produzca enlaces de localhost. La prueba automatizada comprueba que se conserve la carpeta `/XV_CAMILA/` de GitHub Pages.

Migraciones aplicadas mediante MCP únicamente a XV_CAMILA:

1. `20261125032250_camila_pases_seguros.sql`: tablas, permisos y funciones iniciales. `supabase/instalar.sql` es una copia idéntica de esta base, compatible con SQL Editor.
2. `20261125044648_fecha_confirmacion.sql`: agrega `confirmado_en` y actualiza la función de respuesta para escribir la hora del servidor. Conserva los permisos, el bloqueo de fila y la validación del cupo. Las respuestas históricas sin fecha permanecen en NULL hasta su próxima actualización; no se inventan fechas.

No vuelvas a instalarlas en este proyecto: ambas están registradas. Para un entorno vacío aplica las migraciones en orden, o `instalar.sql` seguido de la segunda migración; no dupliques la base. No se crearon tablas adicionales para esta mejora. No expongas `camila_xv` en Data API; conserva `public` como esquema de API.

## Desarrollo y validación

No hace falta compilar el sitio. Para probarlo localmente:

```bash
npm run preview
```

Abre `http://127.0.0.1:8000/admin.html`. Las herramientas de pruebas requieren Node 22 y Chrome instalado:

```bash
npm ci
npm test
node tests/excel-browser.mjs
node tests/admin-browser.mjs
node tests/admin-visual.mjs
node tests/confirmation-visual.mjs
node tests/cache-browser.mjs
node tests/visual.mjs
node tests/auth-settings.mjs
node tests/live.mjs
```

`npm test` ejecuta once pruebas sobre recursos, rutas, anclas, configuración, migración base, estadísticas, identidades de importación y URL pública. `excel-browser.mjs` comprueba el ciclo exportar/reimportar, familias con nombres iguales, IDs ocultos, enlaces, fechas, estilos y rangos del archivo OOXML, sin crear datos en Supabase. `admin-browser.mjs` simula consultas simultáneas y fallos de actualización después de guardar, y verifica la alineación móvil del formulario. `visual.mjs` prueba música, carruseles, lightbox y el correo que envía el formulario, y genera capturas ignoradas por Git en `test-results/`. `auth-settings.mjs` verifica la configuración de Auth y el rechazo real de registros públicos; no intenta un registro si la opción sigue habilitada.

`live.mjs` es una prueba de integración supervisada contra **XV_CAMILA**. Genera una contraseña temporal exclusivamente en memoria, publica su hash bcrypt y pausa para crear/autorizar una cuenta ficticia por SQL. La infraestructura de QA debe crear la fila de `auth.users` con email confirmado y su identidad `email` de `auth.identities`; no se modifica la cuenta real. En su segunda pausa se revoca la membresía QA para probar el rechazo de cuentas autenticadas sin autorización. Al finalizar se elimina el usuario temporal por su UUID exacto. El script elimina los pases de su prefijo, cierra la sesión y nunca imprime la contraseña ni el JWT. Si se interrumpe, elimina también los registros del prefijo QA indicado al iniciar. No ejecutes estas pruebas con datos reales.

## Resultado de validación — 24 de noviembre de 2026

| Área | Resultado |
| --- | --- |
| Inicio/cierre de sesión y contraseña incorrecta | Correcto con cuenta temporal; JWT rechazado después del cierre confirmado |
| Registro público | Deshabilitado; endpoint de Auth rechaza con `signup_disabled` |
| Crear, editar y eliminar individuales/familias | Correcto; eliminar invalida el enlace |
| Excel: importar, reimportar y exportar | Original y exportación sin duplicados; familias iguales independientes, resolución explícita de conflictos y columnas adicionales conservadas |
| Dashboard | Totales consistentes, confirmación parcial 4/6, rechazo, actualización de respuesta y recarga automática al recuperar foco |
| Invitación personalizada y asistencia | Pantallas de éxito y rechazo persistentes; edición precargada, fecha del servidor, error de guardado sin éxito falso |
| Límite de boletos | Correcto en UI y API; tampoco permite reducir por debajo de lo confirmado |
| Recarga de invitación y panel | Datos y sesión recuperados correctamente |
| Acceso no autorizado | Anónimo y usuario autenticado sin membresía rechazados; metadatos falsificados no conceden acceso |
| Vista móvil | Chrome con tamaños de 320, 390 y 768 px, sin desbordamiento horizontal de página |
| Recursos y presentación | 115 recursos públicos originales idénticos; cambios aislados al panel y a la pantalla de confirmación, música/carruseles/lightbox operativos |
| Limpieza | Sin pases, cuentas QA ni sesiones de prueba restantes; la cuenta definitiva se conserva |

Once pruebas unitarias/estáticas correctas, pruebas funcionales de Chrome y Supabase satisfactorias y revisión independiente del Excel generado mediante openpyxl. No se agregaron dependencias de producción. La prueba móvil usa emulación de Chrome, no dispositivos físicos. Security Advisor reportó los dos avisos informativos por denegación RLS descritos arriba y una advertencia: la [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) está desactivada en Auth. Este ajuste adicional queda disponible en el dashboard. Performance Advisor no reportó hallazgos.

La cuenta definitiva está autorizada y el registro público fue deshabilitado y verificado. El inicio/cierre y las operaciones se probaron con una cuenta temporal independiente; no se solicitó ni cambió la contraseña real. El organizador ya validó personalmente su acceso y el flujo anterior; esta mejora queda disponible para revisión local antes de publicar.

Para tu revisión local, deja el servidor del comando anterior ejecutándose:

- Panel: http://127.0.0.1:8000/admin.html
- Invitación: http://127.0.0.1:8000/
- Invitación personalizada: usa **Abrir** en el panel; genera `/?invitado=TOKEN` con el token real de ese pase.

Los cambios que hagas en el panel local se guardan en el proyecto real de Supabase. Los enlaces generados localmente apuntan a `127.0.0.1`; para enviarlos a invitados, expórtalos desde la URL pública después de autorizar la publicación.

## Revisión visual del panel y prevención de caché obsoleta

El panel usa tipografía sans-serif del sistema, encabezado compacto y formulario horizontal en escritorio. Las cuatro tarjetas principales muestran boletos asignados, confirmados, pendientes y no utilizados. La dona SVG muestra el porcentaje de confirmación; el bloque de familias incluye una barra del porcentaje de respuesta. Se conservaron las fórmulas, la actualización cada 30 segundos y toda la lógica de persistencia y seguridad.

**Diagnóstico previo al rediseño:** el servidor de `127.0.0.1:8000` estaba en este repositorio y servía HTML/CSS idénticos a `52b9050`, con `200 text/css`, sin errores de CSS, CSP ni MIME. Al combinar deliberadamente su HTML/JS con el CSS de `6c6a9da` se reprodujeron todos los síntomas: tarjetas ausentes, números juntos, input duplicado y dona de 864 × 24 px. La hoja nueva sí daba una dona de 176 × 176 px. La URL del CSS no había cambiado entre versiones. La caché anterior en la sesión personal del organizador es la explicación respaldada por esta reproducción; no se inspeccionó directamente esa sesión.

Para impedir la mezcla, CSS, JavaScript y plantilla del panel utilizan URLs con hash de contenido. Tras editar esos recursos, ejecuta **`npm run version:assets`** antes de `npm test`; la prueba de hashes detecta referencias desactualizadas. La confirmación también versiona su CSS y JavaScript. El servidor de `npm run preview` fija la raíz en el repositorio, escucha únicamente en `127.0.0.1` y envía `Cache-Control: no-store`, incluso si se ejecuta desde otro directorio. La prueba `cache-browser.mjs` conserva realmente la hoja antigua en la caché de Chrome y comprueba que la nueva URL carga los estilos correctos.

Se generaron y revisaron capturas reales en **1440 × 900**, **1280 × 800**, **390 × 844** y **320 × 844**, con panel vacío y con familias confirmadas, parciales, pendientes y rechazadas. Se comprobaron las tarjetas blancas, separación de números, dona circular (también con 0%), colores de filtros, selector personalizado, input de archivo oculto, alineación y ausencia de desbordamiento. Las capturas de confirmación incluyen éxito, rechazo y edición precargada en los cuatro tamaños.

- `test-results/admin-review/`: capturas del panel, viewport y página completa; `report.json` incluye estilos computados y hash del CSS recibido.
- `test-results/confirmation-review/`: capturas y comprobaciones de confirmación/edición.
- `test-results/css-diagnosis.json` y `diagnosis-old-css.png`: evidencia de la reproducción inicial.
- `tests/admin-browser.mjs`: creación, edición, eliminación y manejo de consultas simultáneas/fallos de red.
- `tests/excel-browser.mjs`: archivo real generado, identidad oculta, reimportación, columnas adicionales, fechas Mac y estilos.

La exportación real también se abrió en Microsoft Excel y se revisó su PDF. Se encontró y corrigió un fondo negro en los estados de asistencia: los estilos diferenciales usaban un color de fondo automático; ahora usan RGB explícito. Se inspeccionaron encabezados, filas alternadas, enlaces, ID oculto, fechas y estados. Evidencia local: `test-results/excel-validado-microsoft.pdf` y `excel-validado-detalle.png`.

Los escenarios visuales y de fallos usan datos ficticios y respuestas simuladas **solo en memoria del navegador**, sin crear usuarios o registros en Supabase. La validación anterior contra Supabase permanece documentada arriba; esta revisión no modifica tablas, funciones, políticas ni credenciales. Los PNG y XLSX de prueba están ignorados por Git y se pueden regenerar con los scripts de pruebas.

## GitHub y publicación

Repositorio existente: https://github.com/AlexHS2904/XV_CAMILA

GitHub Pages está configurado con **main / (root)**. Cada push a `main` activa automáticamente `pages-build-deployment` y publica en https://alexhs2904.github.io/XV_CAMILA/.

Esta actualización se entrega en la rama `revision/supabase-camila`, para revisión antes de publicar. El historial y la configuración de despliegue se conservan. **Fusionar esta rama a `main` publicará automáticamente**; no se ha realizado despliegue manual ni cambiado la fuente de Pages.

La versión fuente se tomó de `XV_CAMILA 3`. Se conservan sus estilos públicos, imágenes, audio, animaciones, galería y JavaScript visual. Esta revisión rediseña el panel y agrega una sección de confirmación con estilos aislados, sin rediseñar la invitación existente.

La lista antigua guardada en un navegador puede migrarse desde su exportación CSV: ábrela en Excel, guárdala como `.xlsx` e impórtala. Se reconocen `Invitado_Familia` y `Boletos_Asignados`. Quita los códigos antiguos que no correspondan a pases de Supabase: el panel generará identidades nuevas. Las confirmaciones se registran cuando cada familia responde desde su nuevo enlace.
