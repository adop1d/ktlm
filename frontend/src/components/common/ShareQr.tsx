import { FC, useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Captura para el móvil: un QR con la dirección de esta misma app.
 *
 * <p>Es lo que hace tuxedo con `?` —abrir la PWA en el teléfono— y es un generador, no un
 * lector. Generar es lo útil: el móvil ya tiene cámara, la app no.
 */
export const ShareQr: FC<{ onClose: () => void }> = ({ onClose }) => {
  // La URL de la barra de direcciones es la que vale; si alguien entra por localhost en el
  // móvil no le va a servir, y eso mismo es lo que muestra el QR.
  const url = typeof window === 'undefined' ? '' : window.location.origin;
  const [svg, setSvg] = useState('');
  const [copiado, setCopiado] = useState(false);

  // toString devuelve una promesa. Meterla en un useMemo daría una promesa como si fuera
  // el SVG, y dangerouslySetInnerHTML no sabría qué hacer con eso.
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