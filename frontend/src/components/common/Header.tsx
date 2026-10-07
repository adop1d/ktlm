import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { ServiceTokensModal } from './ServiceTokensModal';

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
          title={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {darkMode ? '☾' : '☀'}
        </button>

        {username ? (
          <>
            <button
              type="button"
              onClick={() => setTokensAbiertos(true)}
              className="tui-titlebar-button"
              title="Tokens para automatizaciones y el servidor MCP"
            >
              tokens
            </button>
            <button type="button" onClick={logout} className="tui-titlebar-button">
              salir
            </button>
          </>
        ) : null}
      </nav>

      {tokensAbiertos ? <ServiceTokensModal onClose={() => setTokensAbiertos(false)} /> : null}
    </header>
  );
};