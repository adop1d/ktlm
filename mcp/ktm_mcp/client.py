"""Cliente de la API de KTM para el servidor MCP.

Habla por HTTP contra el mismo servicio que usa el navegador. Autentica con token de
servicio, no con JWT: es una credencial pensada para esto y revocable sin invalidar la
sesión de quien la creó.

**Toda escritura pasa por `/api/tasks/batch`, incluidas las de una sola operación.** No
es azúcar: el navegador lleva su propio espejo del archivo y lo manda entero en cada
cambio, pero este cliente no lo lleva. Si una escritura no pasa por el lote, el cambio
llega a la base de datos y no se refleja nunca en el todo.txt —que es justo la fuente de
verdad. El lote es el único camino que escribe el archivo, así que hay un solo camino y
es el correcto.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

BASE_URL = os.environ.get("KTM_API_URL", "http://localhost:8080").rstrip("/")
SERVICE_TOKEN = os.environ.get("KTM_SERVICE_TOKEN", "")

PAGE_SIZE = int(os.environ.get("KTM_PAGE_SIZE", "50"))


class KtmError(RuntimeError):
    """Lo que devolvió la API y no se pudo usar."""


@dataclass
class Task:
    uid: int
    todo_uid: str | None
    title: str
    done: bool
    created: str
    completed: str | None
    due: str | None
    priority: str
    projects: list[str]
    contexts: list[str]


def _headers() -> dict[str, str]:
    if not SERVICE_TOKEN:
        raise KtmError(
            "Falta KTM_SERVICE_TOKEN. Créalo en la app, en Tokens de servicio, y pásalo "
            "por el entorno."
        )
    return {"Authorization": f"Service {SERVICE_TOKEN}"}


def _check(res: httpx.Response) -> httpx.Response:
    if res.status_code >= 400:
        detail = res.text.strip()[:300]
        if res.status_code == 401:
            detail = "el token de servicio no es válido o está revocado"
        raise KtmError(f"HTTP {res.status_code}: {detail}")
    return res


def _to_task(raw: dict[str, Any]) -> Task:
    return Task(
        # uid es el id de la API, que es lo que llevan las URLs. El número que aparece
        # en el archivo es otra cosa, todo_uid: son dos identidades y no conviene
        # confundirlas, porque con la segunda las URLs no funcionan.
        uid=int(raw["id"]),
        todo_uid=raw.get("todoUid"),
        title=raw.get("title", ""),
        done=bool(raw.get("completed")),
        created=raw.get("createdAt", ""),
        completed=raw.get("completedAt"),
        due=raw.get("dueDate"),
        priority=raw.get("priority", "MEDIUM"),
        projects=list(raw.get("projects") or []),
        contexts=list(raw.get("contexts") or []),
    )


def batch(operations: list[dict[str, Any]]) -> dict[str, Any]:
    """Aplica operaciones de una en una o de veinte en una: el mismo camino."""
    with httpx.Client(timeout=30.0) as client:
        res = _check(client.post(
            f"{BASE_URL}/api/tasks/batch",
            json={"operations": operations},
            headers={**_headers(), "Content-Type": "application/json"},
        ))
    return res.json()


def list_tasks(
    filter: str = "all",
    page: int = 0,
    size: int = PAGE_SIZE,
    search: str | None = None,
    projects: list[str] | None = None,
) -> tuple[list[Task], int, int]:
    """Una página de tareas y los totales, para poder decir si hay más detrás."""
    params: dict[str, Any] = {"page": page, "size": size, "filter": filter, "sort": "file"}
    if search:
        params["search"] = search
    if projects:
        params["projects"] = ",".join(projects)
    with httpx.Client(timeout=20.0) as client:
        page_body = _check(client.get(f"{BASE_URL}/api/tasks", params=params, headers=_headers())).json()
        counts = client.get(f"{BASE_URL}/api/tasks/counts",
                            params={"search": search} if search else None, headers=_headers())
        total_filtered = int(page_body["totalElements"])
        all_count = int(counts.json().get("all", total_filtered)) if counts.status_code == 200 else total_filtered
    return [_to_task(t) for t in page_body["content"]], all_count, total_filtered


def get_task(uid: int) -> Task:
    with httpx.Client(timeout=20.0) as client:
        return _to_task(_check(client.get(f"{BASE_URL}/api/tasks/{uid}", headers=_headers())).json())


def create_task(
    title: str,
    projects: list[str] | None = None,
    contexts: list[str] | None = None,
    priority: str = "MEDIUM",
    due_date: str | None = None,
) -> Task:
    """Crea y devuelve la tarea ya creada, con su uid."""
    result = batch([{"op": "create", "title": title, "projects": projects,
                     "contexts": contexts, "priority": priority, "dueDate": due_date}])
    uid = int(result["results"][0].get("uid") or 0)
    return get_task(uid)


def update_task(
    uid: int,
    title: str | None = None,
    projects: list[str] | None = None,
    contexts: list[str] | None = None,
    priority: str | None = None,
    due_date: str | None = None,
) -> Task:
    """Cambia solo lo que se informa; lo demás se queda. Va por el lote y por tanto escribe el archivo."""
    operation: dict[str, Any] = {"op": "update", "uid": uid}
    if title is not None:
        operation["title"] = title
    if projects is not None:
        operation["projects"] = projects
    if contexts is not None:
        operation["contexts"] = contexts
    if priority is not None:
        operation["priority"] = priority
    if due_date is not None:
        operation["dueDate"] = due_date
    batch([operation])
    return get_task(uid)


def toggle_task(uid: int) -> Task:
    batch([{"op": "toggle", "uid": uid}])
    return get_task(uid)


def delete_task(uid: int) -> None:
    batch([{"op": "delete", "uid": uid}])


def read_file() -> str:
    """El todo.txt tal cual, con comentarios y formato. Para leer, no para editar."""
    with httpx.Client(timeout=20.0) as client:
        return _check(client.get(f"{BASE_URL}/api/tasks/file", headers=_headers())).text