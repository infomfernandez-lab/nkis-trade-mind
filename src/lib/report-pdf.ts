import { jsPDF } from 'jspdf';
import type { Trade } from './trade-utils';
import { buildEquityCurve } from './trade-utils';

// Brand palette (matched with trade-pdf.ts)
const NAVY: [number, number, number] = [15, 27, 58];
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
  if (k === 'darwinex' || k === 'nkis') return 'NK';
  if (k === 'fxpro' || k === 'octx') return 'OX';
  return (b || '').toUpperCase();
}

function formatEur(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}€${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function safe(s: string): string {
  return (s || '').replace(/[^A-Za-z0-9+\-_]/g, '');
}

// ---------- shared layout primitives ----------
interface Doc {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  exportDate: string;
  subtitle: string;
}

function newDoc(subtitle: string): Doc {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  return {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: 15,
    contentWidth: doc.internal.pageSize.getWidth() - 30,
    exportDate: new Date().toLocaleString('es-ES'),
    subtitle,
  };
}

function drawHeader(d: Doc, hero?: { title: string; meta: string; right?: string; rightColor?: [number, number, number] }) {
  const { doc, pageWidth, margin, contentWidth } = d;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 22, pageWidth, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CAP Trading — Sistema 1', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_SOFT);
  doc.text(d.subtitle, margin, 17);
  doc.setTextColor(255, 255, 255);
  doc.text(`Exportado: ${d.exportDate}`, pageWidth - margin, 17, { align: 'right' });

  if (!hero) return 30;

  let y = 32;
  const heroH = 28;
  doc.setDrawColor(...BORDER);
  doc.setFillColor(252, 252, 254);
  doc.roundedRect(margin, y, contentWidth, heroH, 2, 2, 'FD');

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(hero.title, margin + 5, y + 13);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(hero.meta, margin + 5, y + 22);

  if (hero.right) {
    doc.setTextColor(...(hero.rightColor ?? NAVY));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(hero.right, pageWidth - margin - 5, y + 17, { align: 'right' });
  }
  return y + heroH + 6;
}

function sectionTitle(d: Doc, yStart: number, title: string) {
  const { doc, margin, contentWidth } = d;
  if (yStart > d.pageHeight - 30) {
    doc.addPage();
    yStart = drawHeader(d);
  }
  doc.setFillColor(...NAVY);
  doc.rect(margin, yStart, contentWidth, 7, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(margin, yStart + 7, contentWidth, 0.6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), margin + 3, yStart + 5);
  return yStart + 11;
}

function ensureSpace(d: Doc, y: number, needed: number): number {
  if (y + needed > d.pageHeight - 18) {
    d.doc.addPage();
    return drawHeader(d);
  }
  return y;
}

function drawKeyValueTable(d: Doc, yStart: number, rows: Array<[string, string, [number, number, number]?]>) {
  const { doc, margin, contentWidth } = d;
  const rowH = 7.5;
  const labelW = 65;
  let y = yStart;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  rows.forEach((row, i) => {
    y = ensureSpace(d, y, rowH);
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
    doc.setDrawColor(...BORDER);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
    y += rowH;
  });
  doc.rect(margin, yStart, contentWidth, y - yStart);
  return y + 4;
}

function drawTable(
  d: Doc,
  yStart: number,
  columns: Array<{ label: string; width: number; align?: 'left' | 'right' | 'center' }>,
  rows: Array<Array<{ text: string; color?: [number, number, number] }>>,
) {
  const { doc, margin, contentWidth } = d;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const scale = contentWidth / totalW;
  const widths = columns.map(c => c.width * scale);
  const rowH = 7;
  let y = yStart;

  // header
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  let x = margin;
  columns.forEach((c, i) => {
    const tx = c.align === 'right' ? x + widths[i] - 2 : c.align === 'center' ? x + widths[i] / 2 : x + 2;
    doc.text(c.label.toUpperCase(), tx, y + 4.7, { align: c.align ?? 'left' });
    x += widths[i];
  });
  y += rowH;

  // body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rows.forEach((row, i) => {
    y = ensureSpace(d, y, rowH);
    if (i % 2 === 0) {
      doc.setFillColor(...ROW_ALT);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }
    let cx = margin;
    row.forEach((cell, j) => {
      doc.setTextColor(...(cell.color ?? TEXT));
      const align = columns[j].align ?? 'left';
      const tx = align === 'right' ? cx + widths[j] - 2 : align === 'center' ? cx + widths[j] / 2 : cx + 2;
      const lines = doc.splitTextToSize(cell.text || '—', widths[j] - 4);
      doc.text(lines[0] ?? '—', tx, y + 4.7, { align });
      cx += widths[j];
    });
    doc.setDrawColor(...BORDER);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
    y += rowH;
  });
  doc.setDrawColor(...BORDER);
  doc.rect(margin, yStart, contentWidth, y - yStart);
  return y + 4;
}

function drawStatGrid(d: Doc, yStart: number, items: Array<{ label: string; value: string; color?: [number, number, number] }>) {
  const { doc, margin, contentWidth } = d;
  const cols = 4;
  const gap = 3;
  const cardW = (contentWidth - gap * (cols - 1)) / cols;
  const cardH = 18;
  const rows = Math.ceil(items.length / cols);
  let y = yStart;
  for (let r = 0; r < rows; r++) {
    y = ensureSpace(d, y, cardH);
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= items.length) break;
      const x = margin + c * (cardW + gap);
      doc.setDrawColor(...BORDER);
      doc.setFillColor(252, 252, 254);
      doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setTextColor(...TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(items[idx].label.toUpperCase(), x + 3, y + 5);
      doc.setTextColor(...(items[idx].color ?? NAVY));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(items[idx].value, x + 3, y + 14);
    }
    y += cardH + gap;
  }
  return y + 2;
}

