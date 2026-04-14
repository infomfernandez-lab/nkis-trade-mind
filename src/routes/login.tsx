import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: 'Iniciar Sesión — CAP Trading' },
      { name: 'description', content: 'Accede a tu plataforma de inteligencia de trading.' },
    ],
  }),
});

function LoginPage() {
  const { signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate({ to: '/' });
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            <span className="text-primary">CAP</span> Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema 1 — Trend Following</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">
            {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="trader@ejemplo.com"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-success bg-success/10 rounded-md px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Cargando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Sistema 1 v2.0</p>
      </div>
    </div>
  );
}
