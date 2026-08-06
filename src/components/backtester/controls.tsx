import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export function SliderRow({ label, value, min, max, step, onChange, decimals = 0, help, badge }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  help?: string; badge?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Label className="text-xs">{label}</Label>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-primary">{value.toFixed(decimals)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(v[0])} />
      {help && <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{help}</p>}
    </div>
  );
}

export function ToggleSliderRow({ label, enabled, onToggle, value, min, max, step, onChange, suffix = '' }: {
  label: string; enabled: boolean; onToggle: (v: boolean) => void;
  value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 items-center">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} />
          <Label className="text-xs">{label}</Label>
        </div>
        <span className="text-xs font-mono font-semibold text-primary">{value.toFixed(1)}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(v[0])} disabled={!enabled} />
    </div>
  );
}
