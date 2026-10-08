import { FC, useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * The task line, being composed.
 *
 * <p>Not a form. A todo.txt line, laid out the way the file writes it, with the cursor
 * jumping between its parts: priority, title, projects, contexts, due, recurrence. tuxedo
 * edits the file and this edits the same thing; showing it as a form was showing a
 * translation of the file rather than the file.
 *
 * <p>Each part says what key writes it, because that is the whole point: `p` for priority,
 * `+` for a project, `c` for a context, `d` for the due date, `r` for recurrence. The parts
 * are also clickable and the arrow keys move between them, so the same thing is reachable
 * without leaving the keyboard and without knowing the letters.
 */
export type SegmentId = 'prio' | 'title' | 'projects' | 'contexts' | 'due' | 'rec';

const ORDER: SegmentId[] = ['prio', 'title', 'projects', 'contexts', 'due', 'rec'];

/** The key each part is written with. Shown under the segment that is not focused. */
const KEY_FOR: Record<SegmentId, string> = {
  prio: 'p',
  title: 'i',
  projects: '+',
  contexts: 'c',
  due: 'd',
  rec: 'r',
};

export interface EditableTask {
  uid: number;
  title: string;
  priority: 'A' | 'B' | 'C' | '';
  projects: string[];
  contexts: string[];
  due: string;
  recurrence: string;
}

export const toEditable = (task: {
  todoUid?: string | null;
  title: string;
  priority: string;
  projects: string[];
  contexts: string[];
  dueDate?: string | null;
  recurrence?: string | null;
}): EditableTask => ({
  uid: Number(task.todoUid ?? 0),
  title: task.title,
  priority: task.priority === 'HIGH' ? 'A' : task.priority === 'MEDIUM' ? 'B' : task.priority === 'LOW' ? 'C' : '',
  projects: [...task.projects],
  contexts: [...task.contexts],
  due: task.dueDate?.split('T')[0] ?? '',
  recurrence: task.recurrence ?? '',
});

/**
 * Renders it the way the file will hold it.
 *
 * <p>Preview and edit are the same markup on purpose: what you are typing into is the line
 * you are going to get, not a set of labelled boxes that will be reordered on save.
 */
export const LineEditor: FC<{
  value: EditableTask;
  segment: SegmentId;
  onSegment: (segment: SegmentId) => void;
  onChange: (next: EditableTask) => void;
  onCommit: () => void;
  onCancel: () => void;
  prompt: { visible: boolean; label: string; value: string; kind: SegmentId };
  onPrompt: (label: string, kind: SegmentId, initial: string) => void;
  onPromptChange: (value: string) => void;
  onPromptAccept: () => void;
  onPromptCancel: () => void;
}> = ({
  value,
  segment,
  onSegment,
  onChange,
  onCommit,
  onCancel,
  prompt,
  onPrompt,
  onPromptChange,
  onPromptAccept,
  onPromptCancel,
}) => {
  const titleRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt.visible) promptRef.current?.focus();
    else if (segment === 'title') titleRef.current?.focus();
  }, [prompt.visible, segment]);

  const set = useCallback(
    (patch: Partial<EditableTask>) => onChange({ ...value, ...patch }),
    [onChange, value]
  );

  /** Cycle A → B → C → nothing, which is the order tuxeda cycles in. */
  const cyclePriority = () => {
    const order: EditableTask['priority'][] = ['A', 'B', 'C', ''];
    set({ priority: order[(order.indexOf(value.priority) + 1) % order.length] });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // The keymap listens on window, so it sees every keydown after this one. Without
    // stopping it here the two both acted on `p`: the editor cycled the priority and the
    // engine cycled it straight back, which looks like the editor doing nothing at all.
    // Two handlers on one key is not a harmless race, it is a key that does the wrong thing.
    event.stopPropagation();

    // While the prompt is up it owns the keyboard: Enter accepts, Esc cancels.
    if (prompt.visible) {
      if (event.key === 'Escape') {
        // Back out of the prompt, not out of the editor. Losing a line because you
        // pressed Esc while typing a tag is the kind of surprise that teaches people to
        // stop trusting Esc.
        onPromptCancel();
        return;
      }
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onCommit();
        return;
      case 'Escape':
        event.preventDefault();
        onCancel();
        return;
      case 'Tab': {
        event.preventDefault();
        // Shift+Tab is a full turn back rather than one step: with six parts, going back
        // from the first to the last is one press, and that is what a terminal does.
        const paso = event.shiftKey ? -1 : 1;
        onSegment(ORDER[(ORDER.indexOf(segment) + paso + ORDER.length) % ORDER.length]);
        return;
      }
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        onSegment(ORDER[(ORDER.indexOf(segment) + 1) % ORDER.length]);
        return;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        onSegment(ORDER[(ORDER.indexOf(segment) - 1 + ORDER.length) % ORDER.length]);
        return;
      }
      default:
        break;
    }

    // The letters. They are only read when the cursor is not in the title: otherwise typing
    // "prioridad" in a title would keep opening the priority prompt.
    if (segment === 'title' || event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === 'p') {
      event.preventDefault();
      cyclePriority();
    } else if (key === '+') {
      event.preventDefault();
      onPrompt('proyecto', 'projects', '');
    } else if (key === 'c') {
      event.preventDefault();
      onPrompt('contexto', 'contexts', '');
    } else if (key === 'd') {
      event.preventDefault();
      onPrompt('vence', 'due', value.due);
    } else if (key === 'r') {
      event.preventDefault();
      onPrompt('rec:', 'rec', value.recurrence);
    }
  };

  const chips = useMemo(() => {
    const list: { id: SegmentId; items: string[]; prefix: string; empty: string }[] = [
      { id: 'projects', items: value.projects, prefix: '+', empty: '+—' },
      { id: 'contexts', items: value.contexts, prefix: '@', empty: '@—' },
    ];
    return list;
  }, [value.projects, value.contexts]);

  return (
    <div className="tui-editor" onKeyDown={onKeyDown}>
      <div className="tui-editor-line">
        <button
          type="button"
          className={`tui-editor-seg ${segment === 'prio' ? 'is-focused' : ''}`}
          onClick={() => {
            onSegment('prio');
            cyclePriority();
          }}
          title={`prioridad · ${KEY_FOR.prio}`}
        >
          {value.priority ? `(${value.priority})` : '(—)'}
        </button>

        <div className={`tui-editor-seg tui-editor-seg--title ${segment === 'title' ? 'is-focused' : ''}`}>
          <input
            ref={titleRef}
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={onKeyDown}
            onFocus={() => onSegment('title')}
            placeholder="título"
            aria-label="Título de la tarea"
            className="tui-editor-input"
          />
        </div>

        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`tui-editor-seg ${segment === chip.id ? 'is-focused' : ''}`}
            onClick={() => {
              onSegment(chip.id);
              onPrompt(chip.id === 'projects' ? 'proyecto' : 'contexto', chip.id, '');
            }}
            title={`${chip.id === 'projects' ? 'proyectos' : 'contextos'} · ${KEY_FOR[chip.id]}`}
          >
            {chip.items.length
              ? chip.items.map((item) => `${chip.prefix}${item}`).join(' ')
              : chip.empty}
          </button>
        ))}

        <button
          type="button"
          className={`tui-editor-seg ${segment === 'due' ? 'is-focused' : ''}`}
          onClick={() => {
            onSegment('due');
            onPrompt('vence', 'due', value.due);
          }}
          title={`vence · ${KEY_FOR.due}`}
        >
          {value.due ? `due:${value.due}` : 'due:—'}
        </button>

        <button
          type="button"
          className={`tui-editor-seg ${segment === 'rec' ? 'is-focused' : ''}`}
          onClick={() => {
            onSegment('rec');
            onPrompt('rec:', 'rec', value.recurrence);
          }}
          title={`recurrencia · ${KEY_FOR.rec}`}
        >
          {value.recurrence ? `rec:${value.recurrence}` : 'rec:—'}
        </button>
      </div>

      <div className="tui-editor-hint">
        {ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={segment === id ? 'is-focused' : ''}
            onClick={() => onSegment(id)}
          >
            <kbd>{KEY_FOR[id]}</kbd> {id}
          </button>
        ))}
        <span className="ml-2 opacity-60">
          Tab o ←→ para saltar · Enter guarda · Esc cancela
        </span>
      </div>

      {prompt.visible ? (
        <div className="tui-editor-prompt">
          <span className="tui-editor-prompt-label">{prompt.label}</span>
          <input
            ref={promptRef}
            value={prompt.value}
            autoFocus
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onPromptAccept();
              }
            }}
            className="tui-editor-input"
            aria-label={prompt.label}
          />
          <span className="text-xs opacity-60">Enter acepta · Esc cancela</span>
        </div>
      ) : null}
    </div>
  );
};