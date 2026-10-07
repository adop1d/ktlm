/**
 * Minimal read of a todo.txt line, just enough to patch lines in the mirror.
 *
 * The rich mapping (projects, contexts, recurrence, priorities) lives in the backend, which
 * is in charge. It is not duplicated here: what is already known to work gets reused.
 */

export interface TodoLine {
  done: boolean;
  priority: string | null;
  /** Completion date of a closed task; different from the creation date. */
  completed: string | null;
  created: string | null;
  body: string;
  due: string | null;
  recurrence: string | null;
  uid: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY = /^\(([A-Za-z])\)$/;

export const parseTodoLine = (raw: string): TodoLine => {
  const trimmed = raw.trim();
  const tokens = trimmed.length ? trimmed.split(/\s+/) : [];
  let i = 0;

  let done = false;
  let completed: string | null = null;
  if (tokens[i] === 'x') {
    done = true;
    i++;
    if (i < tokens.length && ISO_DATE.test(tokens[i])) {
      completed = tokens[i];
      i++;
    }
  }

  let priority: string | null = null;
  const priorityMatch = tokens[i]?.match(PRIORITY);
  if (priorityMatch) {
    priority = priorityMatch[1].toUpperCase();
    i++;
  }

  let created: string | null = null;
  if (i < tokens.length && ISO_DATE.test(tokens[i])) {
    created = tokens[i];
    i++;
  }

  const rest: string[] = [];
  let due: string | null = null;
  let recurrence: string | null = null;
  let uid: string | null = null;

  for (; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('due:')) {
      due = token.slice(4);
      continue;
    }
    if (token.startsWith('rec:')) {
      recurrence = token.slice(4);
      continue;
    }
    if (token.startsWith('uid:')) {
      uid = token.slice(4);
      continue;
    }
    rest.push(token);
  }

  return { done, completed, priority, created, body: rest.join(' '), due, recurrence, uid };
};

export const formatTodoLine = (line: TodoLine): string => {
  const head: string[] = [];
  if (line.done) {
    head.push('x');
    // The completion date and the creation date are distinct: confusing them would misdate
    // any already-closed task.
    if (line.completed) head.push(line.completed);
  }
  if (line.priority) head.push(`(${line.priority})`);
  if (line.created) head.push(line.created);
  const tail: string[] = [...head, line.body];
  if (line.due) tail.push(`due:${line.due}`);
  if (line.recurrence) tail.push(`rec:${line.recurrence}`);
  if (line.uid) tail.push(`uid:${line.uid}`);
  return tail.join(' ').trim();
};

/** Advances an ISO date according to a `rec:` token (e.g. "+1m", "2w", "+3d"). */
export const advanceIsoDate = (iso: string, recurrence: string): string | null => {
  const match = recurrence.match(/^([+-]?)(\d+)([dbwmy])$/);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const amount = sign * Number(match[2]);
  const unit = match[3];
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  switch (unit) {
    case 'd':
      date.setUTCDate(date.getUTCDate() + amount);
      break;
    case 'w':
      date.setUTCDate(date.getUTCDate() + amount * 7);
      break;
    case 'm':
      date.setUTCMonth(date.getUTCMonth() + amount);
      break;
    case 'y':
      date.setUTCFullYear(date.getUTCFullYear() + amount);
      break;
    case 'b': {
      // Business days: Monday to Friday, skipping weekends instead of counting them.
      let remaining = Math.abs(amount);
      const step = amount >= 0 ? 1 : -1;
      while (remaining > 0) {
        date.setUTCDate(date.getUTCDate() + step);
        const weekday = date.getUTCDay();
        if (weekday !== 0 && weekday !== 6) remaining--;
      }
      break;
    }
    default:
      return null;
  }
  return date.toISOString().slice(0, 10);
};