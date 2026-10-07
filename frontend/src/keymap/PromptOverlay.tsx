import { FC, useEffect, useRef, useState } from 'react';
import { Portal } from '../components/common/Portal';

/**
 * Modal prompt for typing a value. This is what tuxedo calls an overlay: a single line, you
 * type and Enter accepts. Esc cancels it via the keymap engine, as in the rest of the
 * overlays, so there is no listener of its own here.
 */
export const PromptOverlay: FC<{
  title: string;
  hint?: string;
  initial?: string;
  submitLabel?: string;
  /** Returns the text, or null to cancel. */
  onSubmit: (value: string) => void;
  onCancel: () => void;
}> = ({ title, hint, initial = '', submitLabel = 'Guardar', onSubmit, onCancel }) => {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Portal>
    <div
      className="tui-overlay"
      role="dialog"
      aria-label={title}
    >
      <div className="tui-modal w-full" style={{ maxWidth: '28rem' }}>
        <div className="tui-modal-header">
          <h2>{title}</h2>
        </div>
        <form
          className="tui-modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value.trim());
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={title}
            className="input-field w-full font-mono"
            placeholder="+1m"
          />
          {hint && (
            <p className="text-xs mt-2 text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
              {hint}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onCancel} className="btn-ghost text-sm">
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-sm">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Portal>
  );
};
