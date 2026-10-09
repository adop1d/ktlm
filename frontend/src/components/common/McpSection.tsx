import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n';

/**
 * The MCP section.
 *
 * <p>Not a feature card. The MCP is the only part of KTM that a reader cannot see by using
 * the app for five minutes, so it is the one that has to explain itself — and the honest
 * shape for that is the three commands you actually run, in order, rather than a paragraph
 * about how powerful it is.
 */
export const McpSection: FC = () => {
  const t = useT();

  return (
    <section className="lp-mcp" aria-labelledby="mcp-heading">
      <div className="lp-mcp-copy">
        <h2 id="mcp-heading" className="lp-section">
          {t('mcp.section.title')}
        </h2>
        <p className="lp-lead" dangerouslySetInnerHTML={{ __html: t('mcp.section.lead') }} />
        <p className="lp-note">{t('mcp.section.note')}</p>
        <Link to="/docs" className="lp-cta lp-cta--ghost">
          {t('mcp.section.cta')}
        </Link>
      </div>

      <ol className="lp-mcp-steps">
        <li>
          <span className="lp-mcp-step-label">{t('mcp.step.1.label')}</span>
          <p dangerouslySetInnerHTML={{ __html: t('mcp.step.1.body') }} />
          <p className="lp-mcp-hint">{t('mcp.step.1.hint')}</p>
        </li>
        <li>
          <span className="lp-mcp-step-label">{t('mcp.step.2.label')}</span>
          <p>{t('mcp.step.2.body')}</p>
          <pre className="lp-mcp-code">
            <code>
              {'export KTM_SERVICE_TOKEN=ktm_...\n'}
              {'export KTM_API_URL=http://localhost:8080'}
            </code>
          </pre>
        </li>
        <li>
          <span className="lp-mcp-step-label">{t('mcp.step.3.label')}</span>
          <p dangerouslySetInnerHTML={{ __html: t('mcp.step.3.body') }} />
        </li>
      </ol>
    </section>
  );
};