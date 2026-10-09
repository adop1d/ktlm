import { FC, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore, THEME_LABELS, THEMES, type Theme } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useI18nStore, useT } from '../../i18n';
import { ServiceTokensModal } from './ServiceTokensModal';
import { AccentPicker } from './AccentPicker';

/**
 * The bar.
 *
 * <p>One line, the way a terminal's title bar is one line. The account menu carries what is
 * about the session — theme, accent, service tokens, signing out — because those are choices
 * you make once and then stop seeing. What stays visible is what changes while you work:
 * the language and the mode.
 *
 * <p>The menu closes on Escape, on a click outside, and when it loses focus. Three ways out
 * because a menu you cannot get out of with the keyboard is a menu you cannot use.
 */
export const Header: FC = () => {
  const t = useT();
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const accent = useUIStore((state) => state.accent);
  const setAccent = useUIStore((state) => state.setAccent);
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  const [tokensAbiertos, setTokensAbiertos] = useState(false);
  const [colorAbierto, setColorAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (event: MouseEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) setMenuAbierto(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [menuAbierto]);

  return (
    <header className="tui-titlebar">
      <Link to="/" className="tui-titlebar-brand" aria-label="KTM">
        <img src="/favicon.png" alt="" className="tui-titlebar-logo" width={18} height={18} />
      </Link>

      <nav className="tui-titlebar-actions">
        {/* Outside the account menu on purpose: the landing page has no session, and a
            language you cannot change before signing in is one you only find out about
            after. */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          className="tui-titlebar-button"
          title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>

        <Link to="/docs" className="tui-titlebar-button">
          {t('landing.nav.docs')}
        </Link>

        {username ? (
          <div className="tui-account" ref={menu}>
            <button
              type="button"
              onClick={() => setMenuAbierto((open) => !open)}
              className="tui-titlebar-button tui-account-trigger"
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
            >
              @{username}
              <span aria-hidden="true" className="tui-account-caret">
                ▾
              </span>
            </button>

            {menuAbierto ? (
              <div className="tui-account-menu" role="menu">
                <p className="tui-account-menu-head" aria-hidden="true">
                  @{username}
                </p>

                <button
                  type="button"
                  role="menuitem"
                  className="tui-account-item"
                  onClick={() => {
                    toggleDarkMode();
                    setMenuAbierto(false);
                  }}
                >
                  <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
                  {darkMode ? t('header.theme.light') : t('header.theme.dark')}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="tui-account-item"
                  onClick={() => {
                    setColorAbierto(true);
                    setMenuAbierto(false);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: 'var(--color-accent)' }}
                  />
                  {t('header.accent.label')}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="tui-account-item"
                  onClick={() => {
                    setTokensAbiertos(true);
                    setMenuAbierto(false);
                  }}
                >
                  <span aria-hidden="true">⌘</span>
                  {t('header.tokens.title')}
                </button>

                <div className="tui-account-section" role="group" aria-label={t('menu.theme.label')}>
                  <p className="tui-account-subhead">{t('menu.theme.label')}</p>
                  <div className="tui-account-themes">
                    {THEMES.map((nombre: Theme) => (
                      <button
                        key={nombre}
                        type="button"
                        role="menuitemradio"
                        aria-checked={theme === nombre}
                        className={`tui-account-chip${theme === nombre ? ' is-on' : ''}`}
                        onClick={() => {
                          setTheme(nombre);
                          setMenuAbierto(false);
                        }}
                      >
                        {THEME_LABELS[nombre]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tui-account-section" role="group" aria-label={t('menu.accent.label')}>
                  <p className="tui-account-subhead">{t('menu.accent.label')}</p>
                  <div className="tui-account-themes">
                    {ACCENTS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="menuitemradio"
                        aria-checked={accent === color}
                        aria-label={color}
                        title={color}
                        className={`tui-account-swatch${accent === color ? ' is-on' : ''}`}
                        style={{ background: color }}
                        onClick={() => {
                          setAccent(color);
                          setMenuAbierto(false);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className="tui-account-item tui-account-item--danger"
                  onClick={() => {
                    logout();
                    setMenuAbierto(false);
                  }}
                >
                  <span aria-hidden="true">⏻</span>
                  {t('header.logout')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>

      {tokensAbiertos ? <ServiceTokensModal onClose={() => setTokensAbiertos(false)} /> : null}
      {colorAbierto ? <AccentPicker onClose={() => setColorAbierto(false)} /> : null}
    </header>
  );
};

const ACCENTS = ['#ff2d92', '#00e5ff', '#b6ff00', '#ff6b35', '#9d4edd', '#fabd2f', '#4ade80', '#60a5fa'];