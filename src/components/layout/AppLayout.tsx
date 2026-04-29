import { Link, useLocation } from '@tanstack/react-router';
import { useState, createContext, useContext, useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, Brain, BookMarked, FileText,
  Settings, Menu, X, LogOut, Radar, BarChart3, Calculator, Sun, Moon,
} from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, computeStatsFromTrades, filterByBroker, type BrokerFilter } from '@/lib/trade-utils';
import { useAuth } from '@/hooks/use-auth';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useTheme } from '@/hooks/use-theme';
import { BrokerSelector } from '@/components/BrokerSelector';

const BrokerContext = createContext<{ broker: BrokerFilter; setBroker: (b: BrokerFilter) => void }>({
  broker: 'all',
  setBroker: () => {},
});

export function useBrokerFilter() {
  return useContext(BrokerContext);
}

const navItems = [
  { to: '/' as const, label: 'Panel', icon: LayoutDashboard },
  { to: '/radar' as const, label: 'Radar', icon: Radar },
  { to: '/calculator' as const, label: 'Calculadora', icon: Calculator },
  { to: '/trades' as const, label: 'Registro de Trades', icon: BookOpen },
  { to: '/statistics' as const, label: 'Estadísticas', icon: BarChart3 },
  { to: '/patterns' as const, label: 'Patrones', icon: Brain },
  { to: '/reports' as const, label: 'Informes', icon: FileText },
  { to: '/manual' as const, label: 'Manual', icon: BookMarked },
  { to: '/settings' as const, label: 'Ajustes', icon: Settings },
];

function useRadarBadges() {
  const { data: items } = useWatchlist();
  return useMemo(() => {
    const list = (items ?? []).filter(i => i.status !== 'EN POSICIÓN' && i.status !== 'Señal Dada — En posición');
    const pullback = list.filter(i => (i.watch_reason ?? '').toLowerCase().includes('pullback')).length;
    const near = list.filter(i => {
      const v = i.stochastic_level;
      return v != null && (v < 30 || v > 70);
    }).length;
    return { pullback, near };
  }, [items]);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [broker, setBroker] = useState<BrokerFilter>('all');
  const location = useLocation();
  useRealtimeSync();
  const { closedTrades, openTrades } = useAllTrades();
  const filteredClosed = filterByBroker(closedTrades, broker);
  const filteredOpen = filterByBroker(openTrades, broker);
  const stats = computeStatsFromTrades(filteredClosed, filteredOpen);
  const radarBadges = useRadarBadges();

  const renderNavItem = (item: typeof navItems[number], onClick?: () => void) => {
    const isActive = location.pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
      >
        <item.icon className="w-4 h-4" />
        <span className="flex-1">{item.label}</span>
        {item.to === '/radar' && (radarBadges.pullback > 0 || radarBadges.near > 0) && (
          <span className="flex items-center gap-1 shrink-0">
            {radarBadges.pullback > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/40">
                ⭐{radarBadges.pullback}
              </span>
            )}
            {radarBadges.near > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                ⚡{radarBadges.near}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  return (
    <BrokerContext.Provider value={{ broker, setBroker }}>
      <div className="flex h-screen overflow-hidden bg-background">
        <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-sidebar shrink-0">
          <div className="p-5 border-b border-border">
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
              <span className="text-primary">CAP</span> Trading
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">CAP Trend Following</p>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1">
            {navItems.map(item => renderNavItem(item))}
          </nav>
          <div className="p-4 border-t border-border space-y-3">
            <ThemeToggle />
            <div className="text-xs text-muted-foreground">CAP Trend Following v2.0</div>
            <SignOutButton />
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-border p-4">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-lg font-bold"><span className="text-primary">CAP</span> Trading</h1>
                <button onClick={() => setMobileOpen(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <nav className="space-y-1">
                {navItems.map(item => renderNavItem(item, () => setMobileOpen(false)))}
              </nav>
              <div className="mt-6 pt-4 border-t border-border space-y-3">
                <ThemeToggle />
                <SignOutButton />
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 lg:px-6">
              <button className="lg:hidden mr-2 p-2 -ml-1 text-muted-foreground" onClick={() => setMobileOpen(true)}>
                <Menu className="w-7 h-7" />
              </button>
              <BrokerSelector value={broker} onChange={setBroker} compact />
              <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide flex-1">
                <MetricPill label="P&L Total" value={formatCurrency(stats.totalPnl)} positive={stats.totalPnl >= 0} />
                <MetricPill label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} positive={stats.winRate >= 50} />
                <MetricPill label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} positive={stats.profitFactor >= 1} />
                <MetricPill label="Abiertas" value={String(stats.openCount)} neutral />
                {stats.totalTrades > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-xs shrink-0">
                    <span className="text-muted-foreground">Racha</span>
                    <span className={`font-data font-semibold ${stats.streakType === 'W' ? 'text-success' : 'text-destructive'}`}>
                      {stats.currentStreak}{stats.streakType}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </BrokerContext.Provider>
  );
}

function MetricPill({ label, value, positive, neutral }: { label: string; value: string; positive?: boolean; neutral?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-xs shrink-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-data font-semibold ${neutral ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>
        {value}
      </span>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" />
      Cerrar Sesión
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Cambiar a claro' : 'Cambiar a oscuro';
  return (
    <button
      onClick={toggle}
      title={nextLabel}
      aria-label={nextLabel}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium border border-border bg-secondary/40 text-foreground hover:bg-secondary transition-colors group"
    >
      {isDark ? (
        <Moon className="w-3.5 h-3.5 text-primary" />
      ) : (
        <Sun className="w-3.5 h-3.5 text-primary" />
      )}
      <span className="flex-1 text-left">
        <span className="group-hover:hidden">{isDark ? 'Oscuro' : 'Claro'}</span>
        <span className="hidden group-hover:inline text-muted-foreground">
          → {isDark ? 'Claro' : 'Oscuro'}
        </span>
      </span>
    </button>
  );
}
