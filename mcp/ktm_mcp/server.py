"""Servidor MCP para KTM.

Habla con la API por HTTP. No reimplementa nada: las reglas de formato, los uid y el
archivo son los del servidor, y por eso esto no puede desincronizarse de la web.

Autenticación: token de servicio (cabecera `Authorization: Service <token>`), no JWT. Es una
credencial pensada para automatización y se revoca sin invalidar la sesión de quien la creó.
El token no puede archivar: esa operación se decidió que es de una persona.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer

from . import client as api

INSTRUCTIONS = """\
Gestiona el todo.txt de KTM. Cada tarea tiene un `uid`, que es su identificador en la API
y el que llevan todas las herramientas. Es otro número distinto del que aparece en el
archivo (`uid_en_el_archivo`), que es el que verías editando el todo.txt a mano.

Usa `listar` para ver, `agregar` y `actualizar` para cambiar, `completar` para marcar y
`deshacer` para volver atrás. `reorganizar` es la manera correcta de mover tareas: envía
todas las operaciones en un solo lote y o entran todas o no entra ninguna.

Para varios cambios seguidos, prefiere siempre `reorganizar`: una llamada transaccional
que escribe el archivo una vez, frente a n llamadas que lo reescriben n veces.
"""

server = MCPServer(
    name="ktm",
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
    """Lista tareas con paginación. `pagina` empieza en 0.

    Devuelve también los totales para saber si hay más detrás de lo que se ve.
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
    """Una tarea por su uid."""
    return _task_dict(api.get_task(uid))


@server.tool()
def agregar(
    titulo: str,
    proyectos: list[str] | None = None,
    contextos: list[str] | None = None,
    prioridad: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM",
    vence: str | None = None,
) -> dict[str, Any]:
    """Crea una tarea. `proyectos` van sin el signo +; `vence` en AAAA-MM-DD."""
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
    """Cambia una tarea. Lo que no digas se queda como está.

    `recurrencia` es el literal del token `rec:`: "daily", "+1m", "+2w", "eom".
    Para las notas usa `escribir_nota`, no esta: aquí la nota sería una ruta sin validar.
    """
    return _task_dict(api.update_task(uid, titulo, proyectos, contextos, prioridad, vence,
                                      recurrencia))


@server.tool()
def leer_nota(uid: int) -> str:
    """El texto de la nota de una tarea. Vacío si no tiene."""
    return api.read_note(uid)


@server.tool()
def escribir_nota(uid: int, texto: str) -> dict[str, Any]:
    """Guarda la nota de una tarea. Texto vacío la borra y quita el token `note:`."""
    return api.write_note(uid, texto)


@server.tool()
def completar(uid: int) -> dict[str, Any]:
    """Marca una tarea como hecha."""
    return _task_dict(api.toggle_task(uid))


@server.tool()
def deshacer(uid: int) -> dict[str, Any]:
    """Vuelve a marcar una tarea como pendiente. La misma operación, al revés."""
    return _task_dict(api.toggle_task(uid))


@server.tool()
def borrar(uid: int) -> dict[str, Any]:
    """Elimina una tarea. Es lo más difícil de deshacer: no hay vuelta atrás."""
    api.delete_task(uid)
    return {"borrada": uid}


@server.tool()
def reorganizar(operaciones: list[dict[str, Any]]) -> dict[str, Any]:
    """Aplica varias operaciones como una sola unidad.

    Cada operación es un objeto con `op` y sus campos:

        {"op": "create", "titulo": "...", "proyectos": ["casa"]}
        {"op": "update", "uid": 12, "titulo": "..."}
        {"op": "toggle", "uid": 12}
        {"op": "delete", "uid": 12}

    Los campos que no aparecen se conservan. Si una operación falla, no se aplica ninguna:
    es mejor que un reordenado a medias. Máximo 200 operaciones.
    """
    res = api.batch([_traducir(op) for op in operaciones])
    return {"aplicadas": res.get("applied", 0), "resultados": res.get("results", [])}


# El agente razona en castellano y la API habla inglés. Traducir aquí evita ensuciar cada
# herramienta con un rename, y deja el contrato HTTP en un solo idioma.
_CAMPOS = {"titulo": "title", "vence": "dueDate", "prioridad": "priority",
           "proyectos": "projects", "contextos": "contexts"}


def _traducir(op: dict[str, Any]) -> dict[str, Any]:
    return {(_CAMPOS.get(k, k)): v for k, v in op.items()}


@server.tool()
def archivo() -> str:
    """El todo.txt completo, tal cual, con comentarios y formato. Para leer, no para editar."""
    return api.read_file()


@server.tool()
def quien_soy() -> str:
    """Comprueba que el token de servicio funciona y devuelve el archivo del usuario."""
    try:
        tasks, total, _ = api.list_tasks(size=1)
        return f"token válido · {total} tareas"
    except api.KtmError as e:
        return f"el token no sirve: {e}"


def main() -> None:
    transport = os.environ.get("KTM_MCP_TRANSPORT", "stdio")
    if transport == "http":
        server.run(transport="streamable-http", port=int(os.environ.get("KTM_MCP_PORT", "8765")))
    else:
        server.run()


if __name__ == "__main__":
    main()