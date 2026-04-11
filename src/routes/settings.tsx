import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon, Key, Download, Upload, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: 'Settings — NKIS Trading Intelligence' },
      { name: 'description', content: 'Account and system configuration.' },
    ],
  }),
});

function SettingsPage() {
  const [apiKey] = useState('nkis_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account and system configuration</p>
      </div>

      {/* Account */}
      <SettingsCard title="Account" icon={SettingsIcon}>
        <FieldGroup>
          <InputField label="Broker" defaultValue="Darwinex Zero" />
          <InputField label="Account Number" defaultValue="DZ-12345" />
          <InputField label="Balance" defaultValue="$14,412.00" />
        </FieldGroup>
      </SettingsCard>

      {/* Risk Settings */}
      <SettingsCard title="Risk Configuration" icon={SettingsIcon}>
        <FieldGroup>
          <InputField label="Risk Per Trade (%)" defaultValue="1.0" />
          <InputField label="Max Open Positions" defaultValue="2" />
          <InputField label="VIX Block Threshold" defaultValue="45" />
          <InputField label="VIX Caution Threshold" defaultValue="25" />
        </FieldGroup>
      </SettingsCard>

      {/* API Key */}
      <SettingsCard title="MT5 Sync API Key" icon={Key}>
        <p className="text-sm text-muted-foreground mb-3">
          Use this key in your Python sync script as the Authorization header.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-input border border-border rounded-md px-3 py-2 font-data text-sm text-foreground/80 overflow-hidden">
            {showKey ? apiKey : '••••••••••••••••••••••••••••••••••••'}
          </div>
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded-md bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button className="px-3 py-2 rounded-md bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </SettingsCard>

      {/* Data */}
      <SettingsCard title="Data Management" icon={Download}>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Download className="w-4 h-4" />
            Export All Data (JSON)
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-accent transition-colors">
            <Upload className="w-4 h-4" />
            Import Backup
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

function InputField({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        defaultValue={defaultValue}
        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
