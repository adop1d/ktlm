# Plan: servidor MCP para que una IA tenga acceso total a la app

## Qué queremos

Que un asistente pueda trabajar **sobre los mismos datos que la app**: leer la lista, crear y
modificar tareas, filtrar, y —lo que la app es— hablar en **líneas de `todo.txt`**, no en un
JSON de aplicación.

No es "una API más para una IA". La diferencia es que el servidor MCP expone **el archivo como
lenguaje**: la misma gramática que el prompt `n` de tuxedo, la misma de `rec:`, y el mismo
round-trip que ya está probado contra el binario real.

## Dónde vive

Servidor aparte, en Python, que habla con la API por HTTP. **No** se mete dentro del backend
Spring:

| | En el backend | Servidor MCP aparte |
|---|---|---|
| Reescritura de Spring | sí, en cada endpoint | ninguna |
| El MCP puede vivir aunque la app se reescriba | no | sí |
| Ecosistema MCP (SDK, inspector, transporte) | pobre en JVM | maduro en Python/TS |
| Latencia | mínima | un salto HTTP |

El backend ya tiene lo difícil: `POST /api/tasks/import` acepta texto plano y devuelve el
archivo reconciliado. Eso **es** la operación que un editor de tareas necesita, y ya está.

## Superficie de herramientas

Cada herramienta es una operación que la app ya soporta, expresada en el idioma del archivo.

### Lectura

| Herramienta | Qué hace | Endpoint |
|---|---|---|
| `list_tasks` | Lista paginada con filtros de proyecto, contexto, texto, estado y orden | `GET /api/tasks` |
| `get_task` | Una tarea por `id` | `GET /api/tasks/{id}` |
| `read_todo_txt` | El `todo.txt` completo, como texto | `GET /api/tasks/export` |
| `archive_view` | Lo que hay en `done.txt` | falta endpoint (Fase 1) |

### Escritura

| Herramienta | Qué hace | Endpoint |
|---|---|---|
| `add_task` | Alta en lenguaje natural: `"llamar al dentista mañana +salud @oficina"` | `POST /api/tasks` |
| `complete_task` | Marca completada; si trae `rec:`, genera la siguiente instancia | `PATCH /api/tasks/{id}/toggle` |
| `update_task` | Parche parcial: título, prioridad, fecha, proyectos, contextos, `rec:` | `PUT /api/tasks/{id}` |
| `delete_task` | Borra | `DELETE /api/tasks/{id}` |
| `apply_todo_txt` | **Recibe texto plano completo y reconcilia.** Es la operación clave | `POST /api/tasks/import` |
| `append_inbox` | Añade una línea al `inbox.txt` del servidor | falta endpoint (Fase 1) |
| `archive_completed` | Manda las completadas a `done.txt` | `POST /api/tasks/archive` |

### Introspección

| Herramienta | Para qué |
|---|---|
| `search_grammar` | Devuelve la gramática soportada (fechas naturales, `rec:`, umbrales, proyectos, contextos). Una IA que no conoce las reglas las inventa |
| `describe_keymap` | Los atajos y qué acciones pueden ejecutarse con el archivo vinculado |

## Fase 0 — Decisión de seguridad (bloqueante, y es tuya)

Un acceso total a los datos de una cuenta, para una IA, es una superficie de riesgo distinta a
cualquier otra de esta app. Hay que decidir **antes** de escribir código:

1. **¿Dónde se ejecuta el servidor MCP?** En tu máquina es un riesgo bajo. Compartido con
   otras personas es otro problema: quien lo use lee y escribe las tareas de quien sea.
2. **¿Qué tokens acepta?** Hoy `SecurityConfig` solo distingue `permitAll` de `authenticated`.
   Hace falta un rol o un prefijo de scope para el MCP, o un token de servicio dedicado.
   **No** reutilizar el JWT de un usuario humano para automatizar.
3. **¿Puede archivar?** `archive_completed` es destructivo e irreversible desde la app (las
   completadas salen de la lista). Decidir si la herramienta existe o si pide confirmación.

