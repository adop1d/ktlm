import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/**
 * The documentation.
 *
 * <p>A long document, not a page of cards: one column, a fixed measure, and the commands
 * where the reader expects them. The whole point of a docs page is that somebody can follow
 * it top to bottom with a terminal open and end up with something working — anything that
 * interrupts that is decoration.
 *
 * <p>It covers the whole application, not only the MCP. The MCP is the part you cannot
 * discover by using the app for five minutes, but someone arriving at the docs has usually
 * not got that far yet, and a page that starts with a token they do not have is a wall.
 */
export const DocsPage: FC = () => {
  const t = useT();

  return (
    <div className="docs">
      <header className="docs-head">
        <Link to="/" className="docs-back">
          ← {t('docs.back')}
        </Link>
        <h1 className="docs-title">{t('docs.title')}</h1>
        <p className="docs-lead" dangerouslySetInnerHTML={{ __html: t('docs.lead') }} />
      </header>

      <nav className="docs-toc" aria-label={t('docs.toc.aria')}>
        <ol>
          <li><a href="#arrancar">{t('docs.toc.start')}</a></li>
          <li><a href="#archivo">{t('docs.toc.file')}</a></li>
          <li><a href="#teclas">{t('docs.toc.keys')}</a></li>
          <li><a href="#notas">{t('docs.toc.notes')}</a></li>
          <li><a href="#mcp">{t('docs.toc.mcp')}</a></li>
          <li><a href="#herramientas">{t('docs.toc.tools')}</a></li>
          <li><a href="#problemas">{t('docs.toc.trouble')}</a></li>
        </ol>
      </nav>

      <section id="arrancar">
        <h2>{t('docs.start.title')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('docs.start.body') }} />
        <pre className="docs-code"><code>{t('docs.start.code')}</code></pre>
        <p dangerouslySetInnerHTML={{ __html: t('docs.start.note') }} />
      </section>

      <section id="archivo">
        <h2>{t('docs.file.title')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('docs.file.body') }} />
        <pre className="docs-code"><code>{t('docs.file.code')}</code></pre>
        <h3>{t('docs.file.inbox')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('docs.file.inboxBody') }} />
        <pre className="docs-code"><code>{t('docs.file.inboxCode')}</code></pre>
      </section>

      <section id="teclas">
        <h2>{t('docs.keys.title')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('docs.keys.body') }} />
        <pre className="docs-code"><code>{t('docs.keys.code')}</code></pre>
        <p dangerouslySetInnerHTML={{ __html: t('docs.keys.disable') }} />
      </section>

      <section id="notas">
        <h2>{t('docs.notes.title')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('docs.notes.body') }} />
        <pre className="docs-code"><code>{t('docs.notes.code')}</code></pre>
        <p dangerouslySetInnerHTML={{ __html: t('docs.notes.why') }} />
      </section>

      <section id="mcp">
        <h2>{t('docs.mcp.title')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('docs.mcp.body') }} />

        <h3>{t('docs.token.title')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('docs.token.body') }} />
        <ol className="docs-steps">
          <li dangerouslySetInnerHTML={{ __html: t('docs.token.step1') }} />
          <li dangerouslySetInnerHTML={{ __html: t('docs.token.step2') }} />
        </ol>
        <p className="docs-note" dangerouslySetInnerHTML={{ __html: t('docs.token.note') }} />

        <h3>{t('docs.install.title')}</h3>
        <pre className="docs-code"><code>{t('docs.install.code')}</code></pre>
        <p dangerouslySetInnerHTML={{ __html: t('docs.install.check') }} />
        <pre className="docs-code docs-code--out"><code>{t('docs.install.output')}</code></pre>

        <h3>{t('docs.clients.title')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('docs.clients.body') }} />
        <pre className="docs-code"><code>{t('docs.clients.json')}</code></pre>
        <p dangerouslySetInnerHTML={{ __html: t('docs.clients.restart') }} />
      </section>

      <section id="herramientas">
        <h2>{t('docs.tools.title')}</h2>
        <dl className="docs-tools">
          <div><dt><code>listar</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.listar') }} /></div>
          <div><dt><code>obtener</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.obtener') }} /></div>
          <div><dt><code>agregar</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.agregar') }} /></div>
          <div><dt><code>actualizar</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.actualizar') }} /></div>
          <div><dt><code>completar</code> · <code>deshacer</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.complete') }} /></div>
          <div><dt><code>borrar</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.borrar') }} /></div>
          <div><dt><code>reorganizar</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.reorganizar') }} /></div>
          <div><dt><code>leer_nota</code> · <code>escribir_nota</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.note') }} /></div>
          <div><dt><code>archivo</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.archivo') }} /></div>
          <div><dt><code>quien_soy</code></dt><dd dangerouslySetInnerHTML={{ __html: t('docs.tools.quien') }} /></div>
        </dl>
        <p dangerouslySetInnerHTML={{ __html: t('docs.tools.batch') }} />
      </section>

      <section id="problemas">
        <h2>{t('docs.trouble.title')}</h2>
        <dl className="docs-trouble">
          <div>
            <dt>{t('docs.trouble.token.title')}</dt>
            <dd dangerouslySetInnerHTML={{ __html: t('docs.trouble.token.body') }} />
          </div>
          <div>
            <dt>{t('docs.trouble.path.title')}</dt>
            <dd dangerouslySetInnerHTML={{ __html: t('docs.trouble.path.body') }} />
          </div>
          <div>
            <dt>{t('docs.trouble.archivo.title')}</dt>
            <dd dangerouslySetInnerHTML={{ __html: t('docs.trouble.archivo.body') }} />
          </div>
          <div>
            <dt>{t('docs.trouble.file.title')}</dt>
            <dd dangerouslySetInnerHTML={{ __html: t('docs.trouble.file.body') }} />
          </div>
        </dl>
      </section>
    </div>
  );
};