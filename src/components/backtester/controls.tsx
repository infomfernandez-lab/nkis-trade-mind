import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export function SliderRow({ label, value, min, max, step, onChange, decimals = 0 }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono font-semibold text-primary">{value.toFixed(decimals)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(v[0])} />
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
