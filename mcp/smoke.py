"""Talks to the MCP server over stdio and checks that the tools do what they say.

Not a unit test: it starts the real server and asks it for tools over the protocol.
It's the only thing that proves it starts, announces itself and answers.

    KTLM_SERVICE_TOKEN=ktlm_... .venv/bin/python smoke.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def texto(resultado) -> str:
    return " ".join(bloque.text for bloque in resultado.content if hasattr(bloque, "text"))


async def main() -> int:
    env = dict(os.environ)
    env.setdefault("KTLM_API_URL", "http://localhost:8080")

    servidor = StdioServerParameters(
        command=sys.executable,
        args=["-m", "ktlm_mcp.server"],
        env=env,
    )

    failures: list[str] = []

    async with stdio_client(servidor) as (lee, escribe):
        async with ClientSession(lee, escribe) as sesion:
            await sesion.initialize()

            herramientas = sorted(t.name for t in (await sesion.list_tools()).tools)
            print("tools: ", ", ".join(herramientas))
            for esperada in ("listar", "agregar", "reorganizar", "completar", "archivo"):
                if esperada not in herramientas:
                    failures.append(f"missing tool: {esperada}")

            quien = texto(await sesion.call_tool("quien_soy", {}))
            print("token:", quien)
            if "token valid" not in quien:
                failures.append("the service token does not work")

            antes = await sesion.call_tool("listar", {"tamano": 1})
            total_antes = antes.structured_content["total"]

            creada = await sesion.call_tool(
                "agregar",
                {"titulo": "smoke task", "proyectos": ["smoke"], "prioridad": "HIGH"},
            )
            uid = creada.structured_content["uid"] if creada.structured_content else 0
            print("created with uid", uid)
            if not uid:
                failures.append(f"add returned no uid: {creada.content}")

            # It has to be in the file: that's the whole point, that the MCP writes.
            archivo = texto(await sesion.call_tool("archivo", {}))
            if "smoke task" not in archivo:
                failures.append("the task never reached the todo.txt")
            if "+smoke" not in archivo:
                failures.append("the project never reached the todo.txt")

            await sesion.call_tool("completar", {"uid": uid})
            await sesion.call_tool("borrar", {"uid": uid})

            despues = await sesion.call_tool("listar", {"tamano": 1})
            total_despues = despues.structured_content["total"]
            if total_despues != total_antes:
                failures.append(f"the script left a trace: {total_antes} -> {total_despues}")
            else:
                print(f"clean: {total_antes} tasks before and after")

    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print(" -", failure)
        return 1
    print("\nall good")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))