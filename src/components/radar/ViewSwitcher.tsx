// Selector de vista del escáner. Sustituye a las pestañas
// (Escaneado / Vigilancia EA / Posiciones) por un grupo de tres
// botones algo más grandes, pensados para vivir dentro de la
// barra de filtros, justo debajo del buscador.

export type RadarView = 'escaneado' | 'vigilancia' | 'posiciones';

interface Props {
  value: RadarView;
  onChange: (v: RadarView) => void;
  counts: { escaneado: number; vigilancia: number; posiciones: number };
}

export function ViewSwitcher({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
      <Btn active={value === 'escaneado'}  onClick={() => onChange('escaneado')}
           label="📡 Escaneado"     count={counts.escaneado} />
      <Btn active={value === 'vigilancia'} onClick={() => onChange('vigilancia')}
           label="👁 Vigilancia EA" count={counts.vigilancia} />
      <Btn active={value === 'posiciones'} onClick={() => onChange('posiciones')}
           label="📈 Posiciones"     count={counts.posiciones} />
    </div>
  );
}

function Btn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-md text-sm font-semibold border transition-colors inline-flex items-center gap-2 ${
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
      }`}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-data ${
        active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/60 text-foreground/70'
      }`}>{count}</span>
    </button>
  );
}
