import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

/**
 * La barra superior. Antes era una cabecera de tarjeta con logo y botones redondeados; aquí
 * es una línea, como el título de una ventana de terminal: el nombre a la izquierda, el
 * estado y las acciones a la derecha.
 */
export const Header: FC = () => {
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);

  return (
    <header className="tui-titlebar">
      <Link to="/" className="tui-titlebar-brand">
        <span className="tui-titlebar-mark">▚</span>
        <span>tareas</span>
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
          <button type="button" onClick={logout} className="tui-titlebar-button">
            salir
          </button>
        ) : null}
      </nav>
    </header>
  );
};