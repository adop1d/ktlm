<img width="128" alt="favicon" src="https://github.com/user-attachments/assets/2b9e7761-bdfd-4e0d-af9f-4ffe89b5213e" />

# tareas

Gestor de `todo.txt` que habla el idioma de tu archivo y se maneja con teclas de terminal.

No guarda las tareas en una base de datos proprietary: **lee y escribe el mismo `todo.txt`
que ya usas**. Si tienes [tuxedo](https://github.com/webstonehq/tuxedo) abierto al lado, los
dos ven lo mismo, se reconcilian y ninguno pisa al otro.

---

## Arranque rápido

```bash
docker compose up -d
```

- Portada y app: <http://localhost/>
- API: <http://localhost:8080/api>

Sin Docker:

```bash
# backend (necesita un Postgres en localhost:5432)
cd backend && DB_URL=jdbc:postgresql://localhost:5432/postgres \
  DB_USERNAME=tu_usuario DB_PASSWORD= ./mvnw spring-boot:run

# frontend
cd frontend && npm install && npm run dev
```

Requisitos: Java 21, Node 22 y PostgreSQL.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Portada pública. Describe qué es esto antes de pedirte una cuenta |
| `/login` | Entrar y registrarse |
| `/app` | La lista. Protegida: sin sesión, manda al login |

---

## Las teclas

Los atajos son **los de tuxedo**, no un juego inventado. Si ya tienes tu
`~/.config/tuxedo/keybinds.toml` con ajustes, la web los lee.

| Tecla | Qué hace |
|---|---|
| `j` `k` | Mover el cursor |
| `gg` `G` | Primera y última |
| `Ctrl-d` `Ctrl-u` | Media página |
| `n` | Tarea nueva |
| `e` `i` | Editar (modo normal / modo insert) |
| `x` | Completar |
| `d` `d` | Borrar |
| `p` | Cambiar prioridad: `(A)` → `(B)` → `(C)` → ninguna |
| `J` `K` | Mover la tarea de posición |
| `r` | Recurrencia (`rec:`) |
| `u` | Deshacer, 50 pasos |
| `c` `+` | Añadir contexto / proyecto |
| `y` `y` / `y` `b` | Copiar la línea / el texto |
| `v` `espacio` | Selección múltiple |
| `/` | Buscar |
| `f` `s` | Guardar la búsqueda actual |
| `f` `f` | Abrir una búsqueda guardada |
| `f` `p` / `f` `c` | Filtrar por proyecto / contexto |
| `[` `]` | Panel de filtros / panel de detalle |
| `a` | Ver `done.txt` |
| `A` | Archivar las completadas a `done.txt` |
| `:` o `Ctrl-P` | Paleta de comandos |
| `?` | Todos los atajos |

Sin un `todo.txt` vinculado, las acciones que necesitan `uid` — `x`, `p`, `J`, `dd`, `u`,
`A`— **se apagan y la barra de estado lo dice**. Un atajo que no puede actuar se anuncia; no
hace nada en silencio.

---

## Interoperabilidad con todo.txt

### Cómo se reconoce una tarea entre dos programas

Cada línea lleva un token `uid:`. Tuxedo conserva cualquier `clave:valor` que no conozca, así
que añadirlo produce un archivo que sigue siendo un `todo.txt` válido para él y, a la vez,
permite reconciliar archivo y base de datos sin duplicar. Si no quieres verlo, en
`~/.config/tuxedo/config.toml`:

```toml
hide_keys = uid
```

### Captura

Cualquier cosa que sepa escribir una línea en el `inbox.txt` hermano crea una tarea:

```sh
echo "Llamar al dentista mañana" >> ~/ruta/todo/../inbox.txt
```

La app lo drena en cada sondeo, le aplica la misma gramática de lenguaje natural que el prompt
`n`, y lo vacía antes de importar para no reprocesarlo.

### Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/tasks/import` | `text/plain` → upsert por `uid`, devuelve el archivo reconciliado |
| `GET` | `/api/tasks/export` | El `todo.txt` completo del usuario |
| `POST` | `/api/tasks/batch` | Varias operaciones en una transacción. O entran todas, o ninguna |
| `POST` | `/api/tasks/archive` | Manda las completadas a `done.txt` |
| `GET` | `/api/tasks/file` | El `todo.txt` del usuario, tal cual (`text/plain`) |
| `PUT` | `/api/tasks/file` | Reemplaza el archivo entero y devuelve la versión reconciliada |
| `GET` | `/api/tasks/archived` | Lo que hay en `done.txt` |
| `GET` | `/api/tasks/stream` | Cambios de esta cuenta por SSE |
| `GET` | `/api/tasks/{id}/note` | El texto de la nota (`text/plain`) |
| `PUT` | `/api/tasks/{id}/note` | Guarda la nota. Vaciar borra el archivo y quita `note:` |
| `POST` | `/api/auth/service-tokens` | Emite un token de servicio. Se devuelve **una sola vez** |

---

## Arquitectura

```
┌─ navegador ────────────────────┐      ┌─ Spring Boot ──────────┐
│  TodoDoc   espejo del archivo   │      │  TodoTxtCodec          │
│  useKeymap motor vim/chords     │─────▶│  /import /export       │
│  FileHandlePort  FSA            │      │  /archive              │
└───────────────────────────────┘      └───────────┬────────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Postgres + Flyway│
                                              └─────────────────┘
```

- **La base de datos es la fuente de verdad; el archivo es el espejo.** Al abrir un archivo se
  importa, y a partir de ahí cada cambio local va a la API, se parchea la línea y se vuelca al
  disco con escritura agrupada.
- **Cambios externos**: cada 400 ms se compara el contenido con lo último visto. Si no coincide,
  **gana el archivo** y se recarga, descartando el historial de undo, igual que hace tuxedo.
- **Escritura pendiente**: un parche local marca el hash como inválido; el sondeo no reconcilia
  hasta que el volcado termina, o se desharía lo recién escrito.
- **Flyway** es la única fuente del esquema. `V1` es el baseline, `V2` los campos de todo.txt.

### Stack

- **Backend**: Java 21 · Spring Boot 3.4 · Spring Data JPA · PostgreSQL 17 · JWT (jjwt)
- **Frontend**: React 18 · TypeScript · Vite 6 · TanStack Query 5 · Zustand · Tailwind 3
- **Tests**: JUnit 5 + Mockito (backend), Vitest (unit), Playwright (e2e)

---

## Diseño

Interfaz de terminal, no de tarjeta: una sola familia monoespaciada para todo, filas con
columnas de ancho fijo como celdas, esquinas a cero, tema oscuro por defecto y una barra de
estado fija abajo con el modo, la posición, los contadores y el líder del chord.

- **Fuente**: [Inconsolata Nerd Font](https://www.nerdfonts.com/) (SIL OFL 1.1), autoalojada y
  subconjuntada a los rangos que la app usa: **62 KB por peso** en vez de 2.2 MB. La licencia
  está en `frontend/public/fonts/OFL.txt`.
- **Tokens**: `frontend/src/styles/design-tokens.css` (color, tipografía, espaciado)
- **Cromo**: `frontend/src/styles/terminal.css` (paneles, barra, rejilla, portales)
- **Marcadores de las filas en ASCII**, no en símbolos raros: depender de que el terminal
  traiga un glifo es pedir que un día salga una caja.
- **El cromo fijo va en un portal** sobre `document.body`. La página se anima con `transform`,
  y un ancestro con `transform` se convierte en el bloque contenedor del `position: fixed` de
  sus descendientes: sin el portal, los modales se centran dentro de una caja más pequeña que
  la ventana y la barra nunca llega al borde inferior.

---

## Tests

```bash
cd backend  && ./mvnw test          # 68 tests
cd frontend && npm run typecheck    # TypeScript en modo estricto
cd frontend && npm test            # 55 tests
cd frontend && npm run test:e2e    # Playwright, 44

# El servidor MCP, de punta a punta contra el backend levantado:
cd mcp && KTLM_SERVICE_TOKEN=ktlm_... .venv/bin/python smoke.py
```

Los e2e interceptan la API, así que no necesitan el backend levantado. En el CI corren los
cuatro, con el typecheck y los e2e antes del build.

---

## Limitaciones conocidas

- **Una línea sin `uid:` se duplica** si el archivo se edita por fuera dos veces antes de que la
  app escriba de vuelta. Cuando no hay ambigüedad se reconoce por contenido; con dos tareas
  idénticas no se adivina. En cuanto la app escribe, el ciclo es estable.
- La captura por QR es un **generador**, no un lector: muestra la dirección de la app para
  abrirla en el móvil. Es lo que hace tuxedo y es lo que se puede hacer sin pedirle a la app
  que use la cámara.

### Notas

`o` escribe la nota de la tarea del cursor; `O` abre la que ya tiene. En el archivo
`note:` **no guarda el texto, guarda una ruta** —igual que en tuxedo—, y el texto vive en
un archivo del directorio del usuario.

No es una decisión de gusto. El token se separa por espacios, así que un texto de varias
palabras se truncaría en la primera; y una nota de verdad suele tener varias líneas. Con un
archivo de por medio caben las dos cosas.

```
2026-10-07 Llamar a pagos +trabajo note:notas/nota-46.md uid:46
```

La ruta es relativa al directorio del usuario y se valida antes de tocarla: sin `..` y
comprobando que el archivo resuelto sigue dentro, incluidos los enlaces simbólicos, que
salen del directorio aunque la ruta «parezca» interna.

Las notas no se escriben desde `/batch` a propósito: son una ruta y por lo tanto hay que
validarlas, y meterlas en el lote dejaría esa puerta abierta.

### Temas, densidad y números de línea

`T` abre el selector, `D` cambia la densidad y `L` enciende los números de línea. Los seis
temas son los de tuxedo —noir, dawn, muted-slate, nord, catppuccin, gruvbox— y dawn es el
único claro: cambiar a él apaga el modo oscuro, porque pedir un tema claro sobre sombras de
oscuro queda peor que no tener temas.

`?` muestra un QR con la dirección de la app para abrirla en el móvil.

---

## Servidor MCP

`mcp/` es un servidor MCP que habla con la API y expone doce herramientas: `listar`,
`obtener`, `agregar`, `actualizar`, `completar`, `deshacer`, `borrar`, `reorganizar`,
`archivo`, `quien_soy`, `leer_nota` y `escribir_nota`.

No reimplementa nada: las reglas de formato, los `uid` y la escritura del archivo son los del
servidor, así que no puede desincronizarse de la web.

```bash
cd mcp
python3 -m venv .venv && .venv/bin/pip install -e .
export KTLM_SERVICE_TOKEN=ktlm_...      # se crea en la app, en la barra: «tokens»
.venv/bin/python -m ktlm_mcp.server    # stdio, por defecto
```

### Credenciales

Usa **tokens de servicio**, no JWT. Uno por usuario y por herramienta, que se revocan sin
invalidar la sesión de quien los creó, y que no pueden archivar tareas: esa decisión es de
una persona.

### Por qué `/batch`

`reorganizar` no es azúcar sobre n llamadas. Sin él, un agente que mueve veinte tareas hace
veinte peticiones y el `todo.txt` se reescribe veinte veces, con la posibilidad de que otra
cosa se cuele entremedias. El lote es una transacción —o entra todo, o nada— y escribe el
archivo una sola vez al final. También evita tener que cargar el `todo.txt` entero en cada paso.

Por eso **toda** escritura del servidor MCP pasa por `/batch`, incluso la de una sola
operación: el navegador lleva su propio espejo del archivo, este cliente no, y el lote es el
único camino que lo escribe.

### Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `KTLM_API_URL` | `http://localhost:8080` | Dónde está la API |
| `KTLM_SERVICE_TOKEN` | — | Obligatoria. El token de servicio |
| `KTLM_MCP_TRANSPORT` | `stdio` | `http` para streamable-http en el puerto `KTLM_MCP_PORT` |

---

## Seguridad

- **Sin secretos en el repositorio.** `.env` está ignorado y `.env.example` es la
  plantilla, sin nada dentro. `JWT_SECRET` y `DB_PASSWORD` no tienen valor por defecto:
  `docker compose up` se niega a arrancar si faltan, diciendo cuál.
- **`.dockerignore` en cada contexto.** El de la raíz no sirve: el contexto del build es
  `./backend` y `./frontend`, así que hay uno en cada uno. Sin eso, un `.env` se iba a la
  capa del builder con `COPY . .`.
- **Postgres no se publica.** El backend llega a la base por la red de compose. Antes
  estaba en `0.0.0.0:5432` con la contraseña `PLACEHOLDER_LEE_EL_ENV` escrita en el fichero.
- **Login y registro limitados**: diez intentos por cuenta cada quince minutos. El login
  se cuenta por nombre de usuario —una IP se rota en un segundo, un nombre no— y el
  registro por IP, porque al revés sería un arma para bloquear la cuenta de otro.
- **Registro validado de verdad.** Las restricciones estaban en la entidad `User`, que es
  lo que se guarda, así que `@Valid` no miraba nada: una contraseña de un carácter se
  guardaba hasheada.
- **El rol es una lista cerrada**, no texto libre: `POST /api/admin/users/roles` escribía
  en `user_roles` lo que le mandaran.
- **Los errores 500 no devuelven el mensaje.** Varios incluyen rutas absolutas del
  servidor.
- **Cabeceras**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`.
- **`/api/auth/**` ya no es `permitAll`**, solo `login` y `register`. Con el comodín, un
  endpoint nuevo en ese controlador sin `@PreAuthorize` quedaba público.

---

## Licencia

MIT. `todo.txt` es un formato abierto de Gina Trapani; la tipografía, Inconsolata Nerd Font, es
SIL OFL 1.1.
