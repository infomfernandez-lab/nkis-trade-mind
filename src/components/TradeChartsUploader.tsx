import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Slot = 'entrada' | 'cierre';

interface Props {
  ticket: number | null;
  onUrlsChange?: (urls: { entrada: string | null; cierre: string | null }) => void;
}

const BUCKET = 'trade-charts';
const SIGNED_TTL = 60 * 60; // 1 hour

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

function folderFor(uid: string, ticket: number | string) {
  return `${uid}/${ticket}`;
}

function pathFor(uid: string, ticket: number | string, slot: Slot, ext: string) {
  return `${folderFor(uid, ticket)}/${slot}.${ext}`;
}

async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

async function findExisting(uid: string, ticket: number | string, slot: Slot): Promise<string | null> {
  const folder = folderFor(uid, ticket);
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 20 });
  if (!data) return null;
  const file = data.find(f => f.name.startsWith(`${slot}.`));
  if (!file) return null;
  return signedUrl(`${folder}/${file.name}`);
}

export function TradeChartsUploader({ ticket, onUrlsChange }: Props) {
  const [urls, setUrls] = useState<{ entrada: string | null; cierre: string | null }>({ entrada: null, cierre: null });
  const [busy, setBusy] = useState<Slot | null>(null);

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    (async () => {
      const uid = await currentUid();
      if (!uid) return;
      const [entrada, cierre] = await Promise.all([findExisting(uid, ticket, 'entrada'), findExisting(uid, ticket, 'cierre')]);
      if (cancelled) return;
      const next = { entrada, cierre };
      setUrls(next);
      onUrlsChange?.(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="text-xs text-muted-foreground italic">Sin ticket: no se pueden subir capturas para este trade.</div>
    );
  }

  const handleFile = async (slot: Slot, file: File) => {
    setBusy(slot);
    try {
      const uid = await currentUid();
      if (!uid) throw new Error('Sesión requerida');
      const folder = folderFor(uid, ticket);
      const { data: list } = await supabase.storage.from(BUCKET).list(folder);
      const stale = (list ?? []).filter(f => f.name.startsWith(`${slot}.`));
      if (stale.length > 0) {
        await supabase.storage.from(BUCKET).remove(stale.map(f => `${folder}/${f.name}`));
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = pathFor(uid, ticket, slot, ext);
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
      if (error) throw error;
      const url = await signedUrl(path);
      const next = { ...urls, [slot]: url };
      setUrls(next);
      onUrlsChange?.(next);
      toast.success(`Gráfico de ${slot} subido`);
    } catch (e: any) {
      toast.error(`Error al subir: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (slot: Slot) => {
    setBusy(slot);
    try {
      const uid = await currentUid();
      if (!uid) throw new Error('Sesión requerida');
      const folder = folderFor(uid, ticket);
      const { data: list } = await supabase.storage.from(BUCKET).list(folder);
      const stale = (list ?? []).filter(f => f.name.startsWith(`${slot}.`));
      if (stale.length > 0) {
        await supabase.storage.from(BUCKET).remove(stale.map(f => `${folder}/${f.name}`));
      }
      const next = { ...urls, [slot]: null };
      setUrls(next);
      onUrlsChange?.(next);
      toast.success(`Gráfico de ${slot} eliminado`);
    } catch (e: any) {
      toast.error(`Error al eliminar: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartSlot
        label="📸 Subir gráfico entrada"
        slot="entrada"
        url={urls.entrada}
        busy={busy === 'entrada'}
        onFile={f => handleFile('entrada', f)}
        onRemove={() => handleRemove('entrada')}
      />
      <ChartSlot
        label="📸 Subir gráfico cierre"
        slot="cierre"
        url={urls.cierre}
        busy={busy === 'cierre'}
        onFile={f => handleFile('cierre', f)}
        onRemove={() => handleRemove('cierre')}
      />
    </div>
  );
}

function ChartSlot({
  label, slot, url, busy, onFile, onRemove,
}: {
  label: string; slot: Slot; url: string | null; busy: boolean;
  onFile: (file: File) => void; onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gráfico {slot}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
            {url ? 'Reemplazar' : label}
          </Button>
          {url && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onRemove} className="text-destructive border-destructive/40 hover:bg-destructive/10">
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={`Gráfico ${slot}`} className="w-full h-auto rounded border border-border" />
        </a>
      ) : (
        <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed border-border rounded">
          Sin gráfico. Sube una captura.
        </div>
      )}
    </div>
  );
}
