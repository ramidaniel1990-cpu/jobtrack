# JobTrack

Aplicación frontend de portafolio para organizar criterios de búsqueda de empleo. Interfaz en inglés (estándar obligatorio también para próximos proyectos), Vue 3 con Composition API, TypeScript estricto, Vite, Vue Router, Pinia y Tailwind CSS. Fechas y moneda usan `en-GB`; no se incluye selector de idioma ni biblioteca de traducción.

Incluye Google Authentication y repositorios Firestore por usuario, además de la demo local sin cuenta. Consulta [la guía Firebase](docs/firebase.md) para los comandos de emuladores, la configuración pública y los pasos exactos en Firebase Console para un proyecto dedicado.

## Inicio en Windows / PowerShell

Requiere Node.js compatible con Vite (`^20.19.0 || >=22.12.0`) y npm. Verificado con Node 24.4.0, npm 11.4.2 y Git 2.38.0. Para una instalación nueva, utiliza una versión LTS vigente de Node desde https://nodejs.org y Git desde https://git-scm.com/download/win; vuelve a abrir la terminal.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre la URL local que muestra Vite, normalmente http://127.0.0.1:5173. `npm.cmd` evita el bloqueo de `npm.ps1` cuando PowerShell tiene deshabilitada la ejecución de scripts. En otros terminales puedes usar `npm`.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

El lockfile fija las versiones resueltas. Vue Router 4 se seleccionó como versión estable compatible con Node instalado: Router 5 arrastraba dependencias que requieren Node 24.11+. TypeScript 6 satisface el rango de typescript-eslint; no se fuerza TypeScript 7 fuera de ese rango.

## Alcance implementado

- Navegación responsive: My searches, Offers, Saved y detalle.
- Crear, editar, pausar, reanudar y eliminar búsquedas con confirmación de eliminación.
- Diez filtros opcionales, moneda y distinción entre imprescindible y preferencia. Vacío significa sin preferencia. Las listas separadas por comas representan alternativas; tecnologías e idiomas usan coincidencia con cualquiera de ellas.
- Experience level, Work arrangement y Employment type usan selección múltiple mediante casillas; ninguna selección significa sin preferencia. Technologies y Languages admiten etiquetas con comas, Enter o Add y botones para quitarlas. Los ejemplos solo aparecen como placeholders. Las alternativas se conservan como cadenas separadas por comas para mantener la compatibilidad de los datos existentes; valores antiguos fuera del catálogo siguen visibles y se pueden desmarcar.
- Alternativas de un criterio usan OR; diferentes imprescindibles usan AND. Las preferencias puntúan sin excluir. Datos ausentes y monedas distintas se evalúan como desconocidos; nunca confirman un requisito. Las explicaciones indican la falta de información o de conversión y un panel muestra los motivos de exclusión de la última búsqueda. Al buscar se muestran por defecto sus resultados; el historial y las ofertas guardadas se conservan.
- Excluded words siempre excluye coincidencias normalizadas por palabras o frases completas (no fragmentos accidentales), sin Required. Maximum listing age también se aplica siempre, sin Required: entero no negativo, vacío sin límite, cero incluye hoy según calendario UTC; fechas desconocidas o futuras no confirman el límite.
- El salario mínimo es bruto anual antes de impuestos: número finito no negativo, vacío sin mínimo, con moneda asociada. No se realiza conversión. Un salario desconocido o de otra moneda no cumple un mínimo imprescindible; si es preferencia, la oferta sigue visible con la explicación de comparación desconocida.
- Frecuencia manual, diaria o semanal con día, hora y zona IANA validada. La configuración no se ejecuta automáticamente.
- Buscar ahora consulta un catálogo local de cuatro ofertas ficticias con una espera simulada. Guardar, quitar de guardadas, descartar y restaurar ofertas.
- Deduplicación por identificador estable, asociación a búsquedas y conservación de decisiones al repetir consultas.
- Persistencia local de búsquedas, resultados y decisiones con validación de formato. Los errores de lectura o escritura se muestran sin fingir que se han guardado cambios.
- Google sign-in y sign-out con resolución inicial de sesión, cancelación y reintento. Los usuarios autenticados usan Firestore; la demo conserva su localStorage separado. No hay importación automática.
- Los datos anteriores se limpian al cambiar de cuenta o salir; las respuestas antiguas no actualizan la sesión nueva. Los guardados conectados esperan confirmación y los errores nunca cambian silenciosamente al modo demo.
- Estados de carga, vacío, error y éxito; controles nativos, etiquetas, foco visible, enlace para saltar al contenido y reducción de movimiento.

Authentication y Firestore están implementados con SDK modular. El proyecto real seleccionado explícitamente es **JobTrack (`jobtrack-2591a`)**: la configuración local está aplicada y las reglas verificadas se publicaron el 30 de octubre de 2026. No se desplegaron Hosting, Functions, índices ni otros recursos. Google y el recorrido de datos reales requieren comprobación manual; las pruebas automatizadas siguen usando únicamente emuladores y dobles. No hay backend de búsqueda, IA, búsquedas reales ni candidaturas. Empresas, fechas, salarios, porcentaje y explicaciones siguen siendo simulaciones. Pausar impide la ejecución manual hasta reanudar.

## Arquitectura e integración futura

