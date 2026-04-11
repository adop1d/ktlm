import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TaskListPage } from './pages/TaskListPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { ToastContainer } from './components/common/ToastContainer';
import { FC, ReactNode, useEffect } from 'react';

const queryClient = new QueryClient();

/**
 * Syncs dark mode state to HTML element
 */
const DarkModeSync: FC = () => {
  const darkMode = useUIStore(state => state.darkMode);
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
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
        <DarkModeSync />
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
            path="/"
            element={
              <ProtectedRoute>
                <PageWrapper path="/">
                  <TaskListPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;