function drawEquityChart(
  d: Doc,
  yStart: number,
  points: { date: string; equity: number }[],
  height = 75,
  trades: Trade[] = [],
) {
  const { doc, margin, contentWidth, pageHeight } = d;
  if (yStart + height + 14 > pageHeight - 18) {
    doc.addPage();
    yStart = drawHeader(d);
  }
  if (points.length < 2) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Datos insuficientes para gráfico (se necesitan al menos 2 trades cerrados).', margin, yStart + 10);
    return yStart + 14;
  }
  const padL = 22, padR = 22, padT = 8, padB = 12;
  const x0 = margin;
  const y0 = yStart;
  const w = contentWidth;
  const h = height;
  const innerX = x0 + padL;
  const innerY = y0 + padT;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // background — clean white card
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x0, y0, w, h, 1.5, 1.5, 'FD');

  // ───── Equity series ─────
  const eqs = points.map(p => p.equity);
  let eqMin = Math.min(...eqs);
  let eqMax = Math.max(...eqs);
  if (eqMin === eqMax) { eqMin -= 1; eqMax += 1; }
  const eqRange = eqMax - eqMin;

  // ───── Drawdown series (peak-to-trough at each point, in EUR, positive = depth) ─────
  let peak = points[0].equity;
  const dd: number[] = points.map(p => {
    if (p.equity > peak) peak = p.equity;
    return Math.max(0, peak - p.equity);
  });
  const ddMaxRaw = Math.max(...dd);
  const ddMax = ddMaxRaw > 0 ? ddMaxRaw : 1;

  const px = (i: number) => innerX + (i / (points.length - 1)) * innerW;
  const pyEq = (eq: number) => innerY + innerH - ((eq - eqMin) / eqRange) * innerH;
  // drawdown uses bottom 35% of the chart area mirrored downward from baseline
  const ddBandH = innerH * 0.35;
  const pyDd = (v: number) => innerY + innerH - ddBandH + (v / ddMax) * ddBandH;

  // subtle horizontal gridlines (3 only)
  doc.setDrawColor(230, 232, 238);
  doc.setLineWidth(0.1);
  for (let i = 1; i < 3; i++) {
    const yy = innerY + (innerH * i) / 3;
    doc.line(innerX, yy, innerX + innerW, yy);
  }

  // baseline (starting equity)
  const startEq = points[0].equity;
  if (startEq >= eqMin && startEq <= eqMax) {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.25);
    const ys = pyEq(startEq);
    doc.line(innerX, ys, innerX + innerW, ys);
  }

  // ───── Drawdown red shaded area (own scale, anchored at baseline of band) ─────
  if (ddMaxRaw > 0) {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
    const baseY = innerY + innerH - ddBandH;
    for (let i = 1; i < points.length; i++) {
      const x1 = px(i - 1), x2 = px(i);
      const y1 = pyDd(dd[i - 1]), y2 = pyDd(dd[i]);
      doc.triangle(x1, y1, x2, y2, x2, baseY, 'F');
      doc.triangle(x1, y1, x2, baseY, x1, baseY, 'F');
    }
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
    // drawdown outline
    doc.setDrawColor(RED[0], RED[1], RED[2]);
    doc.setLineWidth(0.35);
    for (let i = 1; i < points.length; i++) {
      doc.line(px(i - 1), pyDd(dd[i - 1]), px(i), pyDd(dd[i]));
    }
  }

  // ───── Equity main line (navy) ─────
  for (let i = 1; i < points.length; i++) {
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.line(px(i - 1), pyEq(points[i - 1].equity), px(i), pyEq(points[i].equity));
  }

  // small markers on every equity point
  doc.setFillColor(...NAVY);
  for (let i = 0; i < points.length; i++) {
    doc.circle(px(i), pyEq(points[i].equity), 0.45, 'F');
  }

  // ───── Best & worst trade markers ─────
  // points[0] is the starting balance; points[i+1] corresponds to trades[i]
  if (trades.length > 0) {
    const indexed = trades.map((t, i) => ({ t, i: i + 1 }));
    const sorted = [...indexed].sort((a, b) => b.t.netPnl - a.t.netPnl);
    const best = sorted.slice(0, 3).filter(x => x.t.netPnl > 0);
    const worst = sorted.slice(-3).reverse().filter(x => x.t.netPnl < 0);

    const drawMarker = (idx: number, t: Trade, color: [number, number, number], above: boolean) => {
      if (idx >= points.length) return;
      const cx = px(idx);
      const cy = pyEq(points[idx].equity);
      // ring
      doc.setDrawColor(...color);
      doc.setLineWidth(0.6);
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, 1.4, 'FD');
      doc.setFillColor(...color);
      doc.circle(cx, cy, 0.7, 'F');

      // label
      const sign = t.netPnl >= 0 ? '+' : '';
      const label = `${t.symbol} ${sign}${Math.round(t.netPnl)}€`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...color);
      const tw = doc.getTextWidth(label);
      let lx = cx - tw / 2;
      // keep label inside chart bounds
      if (lx < innerX) lx = innerX;
      if (lx + tw > innerX + innerW) lx = innerX + innerW - tw;
      const ly = above ? Math.max(innerY + 3, cy - 2.2) : Math.min(innerY + innerH - 1, cy + 4);
      // tiny white background for legibility
      doc.setFillColor(255, 255, 255);
      doc.rect(lx - 0.5, ly - 3, tw + 1, 3.6, 'F');
      doc.setTextColor(...color);
      doc.text(label, lx, ly);
    };

    best.forEach(({ t, i }) => drawMarker(i, t, GREEN, true));
    worst.forEach(({ t, i }) => drawMarker(i, t, RED, false));
  }

  // ───── Axis labels ─────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  // Y left (equity)
  doc.text(`€${eqMax.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`, x0 + 1, innerY + 2);
  doc.text(`€${eqMin.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`, x0 + 1, innerY + innerH);
  // Y right (drawdown)
  if (ddMaxRaw > 0) {
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text(`DD -€${Math.round(ddMaxRaw).toLocaleString('es-ES')}`, x0 + w - 1, innerY + innerH, { align: 'right' });
    doc.setTextColor(...TEXT_MUTED);
  }
  // X dates
  doc.text(points[0].date, innerX, y0 + h + 4);
  doc.text(points[points.length - 1].date, innerX + innerW, y0 + h + 4, { align: 'right' });

  // legend
  const legendY = y0 + h + 4;
  const legendX = innerX + innerW / 2 - 22;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.8);
  doc.line(legendX, legendY - 1, legendX + 5, legendY - 1);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Equity', legendX + 6, legendY);
  doc.setDrawColor(RED[0], RED[1], RED[2]); doc.setLineWidth(0.8);
  doc.line(legendX + 22, legendY - 1, legendX + 27, legendY - 1);
  doc.text('Drawdown', legendX + 28, legendY);

  return y0 + h + 8;
}

