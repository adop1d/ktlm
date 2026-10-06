import { FC, useEffect, useState } from 'react';
import { SavedFilter } from '../stores/savedSearchesStore';

/**
 * El selector de búsquedas guardadas — la tecla `ff` de tuxedo. Es un modo del keymap: con
 * el abierto, j/k mueven y Enter aplica; Esc sale sin haber cambiado nada.
 */
export const SavedFilterPicker: FC<{
  filters: SavedFilter[];
  onApply: (filter: SavedFilter) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}> = ({ filters, onApply, onRemove, onClose }) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((current) => Math.min(current + 1, filters.length - 1));
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const chosen = filters[active];
        if (chosen) onApply(chosen);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, filters, onApply, onClose]);

  const describe = (filter: SavedFilter): string =>
    [
      filter.q.trim() ? `"${filter.q.trim()}"` : null,
      filter.filter !== 'all' ? filter.filter : null,
      filter.project ? `+${filter.project}` : null,
      filter.context ? `@${filter.context}` : null,
    ]
      .filter(Boolean)
      .join(' ') || '(sin filtros)';

  return (
    <div className="tui-overlay items-start" style={{ paddingTop: '6rem' }}>
      <div
        className="tui-modal w-full"
        style={{ maxWidth: '32rem' }}
        role="dialog"
        aria-label="Búsquedas guardadas"
      >
        <div className="tui-modal-header">
          <h2>búsquedas guardadas</h2>
        </div>

        <div className="tui-modal-body">
          {filters.length === 0 ? (
            <p className="tui-empty">
              Ninguna todavía. Con <kbd>fs</kbd> guardas la búsqueda que tengas abierta.
            </p>
          ) : (
            <div className="tui-pane-list">
              {filters.map((filter, index) => (
                // El botón de borrar va al lado, no dentro: anidar un control
                // interactivo dentro de otro no es accesible y confunde al lector de
                // pantalla igual que a las pruebas.
                <div
                  key={filter.name}
                  className="tui-pane-item-row"
                  aria-current={index === active}
                  onMouseEnter={() => setActive(index)}
                >
                  <button
                    type="button"
                    className="tui-pane-item"
                    onClick={() => onApply(filter)}
                  >
                    <span>{filter.name}</span>
                    <span className="tui-pane-item-count">{describe(filter)}</span>
                  </button>
                  <button
                    type="button"
                    className="tui-pane-item-delete"
                    aria-label={`Borrar ${filter.name}`}
                    onClick={() => onRemove(filter.name)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="tui-empty mt-2">
            <kbd>j</kbd> <kbd>k</kbd> mover · <kbd>Enter</kbd> aplicar · <kbd>Esc</kbd> salir
          </p>
        </div>
      </div>
    </div>
  );
};
