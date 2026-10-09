import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore, useT } from '../i18n';

/**
 * The landing page. The product is a terminal that speaks the language of your todo.txt, so
 * the landing page is a terminal: not an illustration of one, but the real chrome —same
 * tokens, same classes— with sample rows inside.
 *
 * It lives at `/` and the app at `/app`: getting in must not mean jumping past a login
 * without knowing what is behind it.
 */

const SAMPLE_ROWS = [
  { n: '1', prio: 'A', title: 'Call dentist', tags: '+health @phone', meta: 'due 08 may', done: false },
  { n: '2', prio: 'B', title: 'Pay rent', tags: '+home', meta: 'rec +1m', done: false },
  { n: '3', prio: 'C', title: 'Buy milk', tags: '+errands', meta: 'due 06 oct', done: false },
  { n: '4', prio: '', title: 'Submit expense report', tags: '+work', meta: 'done 05 oct', done: true },
];

const KEYMAP: [string, string][] = [
  ['j k', 'landing.keys.cursor'],
  ['gg G', 'landing.keys.firstLast'],
  ['Ctrl-d Ctrl-u', 'landing.keys.halfPage'],
  ['n', 'landing.keys.newTask'],
  ['x', 'landing.keys.complete'],
  ['dd', 'landing.keys.delete'],
  ['p', 'landing.keys.priority'],
  ['J K', 'landing.keys.moveTask'],
  ['u', 'landing.keys.undo'],
  ['[ ]', 'landing.keys.panes'],
  ['v espacio', 'landing.keys.selection'],
  [':', 'landing.keys.palette'],
  ['?', 'landing.keys.all'],
];

const LanguageSwitch: FC = () => {
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
      className="tui-titlebar-button"
      title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
    >
      {language === 'es' ? 'EN' : 'ES'}
    </button>
  );
};

export const LandingPage: FC = () => {
  const t = useT();
  return (
  <div className="lp">
    <header className="tui-titlebar">
      <span className="tui-titlebar-brand">
        <img src="/favicon.png" alt="" className="tui-titlebar-logo" width={18} height={18} />
        <span>ktlm</span>
      </span>
      <nav className="tui-titlebar-actions">
        {/* Before logging in, not after. The landing page is the first thing anyone sees
            and it is in the wrong language if the switch is behind the login. */}
        <LanguageSwitch />
        <Link to="/app" className="tui-titlebar-button">
          entrar
        </Link>
      </nav>
    </header>

    <main className="lp-main">
      {/* Deliberately asymmetric: the copy takes a narrow column and lets the terminal be
          what leads. A centered hero would have reduced it to an illustration. */}
      <section className="lp-copy">
        <p className="lp-eyebrow">{t('landing.eyebrow')}</p>
        {/* The markup is in the catalogue, not here: a title with a <code> in the middle
            cannot come out of a string without going through innerHTML, and doing that from
            two places means the two drift. */}
        <h1 className="lp-title" dangerouslySetInnerHTML={{ __html: t('landing.title') }} />
        <p className="lp-lead" dangerouslySetInnerHTML={{ __html: t('landing.lead') }} />

        <div className="lp-actions">
          <Link to="/app" className="lp-cta">
            {t('landing.cta.open')}
          </Link>
          <a href="#teclas" className="lp-cta lp-cta--ghost">
            {t('landing.cta.keys')}
          </a>
        </div>

        <p className="lp-note">{t('landing.note')}</p>
      </section>

      {/* The signature: the real chrome of the product, not a pretty mock. */}
      <section className="lp-window" aria-label={t('landing.preview.aria')}>
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
        <h2 className="lp-section">{t('landing.keys.title')}</h2>
        <p className="lp-lead" dangerouslySetInnerHTML={{ __html: t('landing.keys.lead') }} />
        <dl className="lp-keymap">
          {KEYMAP.map(([keys, label]) => (
            <div key={keys} className="lp-keymap-row">
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{t(label)}</dd>
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
};
