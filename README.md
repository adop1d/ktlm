# KTM

A `todo.txt` manager driven by [tuxedo](https://github.com/webstonehq/tuxedo)'s keys. It
reads and writes the same `todo.txt` you already use — the file belongs to the server, so the
browser, a phone and an MCP agent all see one list, not three copies.

Full documentation lives in the app at **`/docs`**, and in English as well as Spanish.

---

## Running it

```bash
cp .env.example .env
printf 'JWT_SECRET=%s\n' "$(openssl rand -base64 48)" >> .env
printf 'DB_PASSWORD=%s\n' "$(openssl rand -base64 24)"  >> .env

docker compose up -d
```

Web on <http://localhost/>, API on `:8080`. Register at `/login`.

The `.env` is required: compose refuses to start without the two keys, on purpose. Start
with a secret that lives in a repository is worse than not starting.

Without Docker, with your own Postgres on `localhost:5432`:

```bash
cd backend  && DB_URL=jdbc:postgresql://localhost:5432/postgres \
              DB_USERNAME=tu_usuario DB_PASSWORD=tu_clave JWT_SECRET=... ./mvnw spring-boot:run
cd frontend && npm install && npm run dev
```

Java 21, Node 22, PostgreSQL 17.

---

## Stack

| | |
|---|---|
| Backend | Java 21 · Spring Boot 3.4 · Spring Data JPA · Flyway · Spring Security · jjwt |
| Frontend | React 18 · TypeScript (strict) · Vite 6 · Tailwind 3 · Zustand · TanStack Query |
| MCP | Python 3.11+ · the official `mcp` SDK |
| Database | PostgreSQL 17 |
| CI | GitHub Actions |

---

## Layout

```
backend/     Spring Boot. The todo.txt codec, the file store, the API.
frontend/    React. The list, the keymap engine, the line editor.
mcp/         MCP server. Twelve tools over the same API.
docs/        Design notes and the tuxedo compatibility plan.
```

The `todo.txt` for each user lives on the server under
`<data-dir>/<userId>/`: `todo.txt`, `done.txt`, `inbox.txt` and `notas/`. The database is an
index over that file for filtering and paging; the file is what everything else reads.

---

## Tests

```bash
cd backend  && ./mvnw test        # 70
cd frontend && npm run typecheck  # strict
cd frontend && npm test           # 65
cd frontend && npm run test:e2e   # 56

cd mcp && KTM_SERVICE_TOKEN=ktm_... .venv/bin/python smoke.py
```

The e2e intercept the API, so they do not need the backend running.

---

## MCP server

Twelve tools over the REST API. Auth with a **service token**, created from the app bar
(`tokens`); it revokes without logging you out and cannot archive tasks. Full setup in
`/docs`.

```bash
cd mcp
python3 -m venv .venv && .venv/bin/pip install -e .
export KTM_API_URL=http://localhost:8080
export KTM_SERVICE_TOKEN=ktm_...
.venv/bin/python -m ktm_mcp.server     # stdio
```

Every write goes through `POST /api/tasks/batch`: one transaction, so either the whole set
lands or none of it does, and the file is written once. The browser carries its own mirror of
the file and PUTs it whole; this client does not, and the batch is the only path that writes.

---

## API

| Method | Route | |
|---|---|---|
| `POST` | `/api/tasks/batch` | Several operations, one transaction |
| `GET` | `/api/tasks/file` | The user's `todo.txt`, as `text/plain` |
| `PUT` | `/api/tasks/file` | Replaces it; returns the reconciled version |
| `POST` | `/api/tasks/file/rebuild` | Rewrites the file from the database |
| `GET` | `/api/tasks/archived` | `done.txt` |
| `POST` | `/api/tasks/inbox` | Appends one line of capture |
| `GET`/`PUT` | `/api/tasks/{id}/note` | The text behind `note:` |
| `POST` | `/api/tasks/archive` | Moves completed tasks to `done.txt` |
| `GET` | `/api/tasks/stream` | SSE, changes for this account |
| `POST` | `/api/auth/service-tokens` | Issues a service token, returned once |

---

## Known limitations

- A line without `uid:` has no identity, so it duplicates if the file is edited twice before
  the app writes back. When the match is unambiguous it is recognised by content; with two
  identical tasks there is nothing to guess.
- The QR is a **generator**, not a reader: it shows the address to open the app on the phone.
- Sidebars and a dedicated notes panel are out of scope, and that is not only because they
  are missing — without a real panel the `[` shortcut would be the kind of shortcut that
  pretends to work.

---

## License

MIT. `todo.txt` is Gina Trapani's open format. Inconsolata Nerd Font is SIL OFL 1.1.
