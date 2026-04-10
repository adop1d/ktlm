import { FC } from 'react';
import { Link } from 'react-router-dom';
import { CheckBadgeIcon, ArrowRightOnRectangleIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '../../stores/uiStore';

export const Header: FC = () => {
  // Check localStorage directly for persisted auth
  let username: string | null = null;
  
  try {
    const stored = localStorage.getItem('auth-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      username = parsed.state?.username || parsed.state?.state?.username || null;
    }
  } catch (e) {
    console.error('Error reading auth:', e);
  }

  const handleLogout = () => {
    localStorage.removeItem('auth-store');
    window.location.href = '/login';
  };

  // Theme toggle - from UI store
  const darkMode = useUIStore.getState().darkMode;
  const toggleDarkMode = useUIStore.getState().toggleDarkMode;

  return (
    <header 
      style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 40, 
        backgroundColor: 'var(--surface-elevated)', 
        borderBottom: '2px solid var(--color-accent)',
        padding: '12px 0'
      }}
    >
      <div style={{ maxWidth: '672px', margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '6px', 
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px var(--color-accent-glow)'
            }}
          >
            <CheckBadgeIcon style={{ width: '20px', height: '20px', color: 'white' }} />
          </div>
        </Link>
        
        <nav style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              border: '2px solid var(--border-default)',
              backgroundColor: 'var(--surface-base)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: darkMode ? '#ffe600' : '#ff2d92',
              transition: 'all 0.2s ease'
            }}
          >
            {darkMode ? (
              <SunIcon style={{ width: '18px', height: '18px' }} />
            ) : (
              <MoonIcon style={{ width: '18px', height: '18px' }} />
            )}
          </button>
          
          {username ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div 
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--color-accent-muted)', 
                  border: '2px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  fontSize: '14px'
                }}
              >
                {username}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-danger)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Salir
              </button>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No conectado</span>
          )}
        </nav>
      </div>
    </header>
  );
};