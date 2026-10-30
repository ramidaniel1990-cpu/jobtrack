# JobTrack

## Convenciones

- El inglés es obligatorio para todo texto visible de la aplicación y para los identificadores de código. Este es el estándar reutilizable para este y los próximos proyectos.
- Incluye navegación, formularios, ayudas, validaciones, estados, notificaciones, accesibilidad, metadatos y datos demo. Usa formatos ingleses coherentes (en-GB). No traduzcas contenido del usuario, nombres propios ni ofertas externas originales. No añadas selector ni dependencia de traducción en esta fase. La comunicación con el usuario puede seguir en español.
- Vue Composition API y script setup con TypeScript estricto. Sin any injustificados.
- Código por funcionalidad en src/features; arranque en src/app; contratos en src/shared.
- Las vistas usan stores, nunca localStorage. Persistencia y búsqueda detrás de interfaces.
- Filtros vacíos = sin preferencia; los imprescindibles restringen y las preferencias explican afinidad.
- Alternativas de un criterio usan OR; criterios imprescindibles usan AND. Excluded words y Maximum listing age siempre restringen cuando tienen valor y no llevan Required. Las exclusiones se comparan por palabras/frases completas normalizadas; antigüedad en días de calendario UTC, con cero = hoy.
- Datos ausentes y salarios de distinta moneda son comparaciones desconocidas, nunca requisitos confirmados. No convertir monedas ficticiamente; explicar desconocidos y motivos de exclusión.
- Validar salario finito no negativo, antigüedad entera no negativa y solo los campos de frecuencia necesarios. No borrar valores antiguos desconocidos: conservarlos con avisos de revisión.
- Persistencia compatible en jobtrack:v1 con schemaVersion 2 al guardar. La migración es en memoria; abrir/cancelar formularios nunca escribe. Errores de formato conservan el original y bloquean escrituras para evitar pérdida de datos.
- Las ofertas, el encaje y la ejecución de búsquedas siguen siendo simulados. Solo Firebase Authentication y Firestore están autorizados en esta fase, con configuración explícita de un proyecto dedicado. No conectar APIs de empleo, IA ni candidaturas; no publicar aplicación, reglas o recursos sin una nueva instrucción explícita.
- Demo sin cuenta ni configuración en localStorage; usuarios autenticados solo en users/{uid}/{searches,offers,decisions}. No importar ni subir datos demo automáticamente. No cambiar silenciosamente a demo ante errores.
- Esperar al observador Auth antes de elegir repositorio. Al cambiar de identidad, cerrar sesión o desmontar, limpiar datos, invalidar operaciones pendientes y cancelar observadores. Solo una confirmación del repositorio permite mostrar éxito. Las vistas esperan las acciones asíncronas y se remontan por sesión.
- SDK modular con configuración web pública VITE_FIREBASE_*; jamás credenciales Admin o claves privadas. Emuladores solo en desarrollo, loopback y demo-jobtrack, con activación explícita. Las pruebas de reglas y cloud están fuera de la suite unitaria y no pueden contactar proyectos reales.
- Reglas deny-by-default y validación de estructura, tipos, límites y timestamp de servidor. Mantener alineados límites de cliente/reglas; no debilitar reglas para acomodar pruebas. No afirmar pruebas de emulador ejecutadas si falta Java o no arrancaron.
- Mantener las reglas bajo el límite de 1.000 expresiones también para documentos válidos al máximo permitido. Probar casos positivos de límites y negativos de tipo/longitud: una regla que rechaza todo por agotar el presupuesto no demuestra validación correcta. La comprobación de listas usa matches sobre todas las posiciones, sin conversiones implícitas.
- Revisar archivos de más de 200 líneas; dividir por responsabilidad, no por tamaño arbitrario.
- No sobrescribir trabajo de otros agentes. Cada tarea tiene archivos propios.

## Plan

1. Conservar contratos de dominio y demo al extender Auth/Firestore.
2. Separar coordinación de sesión, repositorios por usuario y UI; cambios asíncronos confirmados y aislados.
3. Verificar carreras de sesión, demo sin configuración, reglas y recorrido conectado con emuladores cuando estén disponibles.
4. Ejecutar typecheck, lint, tests y build; documentar bloqueos reales y pasos de conexión sin crear recursos externos.
