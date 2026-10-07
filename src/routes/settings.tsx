import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon, Key, Download, Upload, RefreshCw, Loader2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';
import { Server } from 'lucide-react';
import { accountFromSettings, backtestServerHeaders } from '@/lib/account';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: 'Ajustes — CAP Trading' },
      { name: 'description', content: 'Configuración de la cuenta CWND, riesgo y servidor de backtest.' },
      { property: 'og:title', content: 'Ajustes — CAP Trading' },
      { property: 'og:description', content: 'Configuración de la cuenta CWND.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});

function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const [showKey, setShowKey] = useState(false);

  const [nombre, setNombre] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [moneda, setMoneda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [riesgoPct, setRiesgoPct] = useState('');
  const [maxOpenPositions, setMaxOpenPositions] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      const acc = accountFromSettings(settings);
      setNombre(acc.nombre);
      setAccountNumber(acc.numero);
      setSaldoInicial(String(acc.saldoInicial));
      setMoneda(acc.moneda);
      setFechaInicio(acc.fechaInicio);
      setRiesgoPct(String(acc.riesgoPct));
      setMaxOpenPositions(String(settings.max_open_positions ?? 8));
      setServerUrl(String((settings as any).backtest_server_url ?? ''));
      setServerKey(String((settings as any).backtest_server_key ?? ''));
    }
  }, [settings]);

  const testConnection = async () => {
    setTesting(true); setTestMsg(null);
    try {
      const r = await fetch(`${serverUrl.replace(/\/+$/, '')}/salud`, { headers: backtestServerHeaders(serverKey) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json().catch(() => ({}));
      setTestMsg({ ok: true, text: `Conectado · cuenta ${j?.cuenta ?? accountNumber}` });
    } catch (e: any) {
      setTestMsg({ ok: false, text: `Error: ${e.message ?? e}. Servidor apagado: abre 4_SERVIDOR_BACKTEST.bat y ngrok en tu PC.` });
    } finally { setTesting(false); }
  };

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
      cuenta_nombre: nombre,
      account_number: accountNumber,
      saldo_inicial: parseFloat(saldoInicial) || 0,
      moneda,
      fecha_inicio: fechaInicio,
      riesgo_pct: parseFloat(riesgoPct.replace(',', '.')) || 0.25,
      max_open_positions: parseInt(maxOpenPositions) || 8,
      backtest_server_url: serverUrl.trim(),
      backtest_server_key: serverKey.trim(),
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
          <InputField label="Nombre" value={nombre} onChange={setNombre} />
          <InputField label="Número de cuenta MT5" value={accountNumber} onChange={setAccountNumber} />
          <InputField label="Saldo inicial" value={saldoInicial} onChange={setSaldoInicial} />
          <InputField label="Moneda" value={moneda} onChange={setMoneda} />
          <InputField label="Fecha de inicio (AAAA-MM-DD)" value={fechaInicio} onChange={setFechaInicio} />
          <InputField label="Riesgo por operación (%)" value={riesgoPct} onChange={setRiesgoPct} />
          <InputField label="Máx. posiciones abiertas" value={maxOpenPositions} onChange={setMaxOpenPositions} />
        </FieldGroup>
      </SettingsCard>

      <SettingsCard title="Servidor de backtest" icon={Server}>
        <FieldGroup>
          <InputField label="URL del servidor (ngrok)" value={serverUrl} onChange={setServerUrl} />
          <InputField label="Clave" value={serverKey} onChange={setServerKey} />
        </FieldGroup>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing || !serverUrl}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Probar conexión
          </button>
          {testMsg && <span className={`text-sm ${testMsg.ok ? 'text-success' : 'text-destructive'}`}>{testMsg.text}</span>}
        </div>
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
