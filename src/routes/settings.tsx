import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon, Key, Download, Upload, RefreshCw, Loader2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: 'Ajustes — CAP Trading' },
      { name: 'description', content: 'Configuración de cuenta y sistema.' },
    ],
  }),
});

function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const [showKey, setShowKey] = useState(false);

  const [broker, setBroker] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceNkis, setBalanceNkis] = useState('');
  const [balanceOctx, setBalanceOctx] = useState('');
  const [riskPerTrade, setRiskPerTrade] = useState('');
  const [maxOpenPositions, setMaxOpenPositions] = useState('');
  const [vixBlock, setVixBlock] = useState('');
  const [vixCaution, setVixCaution] = useState('');

  useEffect(() => {
    if (settings) {
      setBroker(settings.broker ?? '');
      setAccountNumber(settings.account_number ?? '');
      setBalance(String(settings.balance ?? 0));
      setBalanceNkis(String((settings as any).balance_nkis ?? 1000000));
      setBalanceOctx(String((settings as any).balance_octx ?? 26.39));
      setRiskPerTrade(String(settings.risk_per_trade ?? 1));
      setMaxOpenPositions(String(settings.max_open_positions ?? 2));
      setVixBlock(String(settings.vix_block_threshold ?? 45));
      setVixCaution(String(settings.vix_caution_threshold ?? 25));
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando ajustes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Error al cargar ajustes: {error.message}</p>
      </div>
    );
  }

  const handleSave = () => {
    updateSettings.mutate({
      broker,
      account_number: accountNumber,
      balance: parseFloat(balance) || 0,
      balance_nkis: parseFloat(balanceNkis) || 0,
      balance_octx: parseFloat(balanceOctx) || 0,
      risk_per_trade: parseFloat(riskPerTrade) || 1,
      max_open_positions: parseInt(maxOpenPositions) || 2,
      vix_block_threshold: parseFloat(vixBlock) || 45,
      vix_caution_threshold: parseFloat(vixCaution) || 25,
    } as any, {
      onSuccess: () => toast.success('Ajustes guardados'),
      onError: (e) => toast.error(`Error al guardar: ${e.message}`),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground mt-1">Configuración de cuenta y sistema</p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Cambios
        </button>
      </div>

      <SettingsCard title="Cuenta" icon={SettingsIcon}>
        <FieldGroup>
          <InputField label="Broker" value={broker} onChange={setBroker} />
          <InputField label="Número de Cuenta" value={accountNumber} onChange={setAccountNumber} />
          <InputField label="Balance" value={balance} onChange={setBalance} />
        </FieldGroup>
      </SettingsCard>

      <SettingsCard title="Configuración de Riesgo" icon={SettingsIcon}>
        <FieldGroup>
          <InputField label="Riesgo por Trade (%)" value={riskPerTrade} onChange={setRiskPerTrade} />
          <InputField label="Máx. Posiciones Abiertas" value={maxOpenPositions} onChange={setMaxOpenPositions} />
          <InputField label="Umbral VIX Bloqueo" value={vixBlock} onChange={setVixBlock} />
          <InputField label="Umbral VIX Precaución" value={vixCaution} onChange={setVixCaution} />
        </FieldGroup>
      </SettingsCard>

      <SettingsCard title="Clave API Sincronización MT5" icon={Key}>
        <p className="text-sm text-muted-foreground mb-3">
          Usa esta clave en tu script Python de sincronización como header de Authorization.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-input border border-border rounded-md px-3 py-2 font-data text-sm text-foreground/80 overflow-hidden">
            {showKey ? (settings?.api_key ?? '—') : '••••••••••••••••••••••••••••••••••••'}
          </div>
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded-md bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Gestión de Datos" icon={Download}>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Download className="w-4 h-4" />
            Exportar Datos (JSON)
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-accent transition-colors">
            <Upload className="w-4 h-4" />
            Importar Backup
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
