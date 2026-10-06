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

## El atajo de las teclas

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
| `POST` | `/api/tasks/archive` | Manda las completadas a `done.txt` |

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
cd backend  && ./mvnw test          # 41 tests
cd frontend && npm run typecheck    # TypeScript en modo estricto
cd frontend && npm test            # 58 tests
cd frontend && npm run test:e2e    # Playwright
```

Los e2e interceptan la API, así que no necesitan el backend levantado. En el CI corren los
cuatro, con el typecheck y los e2e antes del build.

---

## Limitaciones conocidas

- **El archivo solo se sincroniza desde el navegador en Chromium.** Es lo que soporta la File
  System Access API. Fuera de ahí la app funciona igual contra el servidor, pero el espejo no
  escribe en disco y la interfaz lo dice.
- **Una línea sin `uid:` se duplica** si el archivo se edita por fuera dos veces antes de que la
  app escriba de vuelta. Cuando no hay ambigüedad se reconoce por contenido; con dos tareas
  idénticas no se adivina. En cuanto la app escribe, el ciclo es estable.
- **La lista se sincroniza desde el navegador, no desde el móvil.** El móvil puede escribir por
  `inbox.txt`, pero no refleja cambios hechos en el escritorio hasta que el navegador sondea.
- Notas (`o` / `O`) y algunas acciones puramente decorativas de tuxedo —temas, densidad,
  números de línea, captura por QR— no están implementadas.

## Licencia

MIT. `todo.txt` es un formato abierto de Gina Trapani; la tipografía, Inconsolata Nerd Font, es
SIL OFL 1.1.
