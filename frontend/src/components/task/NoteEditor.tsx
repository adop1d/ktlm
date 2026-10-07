import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as api from '../../api/tasks';
import { useToastStore } from '../../stores/toastStore';

/**
 * El editor de la nota de una tarea.
 *
 * <p>En el archivo `note:` no guarda el texto sino una ruta, igual que en tuxedo. El motivo
 * es el formato: el token se separa por espacios, así que un texto con varias palabras se
 * truncaría en la primera. Guardarlo en un archivo del directorio del usuario además deja
 * caber un texto de varias líneas, que es de lo que se trata cuando se abre un editor.
 */
export const NoteEditor: FC<{
  uid: number;
  title: string;
  onClose: () => void;
}> = ({ uid, title, onClose }) => {
  const [contenido, setContenido] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let vivo = true;
    api
      .readNote(uid)
      .then((texto) => {
        if (vivo) {
          setContenido(texto);
          area.current?.focus();
        }
      })
      .catch((e) => addToast('error', `No se pudo abrir la nota: ${e.message}`))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [uid, addToast]);

  const guardar = useCallback(async () => {
    setGuardando(true);
    try {
      await api.writeNote(uid, contenido);
      addToast('success', contenido.trim() ? 'Nota guardada' : 'Nota borrada');
      // No hace falta refrescar: el servidor reescribe el archivo y el SSE lo trae.
      onClose();
    } catch (e) {
      addToast('error', `No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }, [uid, contenido, addToast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="tui-panel w-full max-w-2xl flex flex-col" onKeyDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-3 gap-2">
          <h2 className="tui-heading truncate">nota · {title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs shrink-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </header>

        <textarea
          ref={area}
          className="tui-input flex-1 min-h-[14rem] font-mono text-sm resize-y"
          value={contenido}
          disabled={cargando}
          placeholder="La nota se guarda en el directorio del usuario y la línea del archivo apunta a ella con note:…"
          onChange={(e) => setContenido(e.target.value)}
        />

        <footer className="flex items-center justify-between mt-3">
          <span className="text-xs opacity-60">
            {contenido ? 'Ctrl-S guarda · Esc cierra' : 'Vaciar borra la nota y el token note:'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              cerrar
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando || cargando}
              className="btn-primary text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void guardar();
              }}
            >
              {guardando ? 'guardando…' : 'guardar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};