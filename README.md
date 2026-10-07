# Kelvin's tuxedo like manager

A `todo.txt` manager that speaks your file's language and is driven by terminal keys.

It does not keep the tasks in some proprietary database: **it reads and writes the same
`todo.txt` you already use**. If you have [tuxedo](https://github.com/webstonehq/tuxedo)
open next to it, both see the same thing, they reconcile, and neither clobbers the other.

---

## Quick start

```bash
docker compose up -d
```

- Landing page and app: <http://localhost/>
- API: <http://localhost:8080/api>

Without Docker:

```bash
# backend (necesita un Postgres en localhost:5432)
cd backend && DB_URL=jdbc:postgresql://localhost:5432/postgres \
  DB_USERNAME=tu_usuario DB_PASSWORD= ./mvnw spring-boot:run

# frontend
cd frontend && npm install && npm run dev
```

Requirements: Java 21, Node 22 and PostgreSQL.

## Routes

| Route | What it is |
|---|---|
| `/` | Public landing page. Explains what this is before asking you for an account |
| `/login` | Sign in and sign up |
| `/app` | The list. Protected: no session, it sends you to login |

---

## The keys

The shortcuts are **tuxedo's**, not an invented set. If you already have your
`~/.config/tuxedo/keybinds.toml` tweaked, the web reads it.

| Key | What it does |
|---|---|
| `j` `k` | Move the cursor |
| `gg` `G` | First and last |
| `Ctrl-d` `Ctrl-u` | Half page |
| `n` | New task |
| `e` `i` | Edit (normal mode / insert mode) |
| `x` | Complete |
| `d` `d` | Delete |
| `p` | Cycle priority: `(A)` → `(B)` → `(C)` → none |
| `J` `K` | Move the task's position |
| `r` | Recurrence (`rec:`) |
| `u` | Undo, 50 steps |
| `c` `+` | Add context / project |
| `y` `y` / `y` `b` | Copy the line / the text |
| `v` `space` | Multiple selection |
| `/` | Search |
| `f` `s` | Save the current search |
| `f` `f` | Open a saved search |
| `f` `p` / `f` `c` | Filter by project / context |
| `[` `]` | Filter panel / detail panel |
| `a` | View `done.txt` |
| `A` | Archive completed to `done.txt` |
| `:` or `Ctrl-P` | Command palette |
| `?` | All shortcuts |

Without a linked `todo.txt`, the actions that need a `uid` — `x`, `p`, `J`, `dd`, `u`,
`A`— **switch off and the status bar says so**. A shortcut that cannot act announces
itself; it never does nothing silently.

---

## todo.txt interoperability

### How a task is recognized across two programs

Every line carries a `uid:` token. Tuxedo keeps any `key:value` it doesn't know, so
adding it produces a file that is still a valid `todo.txt` for it and, at the same time,
lets file and database reconcile without duplicating. If you don't want to see it, in
`~/.config/tuxedo/config.toml`:

```toml
hide_keys = uid
```

### Capture

Anything that knows how to write a line to the sibling `inbox.txt` creates a task:

```sh
echo "Llamar al dentista mañana" >> ~/ruta/todo/../inbox.txt
```

The app drains it on every poll, applies the same natural-language grammar as the `n`
prompt, and empties it before importing so nothing gets reprocessed.

### Endpoints

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/tasks/import` | `text/plain` → upsert by `uid`, returns the reconciled file |
| `GET` | `/api/tasks/export` | The user's complete `todo.txt` |
| `POST` | `/api/tasks/batch` | Several operations in one transaction. Either all go in, or none |
| `POST` | `/api/tasks/archive` | Sends completed to `done.txt` |
| `GET` | `/api/tasks/file` | The user's `todo.txt`, as-is (`text/plain`) |
| `PUT` | `/api/tasks/file` | Replaces the whole file and returns the reconciled version |
| `GET` | `/api/tasks/archived` | What's in `done.txt` |
| `GET` | `/api/tasks/stream` | Changes to this account over SSE |
| `GET` | `/api/tasks/{id}/note` | The note text (`text/plain`) |
| `PUT` | `/api/tasks/{id}/note` | Saves the note. Emptying deletes the file and drops `note:` |
| `POST` | `/api/auth/service-tokens` | Issues a service token. Returned **once** |

---

## Architecture

```
┌─ browser ──────────────────────┐      ┌─ Spring Boot ─────────────────┐
│  TodoDoc   the file's mirror    │      │  TodoTxtCodec                 │
│  useKeymap vim/chord engine     │─────▶│  TodoStore      the file      │
│  FileHandlePort  import from disk│     │  TodoFileWatcher watcher      │
└───────────────────────────────┘      └───────────┬────────────────────┘
                                                       │ index
                                              ┌────────▼────────┐
                                              │ Postgres + Flyway│
                                              └─────────────────┘
```

- **The file is the source of truth; the database is the index.** The server keeps each
  user's `todo.txt` in their directory and only rebuilds it from the database when
  needed. That way the phone, the desktop and the MCP server all see the same thing,
  and writing from outside isn't a special case: it's the normal path.
- **External changes**: a filesystem watcher detects them; every 30 s a sweep compares
  the hash in case the system didn't notify —Docker uses overlayfs and doesn't always
  notify—. If it doesn't match, **the file wins** and it reloads, discarding the undo
  history, same as tuxedo does.
- **Pending write**: a local patch marks the hash invalid; the watcher doesn't reconcile
  until the dump finishes, or it would undo what was just written.
- **Flyway** is the only source of the schema: `V1` the baseline, `V2` the todo.txt
  fields, `V3` the service tokens and `V4` the notes.

### Stack

- **Backend**: Java 21 · Spring Boot 3.4 · Spring Data JPA · PostgreSQL 17 · JWT (jjwt)
- **Frontend**: React 18 · TypeScript · Vite 6 · TanStack Query 5 · Zustand · Tailwind 3
- **Tests**: JUnit 5 + Mockito (backend), Vitest (unit), Playwright (e2e)

---

## Design

A terminal interface, not a card one: a single monospace family for everything, rows with
fixed-width columns as cells, corners at zero, dark theme by default and a fixed status
bar at the bottom with the mode, the position, the counters and the chord leader.

- **Font**: [Inconsolata Nerd Font](https://www.nerdfonts.com/) (SIL OFL 1.1), self-hosted
  and subset to the ranges the app uses: **62 KB per weight** instead of 2.2 MB. The
  licence is in `frontend/public/fonts/OFL.txt`.
- **Tokens**: `frontend/src/styles/design-tokens.css` (colour, typography, spacing)
- **Chrome**: `frontend/src/styles/terminal.css` (panels, bar, grid, portals)
- **Row markers in ASCII**, not in weird symbols: depending on the terminal shipping a
  glyph is asking for a box to show up one day.
- **Fixed chrome goes in a portal** over `document.body`. The page animates with
  `transform`, and an ancestor with `transform` becomes the containing block for its
  descendants' `position: fixed`: without the portal, modals centre inside a box smaller
  than the window and the bar never reaches the bottom edge.

---

## Tests

```bash
cd backend  && ./mvnw test          # 68 tests
cd frontend && npm run typecheck    # TypeScript en modo estricto
cd frontend && npm test            # 55 tests
cd frontend && npm run test:e2e    # Playwright, 44

# The MCP server, end to end against a running backend:
cd mcp && KTLM_SERVICE_TOKEN=ktlm_... .venv/bin/python smoke.py
```

The e2e intercept the API, so they don't need the backend running. In CI all four run,
with the typecheck and the e2e before the build.

---

## Known limitations

- **A line without `uid:` gets duplicated** if the file is edited from outside twice
  before the app writes back. When there's no ambiguity it's recognized by content; with
  two identical tasks there's no guessing. Once the app writes, the cycle is stable.
- QR capture is a **generator**, not a reader: it shows the app's address so you can open
  it on your phone. That's what tuxedo does, and it's what you can do without asking the
  app to use the camera.

### Notes

`o` writes the note of the task under the cursor; `O` opens the one it already has. In the
file, `note:` **doesn't store the text, it stores a path** —same as in tuxedo— and the
text lives in a file in the user's directory.

It isn't a matter of taste. The token is space-separated, so multi-word text would be
truncated at the first word; and a real note usually has several lines. A file in between
accommodates both.

```
2026-10-07 Llamar a pagos +trabajo note:notas/nota-46.md uid:46
```

The path is relative to the user's directory and is validated before it gets touched: no
`..`, and checking that the resolved file stays inside — symlinks included, since they
leave the directory even when the path "looks" internal.

Notes are deliberately not writable from `/batch`: one is a path and therefore has to be
validated, and putting it in the batch would leave that door open.

### Themes, density and line numbers

`T` opens the picker, `D` changes the density and `L` turns on line numbers. The six
themes are tuxedo's —noir, dawn, muted-slate, nord, catppuccin, gruvbox— and dawn is the
only light one: switching to it turns off dark mode, because asking for a light theme
over dark shadows looks worse than not having themes at all.

`?` shows a QR with the app's address so you can open it on your phone.

---

## MCP server

`mcp/` is an MCP server that talks to the API and exposes twelve tools: `listar`,
`obtener`, `agregar`, `actualizar`, `completar`, `deshacer`, `borrar`, `reorganizar`,
`archivo`, `quien_soy`, `leer_nota` and `escribir_nota`.

It reimplements nothing: the formatting rules, the `uid`s and the file writing are the
server's, so it can't drift out of sync with the web.

```bash
cd mcp
python3 -m venv .venv && .venv/bin/pip install -e .
export KTLM_SERVICE_TOKEN=ktlm_...      # created in the app, in the bar: "tokens"
.venv/bin/python -m ktlm_mcp.server    # stdio, the default
```

### Credentials

It uses **service tokens**, not JWT. One per user and per tool, revocable without
invalidating the session of whoever created them, and they cannot archive tasks: that
decision belongs to a human.

### Why `/batch`

`reorganizar` isn't sugar on top of n calls. Without it, an agent moving twenty tasks
makes twenty requests and the `todo.txt` gets rewritten twenty times, with the chance of
something else slipping in between. The batch is a transaction —either all of it goes in,
or none— and it writes the file once at the end. It also avoids having to load the whole
`todo.txt` on every step.

That's why **every** write from the MCP server goes through `/batch`, even a
single-operation one: the browser carries its own mirror of the file, this client
doesn't, and the batch is the only path that writes it.

### Configuration

| Variable | Default | What it's for |
|---|---|---|
| `KTLM_API_URL` | `http://localhost:8080` | Where the API is |
| `KTLM_SERVICE_TOKEN` | — | Required. The service token |
| `KTLM_MCP_TRANSPORT` | `stdio` | `http` for streamable-http on the `KTLM_MCP_PORT` port |

---

## Security

- **No secrets in the repository.** `.env` is ignored and `.env.example` is the template,
  empty. `JWT_SECRET` and `DB_PASSWORD` have no default: `docker compose up` refuses to
  start if they're missing, and says which one.
- **`.dockerignore` in every context.** The root one is useless: the build context is
  `./backend` and `./frontend`, so there's one in each. Without that, a `.env` rode into
  the builder layer with `COPY . .`.
- **Postgres isn't published.** The backend reaches the database over the compose network.
  It used to sit on `0.0.0.0:5432` with a password written into the file itself.
- **Login and signup are rate-limited**: ten attempts per account every fifteen minutes.
  Login is counted by username —an IP rotates in a second, a username doesn't— and signup
  by IP, because the other way round would be a weapon for locking someone else's account
  out.
- **Signup is genuinely validated.** The constraints lived on the `User` entity, which is
  what gets persisted, so `@Valid` wasn't looking at anything: a one-character password
  was stored, hashed.
- **The role is a closed list**, not free text: `POST /api/admin/users/roles` wrote
  whatever you sent it into `user_roles`.
- **500 errors don't return the message.** Several include absolute server paths.
- **Headers**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`.
- **`/api/auth/**` is no longer `permitAll`**, only `login` and `register`. With the
  wildcard, a new endpoint in that controller without `@PreAuthorize` ended up public.

---

## License

MIT. `todo.txt` is an open format by Gina Trapani; the typeface, Inconsolata Nerd Font, is
SIL OFL 1.1.
