import { FC, useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A handoff to the phone: a QR with the address of this very app.
 *
 * <p>It is what tuxedo does with `?` —open the PWA on the phone— and it is a generator, not a
 * reader. Generating is the useful half: the phone already has a camera, the app does not.
 */
export const ShareQr: FC<{ onClose: () => void }> = ({ onClose }) => {
  // The address bar URL is the one that counts; if someone arrives via localhost on the phone
  // it will not help them, and the QR shows exactly that.
  const url = typeof window === 'undefined' ? '' : window.location.origin;
  const [svg, setSvg] = useState('');
  const [copiado, setCopiado] = useState(false);

  // toString returns a promise. Putting it in a useMemo would yield a promise as if it were
  // the SVG, and dangerouslySetInnerHTML would have no idea what to do with that.
  useEffect(() => {
    let vivo = true;
    if (!url) return;
    QRCode.toString(url, { type: 'svg', margin: 1, width: 240 })
      .then((hecho) => vivo && setSvg(hecho))
      .catch(() => vivo && setSvg(''));
    return () => {
      vivo = false;
    };
  }, [url]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="tui-panel w-full max-w-sm text-center" onKeyDown={(e) => e.stopPropagation()}>
        <h2 className="tui-heading mb-1">abrir en el móvil</h2>
        <p className="text-xs opacity-70 mb-4">
          {url.includes('localhost')
            ? 'Esta dirección es local: el móvil no la va a alcanzar. Ábrela desde el nombre de tu red y vuelve a intentarlo.'
            : 'Apunta la cámara y te abre la PWA con tus tareas.'}
        </p>

        {svg ? (
          <div
            className="inline-block p-3 bg-white rounded"
            role="img"
            aria-label={`Código QR de ${url}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}

        <div className="mt-4 flex items-center justify-center gap-2">
          <code className="text-xs opacity-80 truncate max-w-[14rem]">{url}</code>
          <button type="button" onClick={() => void copiar()} className="btn-ghost text-xs">
            {copiado ? 'copiado' : 'copiar'}
          </button>
        </div>

        <button type="button" onClick={onClose} className="btn-primary text-xs mt-4">
          cerrar
        </button>
      </div>
    </div>
  );
};