function drawFooter(d: Doc) {
  const { doc, margin, pageWidth, pageHeight } = d;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('DARWIN NKIS — Confidencial', margin, pageHeight - 7);
    doc.text(d.exportDate, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text(`Página ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
}

// ---------- shared metric helpers ----------
function computeMetrics(trades: Trade[]) {
  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const totalPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? -grossLoss / losses.length : 0;
  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;
  return { totalPnl, grossProfit, grossLoss, winRate, profitFactor, avgWin, avgLoss, expectancy, wins: wins.length, losses: losses.length };
}

function maxDrawdown(trades: Trade[]): number {
  let peak = 0;
  let running = 0;
  let maxDD = 0;
  for (const t of trades) {
    running += t.netPnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/** Annualized Sharpe based on per-trade returns over startingBalance, scaled by √252. */
function sharpeRatio(trades: Trade[], startingBalance: number): number {
  if (trades.length < 2 || startingBalance <= 0) return 0;
  const returns = trades.map(t => t.netPnl / startingBalance);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (mean / sd) * Math.sqrt(252);
}

/** Recovery Factor = Net Profit / Max Drawdown. */
function recoveryFactor(trades: Trade[]): number {
  const total = trades.reduce((s, t) => s + t.netPnl, 0);
  const dd = maxDrawdown(trades);
  if (dd === 0) return total > 0 ? Infinity : 0;
  return total / dd;
}

/** Sum of rr_real (per trade) — mirrors src/lib/trade-derived.computeRR semantics. */
function totalR(trades: Trade[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const t of trades) {
    if (t.exitPrice == null || !t.slPrice) continue;
    const risk = Math.abs(t.entryPrice - t.slPrice);
    if (risk === 0) continue;
    const reward = t.direction === 'BUY'
      ? t.exitPrice - t.entryPrice
      : t.entryPrice - t.exitPrice;
    total += reward / risk;
    count++;
  }
  return { total, count };
}

function complianceRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const ok = trades.filter(t => t.systemCompliance === '100%').length;
  return (ok / trades.length) * 100;
}

function topErrors(trades: Trade[]): Array<[string, number]> {
  const map: Record<string, number> = {};
  for (const t of trades) {
    if (t.systemCompliance && t.systemCompliance !== '100%') {
      map[`Cumplimiento: ${t.systemCompliance}`] = (map[`Cumplimiento: ${t.systemCompliance}`] ?? 0) + 1;
    }
    if (t.manualIntervention && t.manualIntervention !== 'EA gestionando solo' && t.manualIntervention !== 'None, EA managing') {
      map[`Intervención: ${t.manualIntervention}`] = (map[`Intervención: ${t.manualIntervention}`] ?? 0) + 1;
    }
    if (t.setupDoubts && t.setupDoubts !== 'Sin dudas') {
      map[`Dudas setup: ${t.setupDoubts}`] = (map[`Dudas setup: ${t.setupDoubts}`] ?? 0) + 1;
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

// =====================================================================
// 0) DAILY REPORT
// =====================================================================
export interface DailyOpenPos {
  symbol: string;
  broker: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  slPrice: number;
  floatingPnl: number;
  status?: string;
}
export interface DailyEliteSignal {
  symbol: string;
  broker: 'darwinex' | 'octx' | string;
  direction: string;
  score: number;
}
export interface DailyArgs {
  date: Date;
  brokerFilter: 'all' | 'darwinex' | 'octx';
  closedToday: Trade[];
  openNow: DailyOpenPos[];
  eliteNkis: DailyEliteSignal[];
  eliteOctx: DailyEliteSignal[];
  vix: number | null;
  marketContext: string;
  systemFollowed: string;
  errors: string[];
  lesson: string;
  planTomorrow: string;
}

export function exportDailyReport(args: DailyArgs) {
  const { date, brokerFilter, closedToday, openNow, eliteNkis, eliteOctx, vix,
    marketContext, systemFollowed, errors, lesson, planTomorrow } = args;
  const d = newDoc('Informe Diario · DARWIN NKIS');
  const totalPnl = closedToday.reduce((s, t) => s + t.netPnl, 0);
  const floating = openNow.reduce((s, p) => s + p.floatingPnl, 0);
  const pnlColor: [number, number, number] = totalPnl >= 0 ? GREEN : RED;
  const dateLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  let y = drawHeader(d, {
    title: 'Informe Diario',
    meta: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    right: formatEur(totalPnl),
    rightColor: pnlColor,
  });

  y = sectionTitle(d, y, 'Resumen del Día');
  y = drawStatGrid(d, y, [
    { label: 'P&L Cerrado', value: formatEur(totalPnl), color: pnlColor },
    { label: 'Trades cerrados', value: String(closedToday.length) },
    { label: 'Posiciones abiertas', value: String(openNow.length) },
    { label: 'P&L Flotante', value: formatEur(floating), color: floating >= 0 ? GREEN : RED },
    { label: 'VIX del día', value: vix != null ? vix.toFixed(2) : '—' },
    { label: 'Cuenta', value: brokerFilter === 'all' ? 'NK + OX' : brokerLabel(brokerFilter) },
    { label: 'Señales ÉLITE NKIS', value: String(eliteNkis.length) },
    { label: 'Señales ÉLITE OCTX', value: String(eliteOctx.length) },
  ]);

  y = sectionTitle(d, y, 'Posiciones Cerradas Hoy');
  if (closedToday.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFont('helvetica', 'italic'); d.doc.setFontSize(10);
    d.doc.text('Sin trades cerrados hoy.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Hora', width: 16 },
        { label: 'Broker', width: 14 },
        { label: 'Símbolo', width: 22 },
        { label: 'Dir', width: 12 },
        { label: 'P&L', width: 22, align: 'right' },
        { label: 'Cumpl.', width: 16, align: 'center' },
      ],
      closedToday.map(t => [
        { text: new Date(t.exitDate ?? t.entryDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) },
        { text: brokerLabel(t.broker) },
        { text: t.symbol },
        { text: t.direction, color: t.direction === 'BUY' ? GREEN : RED },
        { text: formatEur(t.netPnl), color: t.netPnl >= 0 ? GREEN : RED },
        { text: t.systemCompliance ?? '—' },
      ]),
    );
  }

  y = sectionTitle(d, y, 'Posiciones Abiertas Ahora');
  if (openNow.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFont('helvetica', 'italic'); d.doc.setFontSize(10);
    d.doc.text('Sin posiciones abiertas.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Broker', width: 14 },
        { label: 'Símbolo', width: 22 },
        { label: 'Dir', width: 12 },
        { label: 'Lotes', width: 14, align: 'right' },
        { label: 'Entrada', width: 18, align: 'right' },
        { label: 'SL', width: 18, align: 'right' },
        { label: 'P&L Flot.', width: 22, align: 'right' },
      ],
      openNow.map(p => [
        { text: brokerLabel(p.broker) },
        { text: p.symbol },
        { text: p.direction, color: p.direction === 'BUY' ? GREEN : RED },
        { text: p.lotSize.toFixed(2) },
        { text: p.entryPrice.toFixed(2) },
        { text: p.slPrice ? p.slPrice.toFixed(2) : '—' },
        { text: formatEur(p.floatingPnl), color: p.floatingPnl >= 0 ? GREEN : RED },
      ]),
    );
  }

  const renderElite = (label: string, list: DailyEliteSignal[]) => {
    y = sectionTitle(d, y, label);
    if (list.length === 0) {
      d.doc.setTextColor(...TEXT_MUTED); d.doc.setFont('helvetica', 'italic'); d.doc.setFontSize(10);
      d.doc.text('Sin señales ÉLITE hoy.', d.margin, y + 4); y += 10;
    } else {
      y = drawTable(d, y,
        [
          { label: 'Símbolo', width: 28 },
          { label: 'Dirección', width: 24 },
          { label: 'Score', width: 18, align: 'right' },
        ],
        list.map(s => [
          { text: s.symbol },
          { text: s.direction },
          { text: String(s.score) },
        ]),
      );
    }
  };
  renderElite('Señales ÉLITE — NKIS', eliteNkis);
  renderElite('Señales ÉLITE — OCTX', eliteOctx);

  // Manual section
  const drawTextBox = (title: string, content: string) => {
    y = sectionTitle(d, y, title);
    y = ensureSpace(d, y, 24);
    const lines = d.doc.splitTextToSize(content?.trim() || '—', d.contentWidth - 6);
    const boxH = Math.max(20, lines.length * 4.6 + 4);
    d.doc.setDrawColor(...BORDER); d.doc.setFillColor(252, 252, 254);
    d.doc.roundedRect(d.margin, y, d.contentWidth, boxH, 1, 1, 'FD');
    d.doc.setTextColor(...TEXT); d.doc.setFont('helvetica', 'normal'); d.doc.setFontSize(9.5);
    d.doc.text(lines, d.margin + 3, y + 5);
    y += boxH + 4;
  };
  drawTextBox('Contexto de Mercado del Día', marketContext);

  y = sectionTitle(d, y, 'Cumplimiento del Sistema');
  y = drawKeyValueTable(d, y, [
    ['¿Seguiste el sistema hoy?', systemFollowed || '—'],
    ['Errores', errors.length > 0 ? errors.join(' · ') : 'Ninguno'],
  ]);

  drawTextBox('Lección del Día', lesson);
  drawTextBox('Plan para Mañana', planTomorrow);

  drawFooter(d);
  const brokerTag = brokerFilter === 'all' ? 'NK-OX' : brokerLabel(brokerFilter);
  const dateStr = date.toISOString().slice(0, 10);
  const pnlSign = totalPnl >= 0 ? '+' : '-';
  const pnlPart = `${pnlSign}${Math.round(Math.abs(totalPnl))}€`;
  const filename = `DIARIO_${dateStr}_${brokerTag}_${pnlPart}.pdf`;
  d.doc.save(filename);
}

// =====================================================================
// 1) WEEKLY REPORT
// =====================================================================
export interface WeeklyArgs {
  trades: Trade[];                     // already filtered to last 7 days
  weekStart: Date;
  weekEnd: Date;
  perspective: string;
}

export function exportWeeklyReport({ trades, weekStart, weekEnd, perspective }: WeeklyArgs) {
  const d = newDoc('Informe Semanal · DARWIN NKIS');
  const m = computeMetrics(trades);
  const dd = maxDrawdown(trades);
  const compliance = complianceRate(trades);
  const errors = topErrors(trades);

  const periodLabel = `${weekStart.toLocaleDateString('es-ES')} — ${weekEnd.toLocaleDateString('es-ES')}`;
  const pnlColor: [number, number, number] = m.totalPnl >= 0 ? GREEN : RED;

  let y = drawHeader(d, {
    title: 'Informe Semanal',
    meta: periodLabel,
    right: formatEur(m.totalPnl),
    rightColor: pnlColor,
  });

  y = sectionTitle(d, y, 'Resumen Semanal');
  y = drawStatGrid(d, y, [
    { label: 'Trades', value: String(trades.length) },
    { label: 'Win Rate', value: `${m.winRate.toFixed(1)}%` },
    { label: 'Profit Factor', value: m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2) },
    { label: 'Drawdown máx.', value: formatEur(-dd), color: RED },
    { label: 'Cumplimiento', value: `${compliance.toFixed(0)}%` },
    { label: 'Ganadores', value: String(m.wins), color: GREEN },
    { label: 'Perdedores', value: String(m.losses), color: RED },
    { label: 'Expectancy', value: formatEur(m.expectancy) },
  ]);

  y = sectionTitle(d, y, 'Trades Cerrados Esta Semana');
  if (trades.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED);
    d.doc.setFont('helvetica', 'italic');
    d.doc.setFontSize(10);
    d.doc.text('No se cerraron trades en este período.', d.margin, y + 4);
    y += 10;
  } else {
    y = drawTable(d,
      y,
      [
        { label: 'Fecha', width: 18 },
        { label: 'Broker', width: 14 },
        { label: 'Símbolo', width: 22 },
        { label: 'Dir', width: 12 },
        { label: 'P&L', width: 22, align: 'right' },
        { label: 'Cumpl.', width: 16, align: 'center' },
      ],
      trades.map(t => [
        { text: fmtShort(t.exitDate ?? t.entryDate) },
        { text: brokerLabel(t.broker) },
        { text: t.symbol },
        { text: t.direction, color: t.direction === 'BUY' ? GREEN : RED },
        { text: formatEur(t.netPnl), color: t.netPnl >= 0 ? GREEN : RED },
        { text: t.systemCompliance ?? '—' },
      ]),
    );
  }

  y = sectionTitle(d, y, 'Errores más frecuentes');
  if (errors.length === 0) {
    d.doc.setTextColor(...GREEN);
    d.doc.setFont('helvetica', 'italic');
    d.doc.setFontSize(10);
    d.doc.text('Sin errores registrados — sistema respetado al 100%.', d.margin, y + 4);
    y += 10;
  } else {
    y = drawKeyValueTable(d, y, errors.map(([k, v]) => [k, `${v} veces`] as [string, string]));
  }

  y = sectionTitle(d, y, 'Perspectiva Próxima Semana');
  y = ensureSpace(d, y, 30);
  d.doc.setDrawColor(...BORDER);
  d.doc.setFillColor(252, 252, 254);
  const lines = d.doc.splitTextToSize(perspective || '—', d.contentWidth - 6);
  const boxH = Math.max(24, lines.length * 4.6 + 4);
  d.doc.roundedRect(d.margin, y, d.contentWidth, boxH, 1, 1, 'FD');
  d.doc.setTextColor(...TEXT);
  d.doc.setFont('helvetica', 'normal');
  d.doc.setFontSize(9.5);
  d.doc.text(lines, d.margin + 3, y + 5);

  drawFooter(d);
  const filename = `Informe_Semanal_${weekStart.toISOString().slice(0, 10)}_${weekEnd.toISOString().slice(0, 10)}.pdf`;
  d.doc.save(filename);
}

// =====================================================================
// 2) MONTHLY REPORT
// =====================================================================
export interface MonthlyArgs {
  trades: Trade[];          // current month closed trades
  prevTrades: Trade[];      // previous month closed trades
  monthDate: Date;
  startingBalance: number;
  selfAssessment: string;
}

export function exportMonthlyReport({ trades, prevTrades, monthDate, startingBalance, selfAssessment }: MonthlyArgs) {
  const d = newDoc('Informe Mensual · DARWIN NKIS');
  const monthName = monthDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const m = computeMetrics(trades);
  const prev = computeMetrics(prevTrades);
  const dd = maxDrawdown(trades);
  const compliance = complianceRate(trades);
  const pnlColor: [number, number, number] = m.totalPnl >= 0 ? GREEN : RED;

  let y = drawHeader(d, {
    title: 'Informe Mensual',
    meta: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    right: formatEur(m.totalPnl),
    rightColor: pnlColor,
  });

  const sharpe = sharpeRatio(trades, startingBalance);
  const recovery = recoveryFactor(trades);
  const rTotal = totalR(trades);

  y = sectionTitle(d, y, 'Métricas del Mes');
  y = drawStatGrid(d, y, [
    { label: 'P&L Total', value: formatEur(m.totalPnl), color: pnlColor },
    { label: 'Trades', value: String(trades.length) },
    { label: 'Win Rate', value: `${m.winRate.toFixed(1)}%` },
    { label: 'Profit Factor', value: m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2) },
    { label: 'Avg Win', value: formatEur(m.avgWin), color: GREEN },
    { label: 'Avg Loss', value: formatEur(m.avgLoss), color: RED },
    { label: 'Drawdown máx.', value: formatEur(-dd), color: RED },
    { label: 'Cumplimiento', value: `${compliance.toFixed(0)}%` },
    { label: 'Ratio Sharpe', value: sharpe.toFixed(2), color: sharpe >= 1 ? GREEN : sharpe >= 0 ? NAVY : RED },
    { label: 'Recovery Factor', value: recovery === Infinity ? '∞' : recovery.toFixed(2), color: recovery >= 3 ? GREEN : recovery >= 1 ? NAVY : RED },
    { label: 'R Total', value: `${rTotal.total >= 0 ? '+' : ''}${rTotal.total.toFixed(2)}R`, color: rTotal.total >= 0 ? GREEN : RED },
    { label: 'Trades con R', value: String(rTotal.count) },
  ]);

  y = sectionTitle(d, y, 'Comparativa con Mes Anterior');
  const diff = (a: number, b: number) => {
    const v = a - b;
    return { text: formatEur(v), color: v >= 0 ? GREEN : RED } as { text: string; color: [number, number, number] };
  };
  y = drawTable(d, y,
    [
      { label: 'Métrica', width: 30 },
      { label: 'Este Mes', width: 25, align: 'right' },
      { label: 'Mes Anterior', width: 25, align: 'right' },
      { label: 'Δ', width: 25, align: 'right' },
    ],
    [
      [{ text: 'P&L' }, { text: formatEur(m.totalPnl), color: m.totalPnl >= 0 ? GREEN : RED }, { text: formatEur(prev.totalPnl), color: prev.totalPnl >= 0 ? GREEN : RED }, diff(m.totalPnl, prev.totalPnl)],
      [{ text: 'Trades' }, { text: String(trades.length) }, { text: String(prevTrades.length) }, { text: String(trades.length - prevTrades.length) }],
      [{ text: 'Win Rate' }, { text: `${m.winRate.toFixed(1)}%` }, { text: `${prev.winRate.toFixed(1)}%` }, { text: `${(m.winRate - prev.winRate).toFixed(1)}%`, color: m.winRate >= prev.winRate ? GREEN : RED }],
      [{ text: 'Profit Factor' }, { text: m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2) }, { text: prev.profitFactor === Infinity ? '∞' : prev.profitFactor.toFixed(2) }, { text: '—' }],
    ],
  );

  // Top 3 best & worst
  const sorted = [...trades].sort((a, b) => b.netPnl - a.netPnl);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  y = sectionTitle(d, y, '3 Mejores Trades');
  if (best.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFontSize(10); d.doc.setFont('helvetica', 'italic');
    d.doc.text('Sin trades este mes.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Fecha', width: 18 },
        { label: 'Símbolo', width: 22 },
        { label: 'Broker', width: 14 },
        { label: 'Dir', width: 12 },
        { label: 'P&L', width: 22, align: 'right' },
      ],
      best.map(t => [
        { text: fmtShort(t.exitDate ?? t.entryDate) },
        { text: t.symbol },
        { text: brokerLabel(t.broker) },
        { text: t.direction, color: t.direction === 'BUY' ? GREEN : RED },
        { text: formatEur(t.netPnl), color: GREEN },
      ]),
    );
  }

  y = sectionTitle(d, y, '3 Peores Trades');
  if (worst.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFontSize(10); d.doc.setFont('helvetica', 'italic');
    d.doc.text('Sin trades este mes.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Fecha', width: 18 },
        { label: 'Símbolo', width: 22 },
        { label: 'Broker', width: 14 },
        { label: 'Dir', width: 12 },
        { label: 'P&L', width: 22, align: 'right' },
      ],
      worst.map(t => [
        { text: fmtShort(t.exitDate ?? t.entryDate) },
        { text: t.symbol },
        { text: brokerLabel(t.broker) },
        { text: t.direction, color: t.direction === 'BUY' ? GREEN : RED },
        { text: formatEur(t.netPnl), color: RED },
      ]),
    );
  }

  // Equity curve for the month
  y = sectionTitle(d, y, 'Curva de Equity del Mes');
  const points = buildEquityCurve(trades, startingBalance);
  y = drawEquityChart(d, y, points, 75, trades);

  // NKIS vs OCTX
  y = sectionTitle(d, y, 'NKIS vs OCTX');
  const nkis = trades.filter(t => t.broker === 'darwinex' || t.broker === 'nkis');
  const octx = trades.filter(t => t.broker === 'octx' || t.broker === 'fxpro');
  const mn = computeMetrics(nkis);
  const mo = computeMetrics(octx);
  y = drawTable(d, y,
    [
      { label: 'Cuenta', width: 20 },
      { label: 'Trades', width: 18, align: 'right' },
      { label: 'P&L', width: 26, align: 'right' },
      { label: 'Win Rate', width: 22, align: 'right' },
      { label: 'PF', width: 18, align: 'right' },
    ],
    [
      [
        { text: 'NK' },
        { text: String(nkis.length) },
        { text: formatEur(mn.totalPnl), color: mn.totalPnl >= 0 ? GREEN : RED },
        { text: `${mn.winRate.toFixed(1)}%` },
        { text: mn.profitFactor === Infinity ? '∞' : mn.profitFactor.toFixed(2) },
      ],
      [
        { text: 'OX' },
        { text: String(octx.length) },
        { text: formatEur(mo.totalPnl), color: mo.totalPnl >= 0 ? GREEN : RED },
        { text: `${mo.winRate.toFixed(1)}%` },
        { text: mo.profitFactor === Infinity ? '∞' : mo.profitFactor.toFixed(2) },
      ],
    ],
  );

  if (selfAssessment.trim()) {
    y = sectionTitle(d, y, 'Autoevaluación');
    y = ensureSpace(d, y, 30);
    d.doc.setDrawColor(...BORDER);
    d.doc.setFillColor(252, 252, 254);
    const lines = d.doc.splitTextToSize(selfAssessment, d.contentWidth - 6);
    const boxH = Math.max(24, lines.length * 4.6 + 4);
    d.doc.roundedRect(d.margin, y, d.contentWidth, boxH, 1, 1, 'FD');
    d.doc.setTextColor(...TEXT);
    d.doc.setFont('helvetica', 'normal');
    d.doc.setFontSize(9.5);
    d.doc.text(lines, d.margin + 3, y + 5);
  }

  drawFooter(d);
  const filename = `Informe_Mensual_${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}.pdf`;
  d.doc.save(filename);
}

// =====================================================================
// 3) PERFORMANCE REPORT (all-time)
// =====================================================================
export interface PerformanceArgs {
  trades: Trade[];          // all closed trades, sorted by entryDate asc
  startingBalance: number;
  vixCautionThreshold: number;
}

export function exportPerformanceReport({ trades, startingBalance, vixCautionThreshold }: PerformanceArgs) {
  const d = newDoc('Informe de Performance · DARWIN NKIS');
  const m = computeMetrics(trades);
  const dd = maxDrawdown(trades);
  const compliance = complianceRate(trades);
  const pnlColor: [number, number, number] = m.totalPnl >= 0 ? GREEN : RED;

  const firstDate = trades.length > 0 ? new Date(trades[0].entryDate).toLocaleDateString('es-ES') : '—';
  const lastDate = trades.length > 0 ? new Date(trades[trades.length - 1].exitDate ?? trades[trades.length - 1].entryDate).toLocaleDateString('es-ES') : '—';

  let y = drawHeader(d, {
    title: 'Performance Acumulada',
    meta: `${firstDate} — ${lastDate}`,
    right: formatEur(m.totalPnl),
    rightColor: pnlColor,
  });

  const sharpeP = sharpeRatio(trades, startingBalance);
  const recoveryP = recoveryFactor(trades);
  const rTotalP = totalR(trades);

  y = sectionTitle(d, y, 'Métricas Globales');
  y = drawStatGrid(d, y, [
    { label: 'P&L Total', value: formatEur(m.totalPnl), color: pnlColor },
    { label: 'Trades', value: String(trades.length) },
    { label: 'Win Rate', value: `${m.winRate.toFixed(1)}%` },
    { label: 'Profit Factor', value: m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2) },
    { label: 'Avg Win', value: formatEur(m.avgWin), color: GREEN },
    { label: 'Avg Loss', value: formatEur(m.avgLoss), color: RED },
    { label: 'Expectancy', value: formatEur(m.expectancy) },
    { label: 'Drawdown máx.', value: formatEur(-dd), color: RED },
    { label: 'Cumplimiento', value: `${compliance.toFixed(0)}%` },
    { label: 'Ganadores', value: String(m.wins), color: GREEN },
    { label: 'Perdedores', value: String(m.losses), color: RED },
    { label: 'Bal. inicial', value: `€${startingBalance.toFixed(0)}` },
    { label: 'Ratio Sharpe', value: sharpeP.toFixed(2), color: sharpeP >= 1 ? GREEN : sharpeP >= 0 ? NAVY : RED },
    { label: 'Recovery Factor', value: recoveryP === Infinity ? '∞' : recoveryP.toFixed(2), color: recoveryP >= 3 ? GREEN : recoveryP >= 1 ? NAVY : RED },
    { label: 'R Total', value: `${rTotalP.total >= 0 ? '+' : ''}${rTotalP.total.toFixed(2)}R`, color: rTotalP.total >= 0 ? GREEN : RED },
    { label: 'Trades con R', value: String(rTotalP.count) },
  ]);

  y = sectionTitle(d, y, 'Curva de Equity Completa');
  const points = buildEquityCurve(trades, startingBalance);
  y = drawEquityChart(d, y, points, 90, trades);

  // By instrument
  y = sectionTitle(d, y, 'Análisis por Instrumento');
  const bySymbol: Record<string, Trade[]> = {};
  trades.forEach(t => { (bySymbol[t.symbol] ??= []).push(t); });
  const symbolRows = Object.entries(bySymbol)
    .map(([sym, ts]) => {
      const mm = computeMetrics(ts);
      return { sym, count: ts.length, pnl: mm.totalPnl, wr: mm.winRate, pf: mm.profitFactor };
    })
    .sort((a, b) => b.pnl - a.pnl);

  if (symbolRows.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFontSize(10); d.doc.setFont('helvetica', 'italic');
    d.doc.text('Sin datos.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Símbolo', width: 22 },
        { label: 'Trades', width: 16, align: 'right' },
        { label: 'P&L', width: 26, align: 'right' },
        { label: 'Win Rate', width: 20, align: 'right' },
        { label: 'PF', width: 16, align: 'right' },
      ],
      symbolRows.map(r => [
        { text: r.sym },
        { text: String(r.count) },
        { text: formatEur(r.pnl), color: r.pnl >= 0 ? GREEN : RED },
        { text: `${r.wr.toFixed(1)}%` },
        { text: r.pf === Infinity ? '∞' : r.pf.toFixed(2) },
      ]),
    );
  }

  // By VIX condition
  y = sectionTitle(d, y, 'Análisis por Condición de VIX');
  const buckets: Array<{ label: string; range: [number, number]; trades: Trade[] }> = [
    { label: 'VIX < 15 — Tranquilo', range: [-Infinity, 15], trades: [] },
    { label: 'VIX 15–20 — Normal', range: [15, 20], trades: [] },
    { label: 'VIX 20–25 — Elevado', range: [20, 25], trades: [] },
    { label: `VIX 25–${vixCautionThreshold} — Tenso`, range: [25, vixCautionThreshold], trades: [] },
    { label: `VIX ≥ ${vixCautionThreshold} — Bloqueo`, range: [vixCautionThreshold, Infinity], trades: [] },
    { label: 'Sin VIX registrado', range: [NaN, NaN], trades: [] },
  ];
  for (const t of trades) {
    if (t.vixAtEntry == null) { buckets[5].trades.push(t); continue; }
    const v = t.vixAtEntry;
    for (let i = 0; i < 5; i++) {
      if (v >= buckets[i].range[0] && v < buckets[i].range[1]) { buckets[i].trades.push(t); break; }
    }
  }
  // Show all VIX buckets that have trades, plus ALWAYS show "Sin VIX registrado"
  // even if empty — so the user can see whether they have unlogged VIX trades.
  const vixRowsToShow = buckets.filter((b, i) => i === 5 || b.trades.length > 0);
  y = drawTable(d, y,
    [
      { label: 'Régimen VIX', width: 40 },
      { label: 'Trades', width: 16, align: 'right' },
      { label: 'P&L', width: 26, align: 'right' },
      { label: 'Win Rate', width: 20, align: 'right' },
    ],
    vixRowsToShow.map(b => {
      const mm = computeMetrics(b.trades);
      const muted: [number, number, number] = TEXT_MUTED;
      const pnlColor: [number, number, number] = b.trades.length === 0 ? muted : (mm.totalPnl >= 0 ? GREEN : RED);
      return [
        { text: b.label, color: b.trades.length === 0 ? muted : TEXT },
        { text: String(b.trades.length), color: b.trades.length === 0 ? muted : TEXT },
        { text: b.trades.length === 0 ? '—' : formatEur(mm.totalPnl), color: pnlColor },
        { text: b.trades.length === 0 ? '—' : `${mm.winRate.toFixed(1)}%`, color: b.trades.length === 0 ? muted : TEXT },
      ];
    }),
  );

  // By month — group by exit date (close date), use a stable YYYY-MM key so
  // count + P&L stay in sync regardless of locale formatting.
  y = sectionTitle(d, y, 'Análisis por Mes');
  const byMonthKey: Record<string, { trades: Trade[]; label: string; sortKey: string }> = {};
  for (const t of trades) {
    const dt = new Date(t.exitDate ?? t.entryDate);
    if (Number.isNaN(dt.getTime())) continue;
    const sortKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const monthShort = dt.toLocaleString('es-ES', { month: 'short' });
    const label = `${monthShort.charAt(0).toUpperCase()}${monthShort.slice(1)} ${dt.getFullYear()}`;
    if (!byMonthKey[sortKey]) byMonthKey[sortKey] = { trades: [], label, sortKey };
    byMonthKey[sortKey].trades.push(t);
  }
  const monthRows = Object.values(byMonthKey).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  if (monthRows.length === 0) {
    d.doc.setTextColor(...TEXT_MUTED); d.doc.setFontSize(10); d.doc.setFont('helvetica', 'italic');
    d.doc.text('Sin datos.', d.margin, y + 4); y += 10;
  } else {
    y = drawTable(d, y,
      [
        { label: 'Mes', width: 22 },
        { label: 'Trades', width: 16, align: 'right' },
        { label: 'P&L', width: 26, align: 'right' },
        { label: 'Win Rate', width: 20, align: 'right' },
      ],
      monthRows.map(r => {
        const mm = computeMetrics(r.trades);
        return [
          { text: r.label },
          { text: String(r.trades.length) },
          { text: formatEur(mm.totalPnl), color: mm.totalPnl >= 0 ? GREEN : RED },
          { text: `${mm.winRate.toFixed(1)}%` },
        ];
      }),
    );
  }

  drawFooter(d);
  const filename = `Informe_Performance_${new Date().toISOString().slice(0, 10)}.pdf`;
  d.doc.save(filename);
}
