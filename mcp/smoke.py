"""Habla con el servidor MCP por stdio y comprueba que las herramientas hacen lo que dicen.

No es un test unitario: arranca el servidor de verdad y le pide herramientas por el
protocolo. Es lo único que demuestra que arranca, se anuncia y responde.

    KTM_SERVICE_TOKEN=ktm_... .venv/bin/python smoke.py
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
    env.setdefault("KTM_API_URL", "http://localhost:8080")

    servidor = StdioServerParameters(
        command=sys.executable,
        args=["-m", "ktm_mcp.server"],
        env=env,
    )

    fallos: list[str] = []

    async with stdio_client(servidor) as (lee, escribe):
        async with ClientSession(lee, escribe) as sesion:
            await sesion.initialize()

            herramientas = sorted(t.name for t in (await sesion.list_tools()).tools)
            print("herramientas:", ", ".join(herramientas))
            for esperada in ("listar", "agregar", "reorganizar", "completar", "archivo"):
                if esperada not in herramientas:
                    fallos.append(f"falta la herramienta {esperada}")

            quien = texto(await sesion.call_tool("quien_soy", {}))
            print("token:", quien)
            if "token válido" not in quien:
                fallos.append("el token de servicio no vale")

            antes = await sesion.call_tool("listar", {"tamano": 1})
            total_antes = antes.structured_content["total"]

            creada = await sesion.call_tool(
                "agregar",
                {"titulo": "tarea del smoke", "proyectos": ["smoke"], "prioridad": "HIGH"},
            )
            uid = creada.structured_content["uid"] if creada.structured_content else 0
            print("creada con uid", uid)
            if not uid:
                fallos.append(f"agregar no devolvió uid: {creada.content}")

            # Tiene que estar en el archivo: de eso se trata, de que el MCP escriba.
            archivo = texto(await sesion.call_tool("archivo", {}))
            if "tarea del smoke" not in archivo:
                fallos.append("la tarea no llegó al todo.txt")
            if "+smoke" not in archivo:
                fallos.append("el proyecto no llegó al todo.txt")

            await sesion.call_tool("completar", {"uid": uid})
            await sesion.call_tool("borrar", {"uid": uid})

            despues = await sesion.call_tool("listar", {"tamano": 1})
            total_despues = despues.structured_content["total"]
            if total_despues != total_antes:
                fallos.append(f"el script dejó rastro: {total_antes} → {total_despues}")
            else:
                print(f"limpio: {total_antes} tareas antes y después")

    if fallos:
        print("\nFALLOS:")
        for fallo in fallos:
            print(" -", fallo)
        return 1
    print("\ntodo correcto")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))