import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { ServiceTokensModal } from './ServiceTokensModal';
import { AccentPicker } from './AccentPicker';
import { useI18nStore, useT } from '../../i18n';

/**
 * The top bar. It used to be a card header with rounded buttons; here it is a single line,
 * like the title of a terminal window: brand on the left, status and actions on the right.
 */
export const Header: FC = () => {
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const [tokensAbiertos, setTokensAbiertos] = useState(false);
  const [colorAbierto, setColorAbierto] = useState(false);
  const t = useT();
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  return (
    <header className="tui-titlebar">
      <Link to="/" className="tui-titlebar-brand">
        <img src="/favicon.png" alt="" className="tui-titlebar-logo" width={18} height={18} />
        <span>ktlm</span>
      </Link>

      <nav className="tui-titlebar-actions">
        {username ? <span className="tui-titlebar-user">@{username}</span> : null}

        <button
          type="button"
          onClick={toggleDarkMode}
          className="tui-titlebar-button"
          title={darkMode ? t('header.theme.light') : t('header.theme.dark')}
        >
          {darkMode ? '☾' : '☀'}
        </button>

        {username ? (
          <>
            <button
              type="button"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="tui-titlebar-button"
              title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
            >
              {language === 'es' ? 'EN' : 'ES'}
            </button>
            <button
              type="button"
              onClick={() => setColorAbierto(true)}
              className="tui-titlebar-button flex items-center gap-1"
              title={t('header.accent.label')}
              aria-label={t('header.accent.label')}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: 'var(--color-accent)' }}
              />
              {t('header.accent.button')}
            </button>
            <button
              type="button"
              onClick={() => setTokensAbiertos(true)}
              className="tui-titlebar-button"
              title={t('header.tokens.title')}
            >
              {t('header.tokens.button')}
            </button>
            <button type="button" onClick={logout} className="tui-titlebar-button">
              {t('header.logout')}
            </button>
          </>
        ) : null}
      </nav>

      {tokensAbiertos ? <ServiceTokensModal onClose={() => setTokensAbiertos(false)} /> : null}
      {colorAbierto ? <AccentPicker onClose={() => setColorAbierto(false)} /> : null}
    </header>
  );
};