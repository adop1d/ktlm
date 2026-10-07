import { FC, useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../api/http';
import { useAuthStore } from '../../stores/authStore';

interface ServiceToken {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  usable: boolean;
}

interface IssuedToken extends ServiceToken {
  token: string;
  aviso: string;
}

/**
 * Service tokens: the credentials an automation uses to talk to the API —the MCP server among
 * them— without taking up a session.
 *
 * <p>The token is shown exactly once, here, and never again. That is why the newly created
 * row stays on screen with the copyable text instead of closing the dialog: if it closed, the
 * token would be gone and nobody would ever have seen it.
 */
export const ServiceTokensModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const token = useAuthStore((state) => state.token);
  const [tokens, setTokens] = useState<ServiceToken[]>([]);
  const [label, setLabel] = useState('');
  const [nuevo, setNuevo] = useState<IssuedToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  );

  const cargar = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/service-tokens`, { headers: headers() });
    if (res.ok) setTokens(await res.json());
  }, [headers]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async () => {
    setError(null);
    const res = await fetch(`${API_BASE}/api/auth/service-tokens`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ label: label.trim() || 'sin nombre' }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'no se pudo crear el token');
      return;
    }
    setNuevo(body);
    setLabel('');
    void cargar();
  };

  const revocar = async (id: string) => {
    await fetch(`${API_BASE}/api/auth/service-tokens/${id}`, { method: 'DELETE', headers: headers() });
    void cargar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="tui-panel w-full max-w-lg">
        <header className="flex items-center justify-between mb-4">
          <h2 className="tui-heading">Tokens de servicio</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs">
            cerrar
          </button>
        </header>

        <p className="text-xs opacity-70 mb-4">
          Una credencial para automatizaciones. La lleva el servidor MCP y lo que use la API
          por ti. No puede archivar tareas: eso es de una persona.
        </p>

        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            void crear();
          }}
        >
          <input
            className="tui-input flex-1"
            placeholder="nombre: mcp-portatil, script-nocturno…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button type="submit" className="btn-primary text-xs">
            crear
          </button>
        </form>

        {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}

        {nuevo ? (
          <div className="tui-panel mb-4 border-amber-500/40">
            <p className="text-xs font-semibold mb-2">Cópialo ahora: {nuevo.aviso}</p>
            <code className="block break-all text-xs bg-black/30 p-2 rounded">{nuevo.token}</code>
          </div>
        ) : null}

        <ul className="flex flex-col gap-1">
          {tokens.length === 0 ? <li className="text-xs opacity-60">Todavía no hay tokens.</li> : null}
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-xs py-1">
              <span className={t.usable ? '' : 'opacity-50 line-through'}>{t.label}</span>
              <span className="opacity-60">
                {t.usable ? `usado ${t.lastUsedAt ? t.lastUsedAt.slice(0, 16).replace('T', ' ') : 'nunca'}` : 'revocado'}
              </span>
              {t.usable ? (
                <button type="button" onClick={() => void revocar(t.id)} className="btn-ghost text-xs">
                  revocar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};