```text
src/app/                         # arranque, router, layout y estilos
src/features/tracker/components/ # formularios y tarjetas
src/features/tracker/views/      # composición de pantallas
src/features/tracker/store.ts    # estado y acciones Pinia
src/features/tracker/persistenceSession.ts # confirmaciones y aislamiento asíncrono
src/features/auth/               # Google Auth, coordinación de sesión y UI
src/features/cloud/              # repositorios y adaptador Firestore por UID
src/shared/firebase/             # configuración pública y SDK modular
src/features/tracker/demoService.ts # catálogo, filtros y deduplicación
src/features/tracker/filterEvaluation.ts # evaluación explicable y desconocidos
src/features/tracker/persistence.ts # adaptador localStorage y validación
src/features/tracker/migration.ts # compatibilidad con formatos anteriores
src/shared/searchValidation.ts   # validación compartida formulario/store
src/shared/types.ts              # modelos e interfaces de servicios
tests/tracker.test.ts            # lógica y recorrido integrado
```

Las vistas no acceden a persistencia. `PersistenceAdapter` permite operaciones síncronas para demo y asíncronas para Firestore; `dispose` invalida sesiones antiguas. `JobSearchService` sigue consultando el catálogo demo. `store.init(adapter, service)` permite inyección en pruebas. Firestore usa sobres tipados `{payload, updatedAt}` en `users/{uid}/{searches,offers,decisions}`. No hay listeners de Firestore ni sincronización en tiempo real entre pestañas: son lecturas del servidor y batches de cambios confirmados. El backend futuro deberá implementar programación, ofertas reales y evaluación IA.

Los datos demo permanecen en `jobtrack:v1` de este origen y navegador. No se sincronizan ni se suben por iniciar sesión. El modo privado o la limpieza del navegador pueden eliminarlos. Las cuentas conectadas cargan solo sus documentos Firestore, sin caché persistente de Firestore en disco. Si los datos locales están dañados se conservan y se bloquea su sobrescritura.

La carga convierte en memoria los valores antiguos conocidos (números a texto y listas a alternativas separadas por comas); no escribe al abrir ni cancelar formularios. El siguiente guardado explícito añade `schemaVersion: 2` en la misma clave. Las decisiones y ofertas guardadas se conservan. Las opciones desconocidas y valores inválidos siguen visibles con avisos para revisión. Si no se puede interpretar la estructura, el original permanece intacto y se bloquea la escritura, sin reemplazarlo por un estado vacío. Los registros anteriores muestran un aviso del cambio de reglas de exclusión y antigüedad.

## Validación

Última verificación (30 de octubre de 2026): TypeScript correcto, lint sin avisos, **71 pruebas unitarias aprobadas en 10 archivos** y build correcto. Con Microsoft OpenJDK **21.0.13.0.2**, `npm.cmd run test:emulators` aprobó **11 pruebas reales en 3 archivos**: Authentication **1**, reglas Firestore **8** y persistencia Auth + Firestore **2**. Ya no hay bloqueo por Java: se encontró instalado y se actualizó solo el entorno del proceso de prueba. La auditoría de dependencias anterior finalizó sin vulnerabilidades tras fijar versiones compatibles.

La ejecución de emuladores encontró y permitió corregir un exceso del presupuesto de expresiones en las reglas de listas de ofertas. Se mantienen el máximo de 20 strings de 128 caracteres, validación de todas las posiciones y aislamiento por usuario. Hay regresiones de listas máximas, tipos inválidos, longitudes, Unicode y búsquedas completas. Posteriormente se publicó únicamente ese archivo verificado en `jobtrack-2591a`, con confirmación de compilación y publicación de Firebase CLI.

Los archivos de más de 200 líneas se revisaron por responsabilidad: estilos base/layout/ofertas y coordinador de sesión. No se fragmentaron artificialmente. El build emite un aviso no fatal por el tamaño del SDK Firebase; la carga diferida del SDK es una mejora de rendimiento pendiente.

Comprobaciones disponibles: TypeScript, ESLint sin avisos, Vitest y build de producción en `dist/`. La suite cubre filtros vacíos, OR/AND, preferencias, exclusiones, antigüedad, datos desconocidos, monedas distintas, validaciones de frecuencia y números, migración, deduplicación y conservación de decisiones. También cubre el recorrido crear → buscar → renderizar detalle → guardar → recargar, editar, pausar/reanudar y descartar/restaurar. El composable de filtros compartido por Offers y Saved se prueba con la reactividad de Vue para asegurar que no se ocultan guardadas por un filtro anterior. Las pruebas no acceden al proyecto real.

El texto de las ofertas del catálogo demo ya guardadas se actualiza al cargarlo, manteniendo fechas, asociaciones y decisiones. Los nombres y criterios introducidos por el usuario no se traducen; tampoco se alteran ofertas externas ajenas al catálogo. La actualización se guarda junto con la siguiente acción de persistencia. Se han revisado estáticamente etiquetas, navegación, estados, foco y reglas para textos largos. Esta revisión no sustituye la inspección visual ni la interacción real con teclado.

Las verificaciones unitarias son automatizadas con adaptadores y servicios dobles para simular fallos/carreras: lógica, persistencia, renderizado HTML y reactividad. Separadamente, la prueba Auth real utilizó el emulador local y credenciales Google de prueba admitidas por ese emulador. Ninguna equivale a probar el popup Google real ni la persistencia real de Firestore. La revisión independiente corrigió problemas de aislamiento, estados y límites cliente/reglas.

Se volvió a intentar usar Chrome, pero la herramienta no pudo identificar con confianza la URL activa y detuvo la automatización. La inspección visual de 1440px y 390px, el desplazamiento horizontal y el uso real de teclado quedan pendientes. Se revisaron estáticamente la tipografía 16px/14px, rejillas con minmax, salto de textos largos, foco visible y etiquetas accesibles; no se presenta como verificación visual.

Documentación consultada: [Vue](https://vuejs.org/guide/quick-start.html), [Vite](https://vite.dev/guide/), [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite), [Pinia](https://pinia.vuejs.org/getting-started.html) y [Vue Router](https://router.vuejs.org/installation.html). Versiones comprobadas también mediante los metadatos oficiales del registro npm.
