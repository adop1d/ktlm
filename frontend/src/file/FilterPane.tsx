import { FC, useMemo } from 'react';
import { Task } from '../types/task';

/**
 * Panel izquierdo: los mismos filtros que tuxedo muestra en su barra lateral —
 * proyectos, contextos y búsquedas guardadas — con su cuenta de coincidencias.
 *
 * Los datos salen de las tareas que ya están en la página: no hay endpoint aparte para
 * "listar proyectos", y pedir uno por cada tecla sería una llamada de más para pintar algo
 * que ya está en la mano.
 */

interface PaneProps {
  tasks: Task[];
  activeProject: string | null;
  activeContext: string | null;
  onPickProject: (project: string | null) => void;
  onPickContext: (context: string | null) => void;
}

interface Tally {
  name: string;
  count: number;
}

const tally = (tasks: Task[], pick: (task: Task) => string[]): Tally[] => {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const name of pick(task)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export const FilterPane: FC<PaneProps> = ({
  tasks,
  activeProject,
  activeContext,
  onPickProject,
  onPickContext,
}) => {
  const projects = useMemo(() => tally(tasks, (task) => task.projects ?? []), [tasks]);
  const contexts = useMemo(() => tally(tasks, (task) => task.contexts ?? []), [tasks]);
  const nothing = projects.length === 0 && contexts.length === 0;

  return (
    <aside className="tui-panel p-3" aria-label="Filtros">
      <span className="tui-panel-title">filtros</span>

      {nothing ? (
        <p className="tui-empty">
          Sin proyectos ni contextos. Se rellenan solos al importar el todo.txt.
        </p>
      ) : null}

      <section className="tui-pane-section">
        <span className="tui-pane-section-title">proyectos</span>
        <div className="tui-pane-list">
          <button
            type="button"
            className="tui-pane-item"
            aria-pressed={activeProject === null}
            onClick={() => onPickProject(null)}
          >
            <span>(todos)</span>
          </button>
          {projects.map((project) => (
            <button
              key={project.name}
              type="button"
              className="tui-pane-item"
              aria-pressed={activeProject === project.name}
              onClick={() =>
                onPickProject(activeProject === project.name ? null : project.name)
              }
            >
              <span>+{project.name}</span>
              <span className="tui-pane-item-count">{project.count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tui-pane-section">
        <span className="tui-pane-section-title">contextos</span>
        <div className="tui-pane-list">
          <button
            type="button"
            className="tui-pane-item"
            aria-pressed={activeContext === null}
            onClick={() => onPickContext(null)}
          >
            <span>(todos)</span>
          </button>
          {contexts.map((context) => (
            <button
              key={context.name}
              type="button"
              className="tui-pane-item"
              aria-pressed={activeContext === context.name}
              onClick={() =>
                onPickContext(activeContext === context.name ? null : context.name)
              }
            >
              <span>@{context.name}</span>
              <span className="tui-pane-item-count">{context.count}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
};