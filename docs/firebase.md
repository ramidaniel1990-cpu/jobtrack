# Firebase: configuración y verificación

## Estado de esta entrega

El código usa el SDK modular. La demo sigue funcionando sin cuenta ni variables de entorno; los datos de `jobtrack:v1` no se importan a Firestore. Iniciar sesión carga exclusivamente las colecciones del UID autenticado. El usuario seleccionó **JobTrack (`jobtrack-2591a`)** y proporcionó su configuración web: se aplicó en `.env.local` y se publicaron únicamente las reglas verificadas el 30 de octubre de 2026. La cuenta CLI tiene acceso, el proyecto está ACTIVE y la base `(default)` ya existía. Google y la persistencia reales siguen pendientes de comprobación manual; no se desplegó la aplicación ni se ejecutaron pruebas automatizadas contra el proyecto real.

Las ofertas siguen siendo las cuatro muestras locales. Tanto la valoración como sus explicaciones son simuladas. Guardar una frecuencia no ejecuta búsquedas programadas.

## Modos

- `npm.cmd run dev`: sin `.env.local`, usa almacenamiento demo. El botón Google explica que falta configuración, sin simular una sesión.
- `npm.cmd run dev:emulators`: activa explícitamente `.env.emulator`; usa el proyecto local `demo-jobtrack`, Auth en 127.0.0.1:9099 y Firestore en 127.0.0.1:8080. Solo se permite en desarrollo. Primero hay que arrancar ambos emuladores.
- Proyecto real: requiere `VITE_FIREBASE_ENABLED=true`, `VITE_FIREBASE_USE_EMULATORS=false` y las cuatro opciones públicas de una app web elegida explícitamente. Un error conserva el modo conectado y ofrece reintento; nunca importa la demo como alternativa.

`.env.local` está ignorado. Las variables VITE son públicas y quedan incluidas en el build; no deben contener cuentas de servicio, claves privadas ni credenciales de administrador. Vite debe reiniciarse tras cambiar la configuración. Revisa también `.env.local` antes de ejecutar el modo emulador, porque Vite puede combinar archivos de entorno: la protección del proyecto impide usar un ID real con emuladores, pero cualquier configuración ambigua debe corregirse.

## Emuladores en Windows

