import { FC } from 'react';
import { Link } from 'react-router-dom';

/**
 * La portada. El producto es una terminal que habla el idioma de tu todo.txt, así que la
 * portada es una terminal: no una ilustración de una terminal, sino el cromo real —mismos
 * tokens, mismas clases— con filas de ejemplo dentro.
 *
 * Va en `/` y la aplicación en `/app`: entrar no debe significar saltar un login sin saber
 * qué hay detrás.
 */

const SAMPLE_ROWS = [
  { n: '1', prio: 'A', title: 'Call dentist', tags: '+health @phone', meta: 'due 08 may', done: false },
  { n: '2', prio: 'B', title: 'Pay rent', tags: '+home', meta: 'rec +1m', done: false },
  { n: '3', prio: 'C', title: 'Buy milk', tags: '+errands', meta: 'due 06 oct', done: false },
  { n: '4', prio: '', title: 'Submit expense report', tags: '+work', meta: 'done 05 oct', done: true },
];

const KEYMAP: [string, string][] = [
  ['j k', 'mover el cursor'],
  ['gg G', 'primera y última'],
  ['Ctrl-d Ctrl-u', 'media página'],
  ['n', 'tarea nueva'],
  ['x', 'completar'],
  ['dd', 'borrar'],
  ['p', 'cambiar prioridad'],
  ['J K', 'mover la tarea'],
  ['u', 'deshacer, 50 pasos'],
  ['[ ]', 'paneles de filtros y detalle'],
  ['v espacio', 'selección múltiple'],
  [':', 'paleta de comandos'],
  ['?', 'todos los atajos'],
];

export const LandingPage: FC = () => (
  <div className="lp">
    <header className="tui-titlebar">
      <span className="tui-titlebar-brand">
        <img src="/favicon.png" alt="" className="tui-titlebar-logo" width={18} height={18} />
        <span>ktm</span>
      </span>
      <nav className="tui-titlebar-actions">
        <Link to="/app" className="tui-titlebar-button">
          entrar
        </Link>
      </nav>
    </header>

    <main className="lp-main">
      {/* Asimétrico a propósito: el texto ocupa una columna estrecha y deja que la
          terminal sea lo que manda. Un hero centrado la habría reducido a una ilustración. */}
      <section className="lp-copy">
        <p className="lp-eyebrow">todo.txt · en el navegador · sin cuentas ajenas</p>
        <h1 className="lp-title">
          Tu <code>todo.txt</code>,
          <br />
          con teclas de terminal.
        </h1>
        <p className="lp-lead">
          Lee y escribe <strong>el mismo archivo</strong> que ya usas, y se
          mantiene sincronizado con quienquiera que lo edite desde fuera. Cada cambio se
          reconoce por su <code>uid</code>: sin duplicar y sin pisar lo que otro acaba de
          escribir.
        </p>

        <div className="lp-actions">
          <Link to="/app" className="lp-cta">
            abrir la app
          </Link>
          <a href="#teclas" className="lp-cta lp-cta--ghost">
            ver las teclas
          </a>
        </div>

        <p className="lp-note">
          Funciona en Chromium. Fuera de ahí la app funciona igual contra el servidor, pero el
          archivo no se sincroniza desde el navegador y la interfaz te lo dice.
        </p>
      </section>

      {/* La firma: el cromo real del producto, no un mock bonito. */}
      <section className="lp-window" aria-label="Vista de la aplicación">
        <div className="tui-titlebar">
          <span className="tui-titlebar-brand">
            <img src="/favicon.png" alt="" className="tui-titlebar-logo" width={16} height={16} />
            <span>todo.txt</span>
          </span>
          <span className="lp-window-mode">NORMAL</span>
        </div>

        <div className="tui-list">
          {SAMPLE_ROWS.map((row) => (
            <div key={row.n} className={`tui-row${row.done ? ' tui-row--done' : ''}`}>
              <span className="tui-row-index">{row.n.padStart(3, ' ')}</span>
              <span
                className={`tui-row-prio${
                  row.prio ? ` tui-row-prio--${row.prio}` : ''
                }`}
              >
                {row.prio || '·'}
              </span>
              <span className="tui-row-title">
                {row.title}
                <span className="tui-row-tags"> {row.tags}</span>
              </span>
              <span className="tui-row-meta">{row.meta}</span>
            </div>
          ))}
        </div>

        <div className="tui-status tui-status--inline">
          <span className="tui-status-segment tui-status-segment--mode">normal</span>
          <span className="tui-status-segment">4/4 · pág 1/1</span>
          <span className="tui-status-segment">3 act · 1 hech · 4 tot</span>
          <span className="tui-status-spacer" />
          <span className="tui-status-segment tui-status-segment--hint">
            <kbd>?</kbd> ayuda
          </span>
        </div>
      </section>

      <section className="lp-keys" id="teclas">
        <h2 className="lp-section">Se maneja con el teclado</h2>
        <p className="lp-lead">
          Los mismos atajos que usan las TUI de tareas de la zona —<code>gg</code>,{' '}
          <code>dd</code>, <code>fp</code>—, copiados de las TUI de tareas para que
          quien ya los tenga en los dedos no tenga que reaprenderlos. Si tienes tu
          <code> keybinds.toml</code> a mano, la web lo lee.
        </p>
        <dl className="lp-keymap">
          {KEYMAP.map(([keys, label]) => (
            <div key={keys} className="lp-keymap-row">
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="lp-why">
        <h2 className="lp-section">Por qué esto y no otra app de tareas</h2>
        <div className="lp-reasons">
          <article>
            <h3>El archivo es tuyo</h3>
            <p>
              No hay base de datos proprietary de por medio ni formato de exportación. Lo que
              edites con <code>vim</code> el Saturday, aquí aparece.
            </p>
          </article>
          <article>
            <h3>Dos escritores, un archivo</h3>
            <p>
              Un proceso que cambia el disco por fuera se detecta y recarga. Si lo cambias
              desde la TUI, la TUI lo ve en el siguiente ciclo.
            </p>
          </article>
          <article>
            <h3>Se lee en el móvil</h3>
            <p>
              Mismo archivo, pantalla pequeña. Y{' '}
              <code>inbox.txt</code> convierte cualquier <code>echo</code> en una tarea nueva.
            </p>
          </article>
        </div>
      </section>
    </main>

    <footer className="lp-footer">
      <span>todo.txt es un formato abierto, de Gina Trapani</span>
      <Link to="/login">entrar</Link>
    </footer>
  </div>
);
