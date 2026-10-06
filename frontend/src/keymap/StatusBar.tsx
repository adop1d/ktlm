import { FC } from 'react';
import { KeymapMode } from './useKeymap';
import { Portal } from '../components/common/Portal';

/**
 * La barra de estado de abajo: donde una terminal muestra el modo y la posición, y donde
 * tuxedo muestra el líder del chord. Es el sitio donde se lee el estado sin apartar la
 * vista de la lista.
 *
 * Va montada en un portal porque, dentro de la página animada, `position: fixed` se
 * resolvía contra el contenedor de la animación y la barra nunca llegaba al borde inferior.
 */

export interface StatusHint {
  keys: string;
  label: string;
}

export const StatusBar: FC<{
  mode: KeymapMode;
  pendingChord: string | null;
  position: string;
  counts: { all: number; active: number; completed: number } | undefined;
  linked: boolean;
  hints: StatusHint[];
}> = ({ mode, pendingChord, position, counts, linked, hints }) => (
  <Portal>
    <div className="tui-status" role="status" aria-label="Barra de estado">
      <span className="tui-status-segment tui-status-segment--mode">{mode}</span>

      {pendingChord ? (
        <span className="tui-status-segment tui-status-segment--chord">{pendingChord}…</span>
      ) : null}

      <span className="tui-status-segment">{position}</span>

      {counts ? (
        <span className="tui-status-segment">
          {counts.active} act · {counts.completed} hech · {counts.all} tot
        </span>
      ) : null}

      <span className="tui-status-spacer" />

      {!linked ? (
        <span className="tui-status-segment" style={{ color: 'var(--color-warning)' }}>
          sin todo.txt · x p J dd u apagados
        </span>
      ) : null}

      {hints.map((hint) => (
        <span key={hint.keys} className="tui-status-segment tui-status-segment--hint">
          <kbd>{hint.keys}</kbd>
          {hint.label}
        </span>
      ))}
    </div>
  </Portal>
);