1. Instala un JDK 21 o posterior. Una opción oficial para Windows x64 es [Microsoft Build of OpenJDK 21 LTS](https://learn.microsoft.com/en-us/java/openjdk/download): elige el instalador Windows x64 EXE de la sección OpenJDK 21. En el instalador activa la actualización de PATH y JAVA_HOME. Cierra y vuelve a abrir VS Code y su terminal para heredar esas variables; comprueba `java -version` (debe mostrar 21 o posterior) y `Get-Command java`. La versión Firebase CLI instalada exige Java 21 como mínimo, no basta con Java 8, 11 o 17. [Instrucciones oficiales de instalación](https://learn.microsoft.com/en-us/java/openjdk/install).
2. Ejecuta `npm.cmd ci` para instalar las herramientas locales incluidas en el lockfile.
3. No necesitas `firebase login` ni una cuenta de servicio para este proyecto demo.

```powershell
# Arrancar Auth, Firestore y la UI local (4000)
npm.cmd run emulators:start

# En otra terminal, abrir la app contra los emuladores
npm.cmd run dev:emulators
```

El popup Google del emulador permite una identidad de prueba; no inicia sesión con Google real. Verifica crear → buscar → detalle → guardar → recargar, editar, pausar/reanudar, descartar/restaurar y alternar cuentas sin arrastrar datos. Los datos emulados se eliminan al apagar los emuladores; no se promete persistencia entre ejecuciones del emulador.

```powershell
# Arranca ambos emuladores, prueba y los apaga
npm.cmd run test:emulators

# Solo Auth: no necesita Java
npm.cmd run test:auth-emulator
```

Los comandos usan `scripts/firebase-local.mjs`, proyecto fijo `demo-jobtrack`, configuración CLI aislada en `.firebase-cli/` y caché local de emuladores. No leen una selección de proyecto ni sesión Firebase CLI de tu cuenta. El primer arranque puede descargar componentes del emulador. Las pruebas rechazan endpoints que no sean loopback y no usan proyectos reales.

## Pasos exactos en Firebase Console para una conexión real posterior

Estos pasos describen la preparación del proyecto dedicado. En `jobtrack-2591a` ya se confirmó el acceso y se publicaron solo las reglas, con autorización explícita del usuario, después de pasar las pruebas de emuladores. Los ajustes de proveedor Google y dominios, y el recorrido real, deben comprobarse manualmente.

1. En [Firebase Console](https://console.firebase.google.com/), elige **Create a project**. Crea uno nuevo llamado **JobTrack** y confirma un ID único dedicado. No selecciones proyectos existentes de otros trabajos. Analytics es opcional y no lo usa esta aplicación.
2. En **Project overview → Add app → Web (`</>`)**, registra una app, por ejemplo **JobTrack Web**. No marques la opción de publicar con Hosting. Copia el objeto de configuración que proporciona Firebase. También se obtiene en **Project settings → General → Your apps → SDK setup and configuration → Config**.
3. En **Authentication → Get started → Sign-in method → Google**, habilita Google, selecciona el correo de soporte del proyecto y guarda. No habilites proveedores ficticios ni Anonymous para el producto: el inicio de sesión implementado es Google.
4. En **Authentication → Settings → Authorized domains**, añade únicamente los hosts que usarás. Para desarrollo local con el proyecto dedicado, añade **localhost**; si utilizas `http://127.0.0.1:5173`, añade también **127.0.0.1**. No incluyas esquema, puerto ni rutas. Los proyectos recientes no incluyen localhost por defecto. Conserva el `authDomain` suministrado por Firebase. Para un dominio de producción posterior, autorízalo explícitamente cuando exista.
5. En **Firestore Database → Create database**, crea la base **(default)** de **Cloud Firestore Standard**, elige conscientemente su ubicación y comienza en **Production mode** (denegado inicialmente), no en reglas abiertas de prueba. No necesitas crear manualmente los documentos: se crean tras acciones confirmadas de un usuario.
6. Una vez revisadas y aprobadas las pruebas locales, en **Firestore Database → Rules**, pega el contenido completo de `firestore.rules` y pulsa **Publish** tú mismo en ese proyecto dedicado. Este paso publica reglas y es necesario antes de probar persistencia real; el agente no lo ha realizado. `firestore.indexes.json` no declara índices compuestos: las consultas actuales leen colecciones completas por usuario.
7. Crea `.env.local` a partir de `.env.example` si aún no existe. Si existe, edítalo sin sobrescribir otros valores. Completa con los valores de **esa app web**:

```dotenv
VITE_FIREBASE_ENABLED=true
VITE_FIREBASE_USE_EMULATORS=false
VITE_FIREBASE_API_KEY=YOUR_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN_FROM_FIREBASE
VITE_FIREBASE_PROJECT_ID=YOUR_DEDICATED_JOBTRACK_PROJECT_ID
VITE_FIREBASE_APP_ID=YOUR_WEB_APP_ID
```

8. Reinicia `npm.cmd run dev`. Abre el host autorizado, permite el popup y pulsa **Sign in with Google**. Comprueba que la cuenta empieza con un espacio vacío, que la demo no se sube y que aparecen datos solo bajo `users/{uid}` después de guardar. Repite con otra cuenta y cierra sesión. La demo local anterior debe seguir intacta.
9. Antes de considerar la conexión real verificada, confirma lectura y escritura tras recargar, errores de permisos/conexión con reintento y aislamiento entre dos cuentas. No publiques la aplicación ni habilites servicios de empleo o IA como parte de esta fase.

## Modelo y límites

```text
users/{uid}/searches/{searchId}   { payload: JobSearch, updatedAt: serverTimestamp }
users/{uid}/offers/{offerId}      { payload: JobOffer, updatedAt: serverTimestamp }
users/{uid}/decisions/{offerId}   { payload: { offerId, status }, updatedAt: serverTimestamp }
```

Los repositorios tipados hacen tres lecturas puntuales del servidor. No hay listeners de Firestore que permanezcan activos, caché persistente de Firestore en disco ni escritura por pulsación. Solo un observador Auth controla el ciclo de sesión; se cancela al desmontar o salir explícitamente a demo. Se limpian los datos del tracker y se invalidan cargas, búsquedas y escrituras antiguas cuando cambia la identidad. La resolución inicial de Auth precede la carga de datos.

Los guardados usan batches atómicos solo para documentos modificados y esperan la confirmación del servidor. Hay un límite conservador de 450 cambios por operación. `updatedAt` lo asigna el servidor; las fechas de las ofertas continúan siendo ficticias. El adaptador no ofrece sincronización en tiempo real entre pestañas ni fusión colaborativa; recargar vuelve a leer del servidor. No debe usarse como editor concurrente de la misma búsqueda en varias pestañas.

Las reglas deniegan por defecto y validan dueño, sobres exactos, tipos y límites: nombres de 80 caracteres, criterios de 1.000, listas de 20 cadenas de 128 caracteres, salario hasta 1.000.000.000 y antigüedad hasta 36.500 días. El frontend valida los límites de formulario y normaliza el texto numérico al guardar; valores antiguos inválidos siguen visibles para revisión. Las reglas siguen siendo la barrera de seguridad frente a clientes manipulados.

## Verificaciones reales y límites actuales

- TypeScript, lint, suite unitaria y build se ejecutan en la carpeta local. Las pruebas unitarias de sesión usan dobles explícitos para errores y carreras; no equivalen a un servicio Firebase real.
- La prueba de Authentication Emulator se ejecutó realmente y pasó: estado inicial, credencial Google de prueba del emulador, salida y recuperación de la misma identidad.
- Verificación del 30 de octubre de 2026: se localizó Microsoft OpenJDK `21.0.13.0.2` en `C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot`. El entorno del proceso aún tenía PATH antiguo; se ajustaron JAVA_HOME y PATH únicamente para ejecutar las pruebas, sin reinstalar Java ni cambiar variables del sistema.
- `npm.cmd run test:emulators` ejecutó y aprobó **11 pruebas reales en 3 archivos**: **Authentication: 1**, **reglas Firestore: 8**, **persistencia Auth + Firestore: 2**. Se verificaron CRUD propio, rechazo entre usuarios A/B y sin sesión, documentos inválidos, timestamps, deduplicación, decisiones y recarga. Los emuladores se apagaron correctamente.
- La primera ejecución detectó que la validación de listas excedía el presupuesto de 1.000 expresiones y rechazaba ofertas válidas. Se corrigió `stringList` para comprobar cada una de las 20 posiciones con una operación exclusiva de strings y longitud máxima, conservando las restricciones. Las regresiones prueban las tres listas a su máximo, Unicode/saltos de línea, tipos no string, listas inválidas y longitud excesiva, además de búsquedas completamente configuradas.
- Revisión del 28 de octubre de 2026: no se encontró `java.exe` en PATH, JAVA_HOME/JDK_HOME, el perfil del usuario ni las carpetas de programas revisadas; tampoco se encontró una instalación registrada. Se volvió a ejecutar `npm.cmd run test:emulators` y falló antes de iniciar Firestore porque no pudo lanzar `java -version`. Se repitieron TypeScript, lint, las 71 pruebas unitarias y build con resultado correcto; continúa el aviso no fatal por tamaño del SDK. También se repitió la prueba real de Authentication Emulator: 1 aprobada, con apagado correcto del emulador. No se cambió la implementación ni se publicaron reglas.
- Despliegue real del 30 de octubre de 2026: `node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules --project jobtrack-2591a --config firebase.rules-only.json --non-interactive` terminó con código 0, `rules file firestore.rules compiled successfully`, `released rules firestore.rules to cloud.firestore` y `Deploy complete!`. El SHA-256 local, idéntico al archivo verificado, es `98074768027256acf8fff8e847b89c8b858035652088c54791dcd3eec472bfb3`. No se publicaron índices, Hosting, Functions ni otros recursos; `.firebaserc` conserva el proyecto demo para los emuladores.
- Chrome sigue bloqueado: la herramienta no pudo identificar con confianza la URL activa. No se afirma inspección visual ni del popup Google real.
- El build incluye un aviso no fatal por tamaño del SDK Firebase en el bundle; no se oculta como comprobación fallida ni se cambia el umbral para silenciarlo.

Firebase 12 mantiene compatibilidad con la biblioteca oficial de reglas 5 y el Node disponible (24.4). El lockfile incluye overrides limitados para unificar `@firebase/app`/compat en versiones compatibles con ese Node y para usar versiones corregidas de gRPC y dependencias de CLI. No se ha usado `--force` ni se ha añadido Firebase Admin al código frontend.

Fuentes oficiales consultadas: [SDK web modular y configuración](https://firebase.google.com/docs/web/setup), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [observador Auth](https://firebase.google.com/docs/auth/web/start), [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore Emulator y Java](https://firebase.google.com/docs/emulator-suite/connect_firestore), [pruebas de reglas](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [dominios autorizados](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [timestamps del servidor](https://firebase.google.com/docs/firestore/manage-data/add-data).