Propuesta por defecto, si no dices otra cosa: servidor en local, token de servicio con su propio
rol, y `archive_completed` desactivada por defecto hasta que la pidas.

## Fase 1 — Endpoint que falta: `done.txt`

La vista de archivo lee `done.txt` desde el navegador. Para una IA eso no la cubre, porque no
tiene navegador.

- `GET /api/tasks/archived` → líneas de `done.txt` ya parseadas.
- `POST /api/tasks/inbox` → acepta una línea y la procesa por la misma gramática.

Ojo con el diseño: hoy `done.txt` e `inbox.txt` son archivos **del cliente**, no del servidor.
El endpoint tiene que decidir de dónde salen. Lo más limpio es que el servidor sea dueño de un
directorio por usuario y que el navegador lo monte desde ahí; si no, estos dos endpoints
devuelven 409 explicando que la operación necesita un cliente vinculado.

## Fase 2 — El esqueleto

1. Proyecto Python con el SDK MCP, transporte **stdio** (lo consume un IDE) y **HTTP** (lo
   consume un agente remoto).
2. `TodoTxtMCPClient`: login con el token de servicio, cliente HTTP con reintentos y timeouts,
   y un `TodoDoc` en memoria con las mismas reglas de parche que el del navegador.
3. Traducción de `add_task` a `/api/tasks` y de `apply_todo_txt` a `/api/tasks/import`.
   Reutilizar `TodoTxtCodec` **no** es posible desde Python: vive en Java. Dos opciones:
   duplicar la gramática (se pudre) o exponer un endpoint de parseo. **Prefiero la segunda**:
   `POST /api/tasks/parse` que devuelve el árbol de una línea sin guardarla.

## Fase 3 — La pieza que la hace útil

Un `TodoDoc` local en el servidor, con parche de líneas, deshacer y escritura atómica. Es el
mismo diseño del navegador y existe por una razón concreta: **una IA que hace diez cambios
seguidos no deberíaerealizar diez viajes de ida y vuelta**, y un `apply_todo_txt` por cada línea
es exactamente eso.

Modelo: la IA propone un lote de operaciones, el servidor las parchea sobre el documento en
memoria, escribe una vez y llama a `/api/tasks/import` una vez. Si el archivo cambió por fuera
mientras tanto, el servidor lo detecta por hash y rechaza el lote en vez de pisar.

## Fase 4 — Verificación

No es opcional y no es un extra:

- Cada herramienta, probada contra el backend real, no contra mocks.
- El caso que de verdad importa: la IA edita el archivo, y al mismo tiempo alguien lo edita
  desde la app. Debe reconciliar por `uid` sin duplicar ni perder nada. Es el mismo escenario que
  ya se probó contra tuxedo, y aquí es donde un servidor MCP naive se carga datos.
- Un test deproperty: ninguna herramienta destructiva (`delete`, `archive`) sin confirmación
  explícita.

## Orden y tamaño

| Fase | Qué | Riesgo si se hace mal |
| --- | --- | --- |
| 0 | Decisiones de seguridad | Acceso indebido a datos de cuentas ajenas |
| 1 | `GET /archived`, `POST /inbox` | — |
| 2 | Esqueleto y cliente HTTP | Herramientas que mienten sobre el estado |
| 3 | Lote transaccional con detección de conflicto | **Pérdida de cambios** |
| 4 | Verificación | Confianza falsa |

Fases 0 y 1 primero: son baratas y decide el resto. La 3 es la única que de verdad justifica el
MCP frente a "un cliente de la API".

## Lo que este MCP no va a ser

- **No va a ser la UI.** Sigue habiendo una pantalla y unos atajos. Esto es para
  automatización y para explores programáticos.
- **No va a sustituir a tuxedo.** Habla el mismo archivo, y por diseño los dos pueden estar
  abiertos a la vez. Es una tercera vía de escritura sobre el mismo documento, con su
  reconciliación y todo.
- **No va a tener su propio modelo de datos.** Si el MCP guardara tareas por su cuenta,
  habríamos inventado el problema que la app existe para no tener.
