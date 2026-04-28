import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET = 'trade-charts';

function fechaTag(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function RadarCaptureButton({ symbol }: { symbol: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${symbol}/seguimiento_${fechaTag()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      toast.success(`Captura de ${symbol} guardada`, {
        action: { label: 'Ver', onClick: () => window.open(pub.publicUrl, '_blank') },
      });
    } catch (e: any) {
      toast.error(`Error: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Subir captura actual"
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
        Captura actual
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
