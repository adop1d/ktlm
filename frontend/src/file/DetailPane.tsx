import { FC } from 'react';
import { useT } from '../i18n';
import { Task } from '../types/task';

/**
 * Right pane: the detail of the task under the cursor, INCLUDING the line exactly as it lives
 * in the file. That last part is the whole reason it exists — it lets you copy the line and
 * take it to tuxedo without rebuilding it by hand.
 */

const field = (label: string, value: string) => (
  <div className="flex gap-2 items-baseline">
    <span className="tui-pane-section-title shrink-0">{label}</span>
    <span className="text-[var(--text-primary)] break-all">{value}</span>
  </div>
);

export const DetailPane: FC<{ task: Task | null | undefined }> = ({ task }) => {
  const t = useT();
  if (!task) {
    return (
      <aside className="tui-panel p-3" aria-label={t('detail.aria')}>
        <span className="tui-panel-title">{t('detail.title')}</span>
        <p className="tui-empty">Sin tarea bajo el cursor.</p>
      </aside>
    );
  }

  const priority = { HIGH: '(A)', MEDIUM: '(B)', LOW: '(C)' }[task.priority];
  const created = task.createdAt?.slice(0, 10);
  const due = task.dueDate ?? '—';
  const done = task.completedAt?.slice(0, 10) ?? '—';

  // The line is rebuilt in the same order tuxedo uses when writing.
  const raw = [
    task.completed ? 'x' : null,
    task.completedAt?.slice(0, 10) ?? null,
    task.priority ? `(${task.priority})` : null,
    task.createdAt?.slice(0, 10) ?? null,
    task.title,
    ...(task.projects ?? []).map((p) => `+${p}`),
    ...(task.contexts ?? []).map((c) => `@${c}`),
    task.dueDate ? `due:${task.dueDate}` : null,
    task.recurrence ? `rec:${task.recurrence}` : null,
    task.threshold ? `t:${task.threshold}` : null,
    task.todoUid ? `uid:${task.todoUid}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="tui-panel p-3" aria-label={t('detail.aria')}>
      <span className="tui-panel-title">{t('detail.title')}</span>

      <div className="flex flex-col gap-1 text-xs">
        {field('prio', priority)}
        {field('creada', created ?? '—')}
        {field('vence', due)}
        {field('hecha', done)}
        {task.recurrence ? field('rec.', `rec:${task.recurrence}`) : null}
      </div>

      <section className="tui-pane-section">
        <span className="tui-pane-section-title">{t('detail.line.title')}</span>
        <pre className="whitespace-pre-wrap break-all text-xs text-[var(--color-primary)] bg-[var(--surface-elevated)] p-2 border border-[var(--border-default)]">
          {raw}
        </pre>
        <p className="tui-empty mt-1">yc la escribe con yy, el texto con yb</p>
      </section>
    </aside>
  );
};