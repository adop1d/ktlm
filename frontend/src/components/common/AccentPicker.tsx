import { FC, useRef } from 'react';
import { ACCENT_PRESETS, useUIStore } from '../../stores/uiStore';

/**
 * The accent picker.
 *
 * A native `<input type="color">` and nothing else. It already is a swatch, it opens the
 * system's own picker on every platform, and it takes the keyboard — arrows and the colour
 * wheel are reachable with Tab, which a grid of buttons would not be.
 *
 * The presets are the shortcut: picking a colour by hand means finding one you like first,
 * and eight ready-made ones cover most of what anyone wants.
 */
export const AccentPicker: FC<{ onClose: () => void }> = ({ onClose }) => {
  const accent = useUIStore((state) => state.accent);
  const setAccent = useUIStore((state) => state.setAccent);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50">
      <div className="tui-panel w-full max-w-sm p-4" onKeyDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-3">
          <h2 className="tui-heading">color de acento</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs">
            cerrar
          </button>
        </header>

        <p className="text-xs opacity-70 mb-3">
          Sustituye el rosado en todo el tema: el cursor, el foco, la fila seleccionada y los
          títulos. Los temas cambian el fondo; este color se mantiene.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <input
            ref={input}
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Elegir color de acento"
            className="w-12 h-9 rounded cursor-pointer border border-[var(--border-default)] bg-transparent"
          />
          <code className="text-xs opacity-70">{accent}</code>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={`${preset.name} — ${preset.value}`}
              aria-label={preset.name}
              onClick={() => setAccent(preset.value)}
              className={[
                'w-7 h-7 rounded border-2',
                accent.toLowerCase() === preset.value ? 'border-[var(--text-primary)]' : 'border-transparent',
              ].join(' ')}
              style={{ background: preset.value }}
            />
          ))}
        </div>

        <p className="text-xs opacity-60 mb-2">O con el teclado:</p>
        <ul className="text-xs opacity-80 flex flex-col gap-1">
          <li><kbd>p</kbd> cambia la prioridad</li>
          <li><kbd>c</kbd> contexto · <kbd>+</kbd> proyecto</li>
          <li><kbd>r</kbd> recurrencia</li>
        </ul>
      </div>
    </div>
  );
};