import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation, useNavigate } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/layout/AppLayout";
import appCss from "../styles.css?url";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold font-display text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NKIS Trading Intelligence" },
      { name: "description", content: "Professional trading journal and analytics for systematic trend-following." },
      { property: "og:title", content: "NKIS Trading Intelligence" },
      { name: "twitter:title", content: "NKIS Trading Intelligence" },
      { property: "og:description", content: "Professional trading journal and analytics for systematic trend-following." },
      { name: "twitter:description", content: "Professional trading journal and analytics for systematic trend-following." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8d012a60-1ca9-4518-859d-f03c2b405e2f/id-preview-d977ba01--8a5c77a3-8d12-4dcf-b21a-f46bcb0616f9.lovable.app-1775921562718.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8d012a60-1ca9-4518-859d-f03c2b405e2f/id-preview-d977ba01--8a5c77a3-8d12-4dcf-b21a-f46bcb0616f9.lovable.app-1775921562718.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inconsolata:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      navigate({ to: '/login' });
    }
    if (user && isLoginPage) {
      navigate({ to: '/' });
    }
  }, [user, loading, isLoginPage, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-lg font-bold text-foreground">
            <span className="text-primary">NKIS</span> Trading
          </h1>
          <p className="text-xs text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !isLoginPage) return null;

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
