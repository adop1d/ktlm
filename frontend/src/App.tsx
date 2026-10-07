import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TaskListPage } from './pages/TaskListPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { ToastContainer } from './components/common/ToastContainer';
import { FC, ReactNode, useEffect } from 'react';

const queryClient = new QueryClient();

/**
 * Puts on the `<html>` element whatever the store decides: light/dark mode and theme,
 * density and line numbers. All of it via attributes, because that is what the CSS reads.
 *
 * <p>The theme is always set, including the default one: without it, clearing the
 * attribute from the saved list would leave the accent color stuck on the old theme.
 */
const AppearanceSync: FC = () => {
  const darkMode = useUIStore(state => state.darkMode);
  const theme = useUIStore(state => state.theme);
  const density = useUIStore(state => state.density);
  const lineNumbers = useUIStore(state => state.lineNumbers);
  const root = document.documentElement;

  useEffect(() => {
    root.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    root.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    root.toggleAttribute('data-line-numbers', lineNumbers);
  }, [lineNumbers]);

  return null;
};

const ProtectedRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const isAuth = useAuthStore(state => state.isAuthenticated());
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

/**
 * Page wrapper with enter animation
 */
const PageWrapper: FC<{ children: ReactNode; path: string }> = ({ children }) => {
  const location = useLocation();
  
  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  return (
    <div 
      key={location.pathname} 
      className="animate-page-enter"
    >
      {children}
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppearanceSync />
        <ToastContainer />
        {/* CRT Effects */}
        <div className="noise-overlay" />
        <div className="scanlines" />
        <div className="crt-vignette" />
        
        <Routes>
          <Route 
            path="/login" 
            element={<PageWrapper path="/login"><LoginPage /></PageWrapper>} 
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <PageWrapper path="/app">
                  <TaskListPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

export default App;