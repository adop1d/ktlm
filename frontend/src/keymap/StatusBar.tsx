import { FC } from 'react';
import { KeymapMode } from './useKeymap';
import { Portal } from '../components/common/Portal';

/**
 * The status bar at the bottom: where a terminal shows the mode and the position, and where
 * tuxedo shows the chord leader. It is where you read the state without looking away from
 * the list view.
 *
 * It is mounted in a portal because, inside the animated page, `position: fixed` resolved
 * against the animation container and the bar never reached the bottom edge.
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
  /** Name of the file in view when it is not the active list. */
  view?: string | null;
  hints: StatusHint[];
}> = ({ mode, pendingChord, position, counts, linked, view, hints }) => (
  <Portal>
    <div className="tui-status" role="status" aria-label="Barra de estado">
      <span className="tui-status-segment tui-status-segment--mode">{mode}</span>

      {pendingChord ? (
        <span className="tui-status-segment tui-status-segment--chord">{pendingChord}…</span>
      ) : null}

      {view ? (
        <span className="tui-status-segment tui-status-segment--chord">{view}</span>
      ) : (
        <span className="tui-status-segment">{position}</span>
      )}

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