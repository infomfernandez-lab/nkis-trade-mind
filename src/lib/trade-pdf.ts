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

// Brand palette
const NAVY: [number, number, number] = [15, 27, 58];
const NAVY_SOFT: [number, number, number] = [30, 45, 85];
const GOLD: [number, number, number] = [196, 160, 75];
const GOLD_SOFT: [number, number, number] = [232, 213, 165];
const GREEN: [number, number, number] = [22, 145, 80];
const RED: [number, number, number] = [200, 45, 55];
const TEXT: [number, number, number] = [25, 30, 45];
const TEXT_MUTED: [number, number, number] = [110, 118, 135];
const BORDER: [number, number, number] = [220, 224, 232];
const ROW_ALT: [number, number, number] = [248, 249, 252];

function brokerLabel(b: string): string {
  const k = (b || '').toLowerCase();
  if (k === 'darwinex') return 'NKIS';
  if (k === 'fxpro') return 'OCTX';
  if (k === 'octx') return 'OCTX';
  if (k === 'nkis') return 'NKIS';
  return (b || '').toUpperCase();
}

function formatCurrencyEur(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}€${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-ES');
}

function fmtDateShort(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES');
}

function safeFilenamePart(s: string): string {
  return (s || '').replace(/[^A-Za-z0-9+\-_€]/g, '');
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
  const contentWidth = pageWidth - margin * 2;

  const broker = brokerLabel(trade.broker);
  const close = detectCloseType(trade);
  const rr = computeRR(trade);
  const pnlColor: [number, number, number] = trade.netPnl >= 0 ? GREEN : RED;
  const exportDate = new Date().toLocaleString('es-ES');

  // ---------- header / footer ----------
  const drawHeader = (showHero: boolean) => {
    // Top navy band
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 22, 'F');
    // Gold accent line
    doc.setFillColor(...GOLD);
    doc.rect(0, 22, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('CAP Trading — Sistema 1', margin, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD_SOFT);
    doc.text('DARWIN NKIS', margin, 17);
    doc.setTextColor(255, 255, 255);
    doc.text(`Exportado: ${exportDate}`, pageWidth - margin, 17, { align: 'right' });

    if (!showHero) return 30;

    // Hero block: symbol + direction + dates + pnl
    let y = 32;
    const heroH = 34;
    doc.setDrawColor(...BORDER);
    doc.setFillColor(252, 252, 254);
    doc.roundedRect(margin, y, contentWidth, heroH, 2, 2, 'FD');

    // Left: symbol + direction
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text(trade.symbol, margin + 5, y + 13);

    const dirColor = trade.direction === 'BUY' ? GREEN : RED;
    doc.setFillColor(...dirColor);
    doc.roundedRect(margin + 5, y + 17, 22, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(trade.direction, margin + 16, y + 22.6, { align: 'center' });

    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Broker: ${broker}  ·  Ticket #${trade.ticket}`, margin + 30, y + 22.6);

    // Middle: dates
    const midX = margin + contentWidth * 0.46;
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(8);
    doc.text('ENTRADA', midX, y + 8);
    doc.text('CIERRE', midX, y + 19);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(fmtDate(trade.entryDate), midX + 18, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(fmtDate(trade.exitDate), midX + 18, y + 19);

    // Right: PnL
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('RESULTADO', pageWidth - margin - 5, y + 8, { align: 'right' });
    doc.setTextColor(...pnlColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(formatCurrencyEur(trade.netPnl), pageWidth - margin - 5, y + 22, { align: 'right' });

    return y + heroH + 6;
  };

  const sectionTitle = (yStart: number, title: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(margin, yStart, contentWidth, 7, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(margin, yStart + 7, contentWidth, 0.6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 3, yStart + 5);
    return yStart + 11;
  };

  const drawTable = (yStart: number, rows: Array<[string, string, [number, number, number]?]>) => {
    const rowH = 7.5;
    const labelW = 55;
    let y = yStart;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...ROW_ALT);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }
      doc.setTextColor(...TEXT_MUTED);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(row[0], margin + 3, y + 5);
      doc.setTextColor(...(row[2] ?? TEXT));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(row[1] || '—', contentWidth - labelW - 6);
      doc.text(lines, margin + labelW, y + 5);
      // bottom border
      doc.setDrawColor(...BORDER);
      doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
      y += rowH;
    });
    // outer border
    doc.setDrawColor(...BORDER);
    doc.rect(margin, yStart, contentWidth, y - yStart);
    return y + 4;
  };

  const drawJournalSection = (yStart: number, title: string, rows: Array<[string, string | null]>, longRows: Array<[string, string | null]> = []) => {
    let y = sectionTitle(yStart, title);
    y = drawTable(y, rows.map(([l, v]) => [l, v ?? '—']));
    longRows.forEach(([label, value]) => {
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label.toUpperCase(), margin, y + 1);
      y += 4;
      doc.setDrawColor(...BORDER);
      doc.setFillColor(252, 252, 254);
      const text = value && value.trim() ? value : '—';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(text, contentWidth - 6);
      const boxH = Math.max(10, lines.length * 4.6 + 4);
      doc.roundedRect(margin, y, contentWidth, boxH, 1, 1, 'FD');
      doc.text(lines, margin + 3, y + 5);
      y += boxH + 3;
    });
    return y + 2;
  };

  // ---------- PAGE 1: data + indicators ----------
  let y = drawHeader(true);
  y = sectionTitle(y, 'Datos del Trade');
  y = drawTable(y, [
    ['Símbolo', trade.symbol],
    ['Broker', broker],
    ['Dirección', trade.direction, trade.direction === 'BUY' ? GREEN : RED],
    ['Ticket', `#${trade.ticket}`],
    ['Entrada', `${trade.entryPrice}  (${fmtDate(trade.entryDate)})`],
    ['Salida', `${trade.exitPrice ?? '—'}  (${fmtDate(trade.exitDate)})`],
    ['SL / TP', `${trade.slPrice} / ${trade.tpPrice}`],
    ['Lotaje', String(trade.lotSize)],
    ['P&L Bruto', formatCurrencyEur(trade.grossPnl), trade.grossPnl >= 0 ? GREEN : RED],
    ['Comisión / Swap', `€${trade.commission}  /  €${trade.swap}`],
    ['P&L Neto', formatCurrencyEur(trade.netPnl), pnlColor],
    ['Duración', `${trade.durationHours}h`],
    ['RR real', rr != null ? rr.toFixed(2) : '—'],
    ['Tipo de cierre', close.label],
  ]);

  y = sectionTitle(y, 'Indicadores al Momento de Entrada');
  drawTable(y, [
    ['ADX', `${trade.adxValue}  (${trade.adxState})`],
    ['Distancia a MA50', `${trade.distanceToMA50}%  (${trade.distanceToMA50Label})`],
    ['Momentum 20d', `${trade.momentum20d}%   ${trade.momentumAligned ? '✓ Alineado' : '✗ No alineado'}`],
    ['Estocástico K', String(trade.stochasticK)],
    ['Ranking Scanner', scannerInfo && scannerInfo.rank != null
      ? `#${scannerInfo.rank} de ${scannerInfo.total} — Score: ${scannerInfo.score}`
      : 'No estaba en el radar'],
    ['VIX al entrar', vixValue != null ? vixValue.toFixed(1) : '—'],
  ]);

  // ---------- PAGE 2: journal ----------
  doc.addPage();
  let y2 = drawHeader(false);
  y2 = drawJournalSection(y2, 'Antes de Entrar',
    [
      ['Estado emocional', journal.emotionalState],
      ['Razón de entrada', journal.reasonForEntry],
      ['Cumplimiento sistema', journal.systemCompliance],
      ['Dudas del setup', journal.setupDoubts],
    ],
    [['Notas', journal.preTradeNotes]],
  );

  y2 = drawJournalSection(y2, 'Durante el Trade',
    [
      ['Gestión de la espera', journal.managingWait],
      ['Intervención manual', journal.manualIntervention],
      ...(journal.manualIntervention && journal.manualIntervention !== 'EA gestionando solo'
        ? [['Por qué intervine', journal.interventionReason] as [string, string | null]]
        : []),
    ],
    [['Notas', journal.duringTradeNotes]],
  );

  drawJournalSection(y2, 'Después del Cierre',
    [
      ['Sensación', journal.feelingResult],
      ['¿Respeté el sistema?', journal.respectedSystem],
      ['¿Qué haría diferente?', journal.whatDoDifferently],
    ],
    [['Notas', journal.postTradeNotes]],
  );

  // ---------- PAGE 3 & 4: charts (full page) ----------
  const drawFullPageChart = async (title: string, url: string | null) => {
    doc.addPage();
    const yTop = drawHeader(false);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, yTop + 4);

    const areaY = yTop + 8;
    const areaH = pageHeight - areaY - 18; // leave room for footer
    const areaW = contentWidth;

    if (!url) {
      doc.setDrawColor(...BORDER);
      doc.setFillColor(...ROW_ALT);
      doc.roundedRect(margin, areaY, areaW, areaH, 2, 2, 'FD');
      doc.setTextColor(...TEXT_MUTED);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.text('No se ha subido captura', pageWidth / 2, areaY + areaH / 2, { align: 'center' });
      return;
    }
    const img = await loadImageDataUrl(url);
    if (!img) {
      doc.setTextColor(...RED);
      doc.text('No se pudo cargar la imagen', pageWidth / 2, areaY + areaH / 2, { align: 'center' });
      return;
    }
    const ratio = img.width / img.height;
    let w = areaW;
    let h = w / ratio;
    if (h > areaH) {
      h = areaH;
      w = h * ratio;
    }
    const x = margin + (areaW - w) / 2;
    const yImg = areaY + (areaH - h) / 2;
    doc.addImage(img.dataUrl, img.format, x, yImg, w, h);
  };

  await drawFullPageChart('Gráfico de entrada', chartUrls?.entrada ?? null);
  await drawFullPageChart('Gráfico de cierre', chartUrls?.cierre ?? null);

  // ---------- footer on every page ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // gold separator
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('DARWIN NKIS — Confidencial', margin, pageHeight - 7);
    doc.text(exportDate, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text(`Página ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // ---------- filename ----------
  const datePart = (trade.entryDate ?? trade.exitDate ?? new Date().toISOString()).slice(0, 10);
  const pnlPart = formatCurrencyEur(trade.netPnl).replace(/\s/g, '');
  const filename = `${broker}_${safeFilenamePart(trade.symbol)}_${trade.direction}_${datePart}_${safeFilenamePart(pnlPart)}.pdf`;
  doc.save(filename);
}
