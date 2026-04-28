import { jsPDF } from 'jspdf';
import type { Trade } from './trade-utils';
import { detectCloseType, computeRR } from './trade-derived';

interface JournalData {
  emotionalState: string | null;
  reasonForEntry: string | null;
  systemCompliance: string | null;
  setupDoubts: string | null;
  preTradeNotes: string | null;
  managingWait: string | null;
  manualIntervention: string | null;
  interventionReason: string | null;
  duringTradeNotes: string | null;
  feelingResult: string | null;
  respectedSystem: string | null;
  whatDoDifferently: string | null;
  postTradeNotes: string | null;
}

interface ExportArgs {
  trade: Trade;
  journal: JournalData;
  scannerInfo?: { rank: number | null; total: number | null; score: number | null };
  vixValue?: number | null;
  chartUrls?: { entrada: string | null; cierre: string | null };
}

function formatCurrencyEur(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}€${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-ES');
}

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    const format: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, format, width: dims.w, height: dims.h };
  } catch {
    return null;
  }
}

export async function exportTradePdf({ trade, journal, scannerInfo, vixValue, chartUrls }: ExportArgs) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CAP Trading — Sistema 1', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Exportado: ${new Date().toLocaleString('es-ES')}`, pageWidth - margin, 13, { align: 'right' });
  y = 28;

  doc.setTextColor(20, 20, 20);

  const sectionTitle = (title: string) => {
    ensureSpace(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(title.toUpperCase(), margin + 2, y + 1);
    y += 8;
    doc.setTextColor(20, 20, 20);
  };

  const kv = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const text = value || '—';
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 45);
    doc.text(lines, margin + 45, y);
    y += Math.max(5, lines.length * 5);
  };

  const longText = (label: string, value: string | null) => {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const text = value && value.trim() ? value : '—';
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    ensureSpace(lines.length * 4.5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  };

  // 1. Datos del trade
  const closeType = detectCloseType(trade);
  const rr = computeRR(trade);
  sectionTitle('Datos del Trade');
  kv('Símbolo', trade.symbol);
  kv('Broker', trade.broker);
  kv('Dirección', trade.direction);
  kv('Ticket', `#${trade.ticket}`);
  kv('Entrada', `${trade.entryPrice} (${fmtDate(trade.entryDate)})`);
  kv('Salida', `${trade.exitPrice ?? '—'} (${fmtDate(trade.exitDate)})`);
  kv('SL / TP', `${trade.slPrice} / ${trade.tpPrice}`);
  kv('Lotaje', String(trade.lotSize));
  kv('P&L Neto', formatCurrencyEur(trade.netPnl));
  kv('Duración', `${trade.durationHours}h`);
  kv('RR real', rr != null ? rr.toFixed(2) : '—');
  kv('Tipo de cierre', closeType.label);

  // 2. Indicadores
  sectionTitle('Indicadores al momento de entrada');
  kv('ADX', `${trade.adxValue} (${trade.adxState})`);
  kv('Dist. MA50', `${trade.distanceToMA50}% (${trade.distanceToMA50Label})`);
  kv('Momentum 20d', `${trade.momentum20d}% ${trade.momentumAligned ? '✓ Alineado' : '✗ No alineado'}`);
  kv('Estocástico K', String(trade.stochasticK));
  kv(
    'Ranking Scanner',
    scannerInfo && scannerInfo.rank != null
      ? `#${scannerInfo.rank} de ${scannerInfo.total} — Score: ${scannerInfo.score}`
      : 'No estaba en el radar',
  );
  kv('VIX al entrar', vixValue != null ? vixValue.toFixed(1) : '—');

  // 3. Antes
  sectionTitle('Antes de Entrar');
  kv('Estado Emocional', journal.emotionalState ?? '—');
  kv('Razón de Entrada', journal.reasonForEntry ?? '—');
  kv('Cumplimiento Sistema', journal.systemCompliance ?? '—');
  kv('Dudas del setup', journal.setupDoubts ?? '—');
  longText('Notas', journal.preTradeNotes);

  // 4. Durante
  sectionTitle('Durante el Trade');
  kv('Gestión de la espera', journal.managingWait ?? '—');
  kv('Intervención manual', journal.manualIntervention ?? '—');
  if (journal.manualIntervention && journal.manualIntervention !== 'EA gestionando solo') {
    kv('Por qué intervine', journal.interventionReason ?? '—');
  }
  longText('Notas', journal.duringTradeNotes);

  // 5. Después
  sectionTitle('Después del Cierre');
  kv('Sensación', journal.feelingResult ?? '—');
  kv('¿Respeté el sistema?', journal.respectedSystem ?? '—');
  kv('¿Qué haría diferente?', journal.whatDoDifferently ?? '—');
  longText('Notas', journal.postTradeNotes);

  // Footer en todas las páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('DARWIN NKIS — Confidencial', pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const datePart = (trade.exitDate ?? trade.entryDate).slice(0, 10);
  doc.save(`trade_${trade.symbol}_${datePart}.pdf`);
}
