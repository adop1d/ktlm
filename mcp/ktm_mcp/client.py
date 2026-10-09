"""API client for KTM, used by the MCP server.

Speaks HTTP against the same service the browser uses. Authenticates with a service
token, not JWT: it is a credential meant for this and revocable without invalidating the
session of whoever created it.

**Every write goes through `/api/tasks/batch`, including single-operation ones.** It is
not sugar: the browser carries its own mirror of the file and sends it whole on every
change, but this client does not. If a write doesn't go through the batch, the change
reaches the database and is never reflected in the todo.txt — which is exactly the source
of truth. The batch is the only path that writes the file, so there is one path and it is
the right one.
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
    """What the API returned and could not be used."""


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
    recurrence: str | None
    note: str | None
    projects: list[str]
    contexts: list[str]


def _headers() -> dict[str, str]:
    if not SERVICE_TOKEN:
        raise KtmError(
            "KTM_SERVICE_TOKEN is missing. Create it in the app, under service tokens, "
            "and pass it in the environment."
        )
    return {"Authorization": f"Service {SERVICE_TOKEN}"}


def _check(res: httpx.Response) -> httpx.Response:
    if res.status_code >= 400:
        detail = res.text.strip()[:300]
        if res.status_code == 401:
            detail = "the service token is not valid, or it has been revoked"
        raise KtmError(f"HTTP {res.status_code}: {detail}")
    return res


def _to_task(raw: dict[str, Any]) -> Task:
    return Task(
        # uid is the API id, the one the URLs take. The number that appears in the file
        # is something else, todo_uid: they are two identities and shouldn't be confused,
        # because with the second one the URLs don't work.
        uid=int(raw["id"]),
        todo_uid=raw.get("todoUid"),
        title=raw.get("title", ""),
        done=bool(raw.get("completed")),
        created=raw.get("createdAt", ""),
        completed=raw.get("completedAt"),
        due=raw.get("dueDate"),
        priority=raw.get("priority", "MEDIUM"),
        recurrence=raw.get("recurrence"),
        note=raw.get("note"),
        projects=list(raw.get("projects") or []),
        contexts=list(raw.get("contexts") or []),
    )


def batch(operations: list[dict[str, Any]]) -> dict[str, Any]:
    """Applies operations one at a time or twenty at a time: the same path."""
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
    """A page of tasks plus the totals, so you can tell whether there is more behind."""
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
    """Creates and returns the task already created, with its uid."""
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
    recurrence: str | None = None,
) -> Task:
    """Changes only what is reported; the rest stays. It goes through the batch, so it writes the file."""
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
    if recurrence is not None:
        operation["recurrence"] = recurrence
    batch([operation])
    return get_task(uid)


def toggle_task(uid: int) -> Task:
    batch([{"op": "toggle", "uid": uid}])
    return get_task(uid)


def delete_task(uid: int) -> None:
    batch([{"op": "delete", "uid": uid}])


def read_file() -> str:
    """The todo.txt as-is, with comments and formatting. For reading, not editing."""
    with httpx.Client(timeout=20.0) as client:
        return _check(client.get(f"{BASE_URL}/api/tasks/file", headers=_headers())).text

def read_note(uid: int) -> str:
    """The text of the note. Empty if the task has none."""
    with httpx.Client(timeout=20.0) as client:
        return _check(client.get(f"{BASE_URL}/api/tasks/{uid}/note", headers=_headers())).text


def write_note(uid: int, text: str) -> dict[str, Any]:
    """Saves the note. Emptying deletes the file and drops the `note:` token from the line.

    It deliberately goes through its own endpoint rather than the batch: the note is a
    path inside the user's directory, and the endpoint is where it gets validated against
    escaping it.
    """
    with httpx.Client(timeout=20.0) as client:
        res = _check(client.put(
            f"{BASE_URL}/api/tasks/{uid}/note",
            content=text.encode("utf-8"),
            headers={**_headers(), "Content-Type": "text/plain;charset=UTF-8"},
        ))
    return res.json()
