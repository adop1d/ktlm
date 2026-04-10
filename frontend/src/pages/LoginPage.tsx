import { useState, FC, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { login as loginApi, register as registerApi } from '../api/auth';

export const LoginPage: FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const addToast = useToastStore(state => state.addToast);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = isLogin
        ? await loginApi(username, password)
        : await registerApi(username, email, password);
      setAuth(res.token, res.username, res.email, res.roles);
      addToast('success', isLogin ? '¡Bienvenido de nuevo!' : '¡Cuenta creada exitosamente!');
      navigate('/');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-base)] transition-colors duration-200 p-4">
      <div className="w-full max-w-md">
        <div className="card-elevated animate-scale-in">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] dark:text-[var(--dark-text-primary)] mb-2">
              {isLogin ? 'Bienvenido' : 'Crear cuenta'}
            </h1>
            <p className="text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] text-sm">
              {isLogin ? 'Ingresa a tu cuenta' : 'Regístrate para comenzar'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-field"
                required
                autoComplete="username"
              />
            </div>
            
            {!isLogin && (
              <div className="animate-fade-in-up">
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  required
                  autoComplete="email"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-1px] active:translate-y-0 transition-transform"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isLogin ? 'Entrar' : 'Registrarse'}
            </button>
          </form>
          
          <p className="mt-6 text-center text-sm text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)]">
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors hover:underline"
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};