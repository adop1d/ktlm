"""MCP server for KTLM.

Talks to the API over HTTP. It reimplements nothing: the formatting rules, the uids and
the file are the server's, and that is why this cannot drift out of sync with the web.

Authentication: service token (`Authorization: Service <token>` header), not JWT. It is a
credential meant for automation and it is revocable without invalidating the session of
whoever created it. The token cannot archive: that operation was decided to be a human's.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer

from . import client as api

INSTRUCTIONS = """\
Manages KTLM's todo.txt. Every task has a `uid`, which is its identifier in the API and
the one every tool takes. It is a different number from the one that appears in the file
(`uid_en_el_archivo`), which is what you would see editing the todo.txt by hand.

Use `listar` to read, `agregar` and `actualizar` to change, `completar` to mark and
`deshacer` to go back. `reorganizar` is the correct way to move tasks: send all the
operations in a single batch and either all of them go in or none does.

For several changes in a row, always prefer `reorganizar`: one transactional call that
writes the file once, versus n calls that rewrite it n times.
"""

server = MCPServer(
    name="ktlm",
    instructions=INSTRUCTIONS,
    version="1.0.0",
)


def _task_dict(task: api.Task) -> dict[str, Any]:
    return {
        "uid": task.uid,
        "uid_en_el_archivo": task.todo_uid,
        "titulo": task.title,
        "hecha": task.done,
        "creada": task.created,
        "completada": task.completed,
        "vence": task.due,
        "prioridad": task.priority,
        "recurrencia": task.recurrence,
        "nota": task.note,
        "proyectos": task.projects,
        "contextos": task.contexts,
    }


@server.tool()
def listar(
    filtro: Literal["all", "active", "completed"] = "all",
    pagina: int = 0,
    tamano: int = 50,
    busqueda: str | None = None,
    proyectos: list[str] | None = None,
) -> dict[str, Any]:
    """Lists tasks with pagination. `pagina` starts at 0.

    Also returns the totals, so you can tell whether there is more behind what you see.
    """
    tasks, total, matching = api.list_tasks(filter=filtro, page=pagina, size=tamano,
                                            search=busqueda, projects=proyectos)
    return {
        "tareas": [_task_dict(t) for t in tasks],
        "pagina": pagina,
        "paginas": max(1, -(-total // max(1, tamano))),
        "total": total,
        "coinciden": matching,
    }


@server.tool()
def obtener(uid: int) -> dict[str, Any]:
    """One task by its uid."""
    return _task_dict(api.get_task(uid))


@server.tool()
def agregar(
    titulo: str,
    proyectos: list[str] | None = None,
    contextos: list[str] | None = None,
    prioridad: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM",
    vence: str | None = None,
) -> dict[str, Any]:
    """Creates a task. `proyectos` go without the + sign; `vence` in YYYY-MM-DD."""
    return _task_dict(api.create_task(titulo, proyectos, contextos, prioridad, vence))


@server.tool()
def actualizar(
    uid: int,
    titulo: str | None = None,
    proyectos: list[str] | None = None,
    contextos: list[str] | None = None,
    prioridad: Literal["LOW", "MEDIUM", "HIGH"] | None = None,
    vence: str | None = None,
    recurrencia: str | None = None,
) -> dict[str, Any]:
    """Changes a task. Whatever you don't say stays as it is.

    `recurrencia` is the literal of the `rec:` token: "daily", "+1m", "+2w", "eom".
    For notes use `escribir_nota`, not this one: here the note would be an unvalidated path.
    """
    return _task_dict(api.update_task(uid, titulo, proyectos, contextos, prioridad, vence,
                                      recurrencia))


@server.tool()
def leer_nota(uid: int) -> str:
    """The text of a task's note. Empty if it has none."""
    return api.read_note(uid)


@server.tool()
def escribir_nota(uid: int, texto: str) -> dict[str, Any]:
    """Saves a task's note. Empty text deletes it and drops the `note:` token."""
    return api.write_note(uid, texto)


@server.tool()
def completar(uid: int) -> dict[str, Any]:
    """Marks a task as done."""
    return _task_dict(api.toggle_task(uid))


@server.tool()
def deshacer(uid: int) -> dict[str, Any]:
    """Marks a task as pending again. The same operation, reversed."""
    return _task_dict(api.toggle_task(uid))


@server.tool()
def borrar(uid: int) -> dict[str, Any]:
    """Deletes a task. It is the hardest thing to undo: there is no way back."""
    api.delete_task(uid)
    return {"borrada": uid}


@server.tool()
def reorganizar(operaciones: list[dict[str, Any]]) -> dict[str, Any]:
    """Applies several operations as a single unit.

    Each operation is an object with `op` and its fields:

        {"op": "create", "titulo": "...", "proyectos": ["casa"]}
        {"op": "update", "uid": 12, "titulo": "..."}
        {"op": "toggle", "uid": 12}
        {"op": "delete", "uid": 12}

    Fields that do not appear are kept. If one operation fails, none is applied:
    a half-done reorder is worse. Maximum 200 operations.
    """
    res = api.batch([_traducir(op) for op in operaciones])
    return {"aplicadas": res.get("applied", 0), "resultados": res.get("results", [])}


# The agent reasons in Spanish and the API speaks English. Translating here keeps a
# rename out of every tool and leaves the HTTP contract in a single language.
_CAMPOS = {"titulo": "title", "vence": "dueDate", "prioridad": "priority",
           "proyectos": "projects", "contextos": "contexts"}


def _traducir(op: dict[str, Any]) -> dict[str, Any]:
    return {(_CAMPOS.get(k, k)): v for k, v in op.items()}


@server.tool()
def archivo() -> str:
    """The complete todo.txt, as-is, with comments and formatting. For reading, not editing."""
    return api.read_file()


@server.tool()
def quien_soy() -> str:
    """Checks that the service token works and returns the user's file."""
    try:
        tasks, total, _ = api.list_tasks(size=1)
        return f"token valid · {total} tasks"
    except api.KtmError as e:
        return f"the token does not work: {e}"


def main() -> None:
    transport = os.environ.get("KTLM_MCP_TRANSPORT", "stdio")
    if transport == "http":
        server.run(transport="streamable-http", port=int(os.environ.get("KTLM_MCP_PORT", "8765")))
    else:
        server.run()


if __name__ == "__main__":
    main()