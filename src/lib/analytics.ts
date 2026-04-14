import type { Trade } from './trade-utils';

const MIN_TRADES = 3;

/* ── Dashboard KPIs ── */

export interface DashboardKpis {
  expectancy: number;
  recoveryFactor: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  avgDurationWinners: number;
  avgDurationLosers: number;
}

export interface AdvancedMetrics {
  // Row 1 — Core
  expectancy: number;
  payoffRatio: number;
  recoveryFactor: number;
  ulcerIndex: number;
  // Row 2 — Risk
  avgMaeWinnersEur: number;
  avgMaeLosersEur: number;
  avgMfeWinnersEur: number;
  avgPnlWinnersEur: number;
  avgRrReal: number;
  avgRrTheoretical: number;
  interventionCost: number;
  // Row 3 — Consistency
  bestMonth: number;
  bestMonthLabel: string;
  worstMonth: number;
  worstMonthLabel: string;
  positiveMonthsPct: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

export function computeDashboardKpis(closed: Trade[], startingBalance: number): DashboardKpis {
  const wins = closed.filter(t => t.isWin);
  const losses = closed.filter(t => !t.isWin);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const lossRate = 1 - winRate;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.netPnl, 0) / losses.length) : 0;
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const totalPnl = grossProfit - grossLoss;

  let peak = startingBalance;
  let maxDD = 0;
  let equity = startingBalance;
  for (const t of closed) {
    equity += t.netPnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  const currentDrawdown = peak - equity;
  const currentDrawdownPct = peak > 0 ? (currentDrawdown / peak) * 100 : 0;
  const recoveryFactor = maxDD > 0 ? totalPnl / maxDD : totalPnl > 0 ? Infinity : 0;

  let maxW = 0, maxL = 0, cw = 0, cl = 0;
  for (const t of closed) {
    if (t.isWin) { cw++; cl = 0; if (cw > maxW) maxW = cw; }
    else { cl++; cw = 0; if (cl > maxL) maxL = cl; }
  }

  const avgDurationWinners = wins.length > 0 ? wins.reduce((s, t) => s + t.durationHours, 0) / wins.length : 0;
  const avgDurationLosers = losses.length > 0 ? losses.reduce((s, t) => s + t.durationHours, 0) / losses.length : 0;

  return {
    expectancy,
    recoveryFactor,
    profitFactor,
    maxConsecutiveWins: maxW,
    maxConsecutiveLosses: maxL,
    currentDrawdown,
    currentDrawdownPct,
    avgDurationWinners,
    avgDurationLosers,
  };
}

export function computeAdvancedMetrics(closed: Trade[], startingBalance: number): AdvancedMetrics {
  const wins = closed.filter(t => t.isWin);
  const losses = closed.filter(t => !t.isWin);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const lossRate = 1 - winRate;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.netPnl, 0) / losses.length) : 0;
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  // Max drawdown & recovery factor
  let peak = startingBalance, maxDD = 0, equity = startingBalance;
  const equities: number[] = [];
  for (const t of closed) {
    equity += t.netPnl;
    equities.push(equity);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  const totalPnl = equity - startingBalance;
  const recoveryFactor = maxDD > 0 ? totalPnl / maxDD : totalPnl > 0 ? Infinity : 0;

  // Ulcer Index — RMS of percentage drawdowns
  let ulcerIndex = 0;
  if (equities.length > 0) {
    let uPeak = startingBalance;
    let sumSq = 0;
    for (const eq of equities) {
      if (eq > uPeak) uPeak = eq;
      const pctDD = uPeak > 0 ? ((uPeak - eq) / uPeak) * 100 : 0;
      sumSq += pctDD * pctDD;
    }
    ulcerIndex = Math.sqrt(sumSq / equities.length);
  }

  // MAE/MFE in euros
  const maeWinEur = wins.filter(t => t.slPrice > 0).map(t => {
    const risk = Math.abs(t.entryPrice - t.slPrice);
    return risk * t.lotSize * 100000 * (t.entryPrice > 10 ? 0.01 : 1); // approximate
  });
  const maeLossEur = losses.filter(t => t.slPrice > 0).map(t => {
    const risk = Math.abs(t.entryPrice - t.slPrice);
    return risk * t.lotSize * 100000 * (t.entryPrice > 10 ? 0.01 : 1);
  });
  // Simpler: use actual P&L as proxy for MAE/MFE in euros
  const avgMaeWinnersEur = wins.length > 0 ? wins.filter(t => t.slPrice > 0).reduce((s, t) => s + Math.abs(t.netPnl * (Math.abs(t.entryPrice - t.slPrice) / Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice || 1))), 0) / wins.filter(t => t.slPrice > 0).length || 0 : 0;
  const avgMaeLosersEur = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.netPnl), 0) / losses.length : 0;
  const avgMfeWinnersEur = wins.length > 0 ? wins.filter(t => t.tpPrice > 0 && t.exitPrice != null).map(t => {
    const tpDist = Math.abs(t.tpPrice - t.entryPrice);
    const actualDist = Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice);
    return tpDist > 0 ? (t.netPnl / actualDist) * tpDist : t.netPnl;
  }).reduce((a, b) => a + b, 0) / wins.filter(t => t.tpPrice > 0).length || 0 : 0;
  const avgPnlWinnersEur = wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0;

  // RR
  const tradesWithRR = closed.filter(t => t.slPrice > 0 && t.tpPrice > 0 && t.exitPrice != null);
  let avgRrReal = 0, avgRrTheoretical = 0;
  if (tradesWithRR.length > 0) {
    avgRrTheoretical = tradesWithRR.reduce((s, t) => {
      const risk = Math.abs(t.entryPrice - t.slPrice);
      return s + (risk > 0 ? Math.abs(t.tpPrice - t.entryPrice) / risk : 0);
    }, 0) / tradesWithRR.length;
    avgRrReal = tradesWithRR.reduce((s, t) => {
      const risk = Math.abs(t.entryPrice - t.slPrice);
      const actual = Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice);
      return s + (risk > 0 ? (t.isWin ? actual / risk : -(actual / risk || 1)) : 0);
    }, 0) / tradesWithRR.length;
  }

  // Intervention cost
  const intervened = closed.filter(t => t.manualIntervention && t.manualIntervention !== 'None, EA managing' && t.manualIntervention !== 'No EA gestionando solo');
  const interventionCost = intervened.reduce((s, t) => s + t.netPnl, 0);

  // Monthly stats
  const byMonth: Record<string, { pnl: number; label: string }> = {};
  for (const t of closed) {
    const d = new Date(t.exitDate ?? t.entryDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.toLocaleString('es-ES', { month: 'short' })} ${d.getFullYear()}`;
    if (!byMonth[key]) byMonth[key] = { pnl: 0, label };
    byMonth[key].pnl += t.netPnl;
  }
  const months = Object.values(byMonth);
  let bestMonth = 0, worstMonth = 0, bestMonthLabel = '—', worstMonthLabel = '—';
  for (const m of months) {
    if (m.pnl > bestMonth || bestMonthLabel === '—') { bestMonth = m.pnl; bestMonthLabel = m.label; }
    if (m.pnl < worstMonth || worstMonthLabel === '—') { worstMonth = m.pnl; worstMonthLabel = m.label; }
  }
  const positiveMonthsPct = months.length > 0 ? (months.filter(m => m.pnl > 0).length / months.length) * 100 : 0;

  // Streaks
  let maxW = 0, maxL = 0, cw = 0, cl = 0;
  for (const t of closed) {
    if (t.isWin) { cw++; cl = 0; if (cw > maxW) maxW = cw; }
    else { cl++; cw = 0; if (cl > maxL) maxL = cl; }
  }

  return {
    expectancy, payoffRatio, recoveryFactor, ulcerIndex,
    avgMaeWinnersEur, avgMaeLosersEur, avgMfeWinnersEur, avgPnlWinnersEur,
    avgRrReal, avgRrTheoretical, interventionCost,
    bestMonth, bestMonthLabel, worstMonth, worstMonthLabel, positiveMonthsPct,
    maxConsecutiveWins: maxW, maxConsecutiveLosses: maxL,
  };
}

/* ── Pattern Analytics ── */

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

export interface GroupStat {
  name: string;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  count: number;
}

function toGroupStat(name: string, trades: Trade[]): GroupStat {
  return {
    name,
    winRate: trades.length > 0 ? (trades.filter(t => t.isWin).length / trades.length) * 100 : 0,
    avgPnl: trades.length > 0 ? trades.reduce((s, t) => s + t.netPnl, 0) / trades.length : 0,
    totalPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    count: trades.length,
  };
}

export function getPerformanceByAdxState(trades: Trade[]): GroupStat[] {
  const groups = groupBy(trades.filter(t => t.adxState), t => t.adxState);
  return Object.entries(groups)
    .filter(([, g]) => g.length >= MIN_TRADES)
    .map(([name, g]) => toGroupStat(name, g));
}

export function getPerformanceByMA50(trades: Trade[]): GroupStat[] {
  const groups = groupBy(trades.filter(t => t.distanceToMA50Label), t => t.distanceToMA50Label);
  return Object.entries(groups)
    .filter(([, g]) => g.length >= MIN_TRADES)
    .map(([name, g]) => toGroupStat(name, g));
}

export function getPerformanceByMomentum(trades: Trade[]): GroupStat[] {
  const aligned = trades.filter(t => t.momentumAligned);
  const notAligned = trades.filter(t => !t.momentumAligned);
  const result: GroupStat[] = [];
  if (aligned.length >= MIN_TRADES) result.push(toGroupStat('Alineado', aligned));
  if (notAligned.length >= MIN_TRADES) result.push(toGroupStat('No Alineado', notAligned));
  return result;
}

export interface BrokerStat {
  name: string;
  winRate: number;
  profitFactor: number;
  avgPnl: number;
  totalPnl: number;
  count: number;
}

export function getPerformanceByBroker(trades: Trade[]): BrokerStat[] {
  const groups = groupBy(trades, t => t.broker);
  return Object.entries(groups).map(([name, g]) => {
    const wins = g.filter(t => t.isWin);
    const losses = g.filter(t => !t.isWin);
    const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
    return {
      name,
      winRate: g.length > 0 ? (wins.length / g.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      avgPnl: g.length > 0 ? g.reduce((s, t) => s + t.netPnl, 0) / g.length : 0,
      totalPnl: g.reduce((s, t) => s + t.netPnl, 0),
      count: g.length,
    };
  });
}

export interface InterventionStat {
  type: string;
  count: number;
  totalPnl: number;
}

export function getInterventionCosts(trades: Trade[]): { total: number; byType: InterventionStat[]; totalCount: number } {
  const intervened = trades.filter(t => t.manualIntervention && t.manualIntervention !== 'None, EA managing');
  const groups = groupBy(intervened, t => t.manualIntervention!);
  return {
    total: intervened.reduce((s, t) => s + t.netPnl, 0),
    totalCount: intervened.length,
    byType: Object.entries(groups).map(([type, g]) => ({
      type,
      count: g.length,
      totalPnl: g.reduce((s, t) => s + t.netPnl, 0),
    })),
  };
}

export interface HeatmapCell {
  emotion: string;
  compliance: string;
  avgPnl: number;
  count: number;
}

export function getEmotionalPerformanceMatrix(trades: Trade[]): HeatmapCell[] {
  const filtered = trades.filter(t => t.emotionalState && t.systemCompliance);
  const groups = groupBy(filtered, t => `${t.emotionalState}|${t.systemCompliance}`);
  return Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([key, g]) => {
      const [emotion, compliance] = key.split('|');
      return {
        emotion,
        compliance,
        avgPnl: g.reduce((s, t) => s + t.netPnl, 0) / g.length,
        count: g.length,
      };
    });
}

export function getMonthlyConsistencyScore(trades: Trade[]): { score: number; compliantMonths: number; totalMonths: number } {
  const byMonth = groupBy(trades.filter(t => t.systemCompliance), t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  let compliant = 0;
  const months = Object.values(byMonth);
  for (const monthTrades of months) {
    if (monthTrades.every(t => t.systemCompliance === '100%')) compliant++;
  }
  return {
    score: months.length > 0 ? (compliant / months.length) * 100 : 0,
    compliantMonths: compliant,
    totalMonths: months.length,
  };
}

/* ── MAE / MFE ── */

export interface MaeMfeStats {
  avgMaeWinners: number;
  avgMaeLosers: number;
  avgMfeWinners: number;
  avgMfeLosers: number;
  avgMfeCapturedPct: number;
}

export function computeMaeMfe(trades: Trade[]): MaeMfeStats {
  const wins = trades.filter(t => t.isWin && t.slPrice > 0 && t.tpPrice > 0 && t.exitPrice != null);
  const losses = trades.filter(t => !t.isWin && t.slPrice > 0 && t.exitPrice != null);

  const maeWin = wins.map(t => Math.abs(t.entryPrice - t.slPrice) / t.entryPrice * 100);
  const maeLoss = losses.map(t => Math.abs(t.entryPrice - t.slPrice) / t.entryPrice * 100);

  const mfeWin = wins.map(t => Math.abs(t.tpPrice - t.entryPrice) / t.entryPrice * 100);
  const mfeLoss = losses.map(t => t.tpPrice > 0 ? Math.abs(t.tpPrice - t.entryPrice) / t.entryPrice * 100 : 0);

  const mfeCaptured = wins.map(t => {
    const tpDist = Math.abs(t.tpPrice - t.entryPrice);
    const actualDist = Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice);
    return tpDist > 0 ? (actualDist / tpDist) * 100 : 100;
  });

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    avgMaeWinners: avg(maeWin),
    avgMaeLosers: avg(maeLoss),
    avgMfeWinners: avg(mfeWin),
    avgMfeLosers: avg(mfeLoss),
    avgMfeCapturedPct: avg(mfeCaptured),
  };
}

/* ── RR Analysis ── */
export interface RrPoint {
  ticket: number;
  symbol: string;
  theoreticalRR: number;
  actualRR: number;
  isWin: boolean;
}

export function computeRrData(trades: Trade[]): RrPoint[] {
  return trades
    .filter(t => t.slPrice > 0 && t.tpPrice > 0 && t.exitPrice != null)
    .map(t => {
      const risk = Math.abs(t.entryPrice - t.slPrice);
      const theoreticalReward = Math.abs(t.tpPrice - t.entryPrice);
      const actualReward = Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice);
      const theoreticalRR = risk > 0 ? theoreticalReward / risk : 0;
      const actualRR = risk > 0 ? (t.isWin ? actualReward / risk : -(actualReward / risk || 1)) : 0;
      return { ticket: t.ticket, symbol: t.symbol, theoreticalRR, actualRR, isWin: t.isWin };
    });
}

/* ── Enhanced Insights ── */

export interface Insight {
  text: string;
  type: 'positive' | 'warning' | 'negative';
  impact: number;
}

export function generateEnhancedInsights(trades: Trade[], startingBalance: number): Insight[] {
  const insights: Insight[] = [];
  if (trades.length < MIN_TRADES) return insights;

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);

  // ADX state comparison
  const adxStates = getPerformanceByAdxState(trades);
  const accel = adxStates.find(s => s.name === 'ACELERANDO');
  const exhaust = adxStates.find(s => s.name === 'AGOTANDO');
  if (accel && exhaust) {
    insights.push({
      text: `Tu Win Rate con ADX ACELERANDO es ${accel.winRate.toFixed(0)}% vs ${exhaust.winRate.toFixed(0)}% con AGOTANDO. Impacto financiero: ${accel.avgPnl >= 0 ? '+' : ''}€${accel.totalPnl.toFixed(0)} vs €${exhaust.totalPnl.toFixed(0)}.`,
      type: accel.winRate > exhaust.winRate ? 'positive' : 'warning',
      impact: Math.abs(accel.totalPnl - exhaust.totalPnl),
    });
  }

  // Emotional cost
  const byEmotion = groupBy(trades.filter(t => t.emotionalState), t => t.emotionalState!);
  const anxious = byEmotion['Anxious'];
  if (anxious && anxious.length >= MIN_TRADES) {
    const cost = anxious.reduce((s, t) => s + t.netPnl, 0);
    if (cost < 0) {
      insights.push({
        text: `Operar con ansiedad te ha costado €${Math.abs(cost).toFixed(0)} en pérdidas realizadas en ${anxious.length} trades.`,
        type: 'negative',
        impact: Math.abs(cost),
      });
    }
  }

  // MFE capture
  const maeMfe = computeMaeMfe(trades);
  if (wins.length >= MIN_TRADES && maeMfe.avgMfeCapturedPct < 80) {
    insights.push({
      text: `Solo capturas el ${maeMfe.avgMfeCapturedPct.toFixed(0)}% del MFE — considera ajustar la colocación del TP para capturar más del movimiento.`,
      type: 'warning',
      impact: 100 - maeMfe.avgMfeCapturedPct,
    });
  }

  // MAE SL placement
  if (losses.length >= MIN_TRADES && wins.length >= MIN_TRADES) {
    const slCorrect = maeMfe.avgMaeLosers <= maeMfe.avgMaeWinners * 1.3;
    insights.push({
      text: `Tu MAE en trades perdedores (${maeMfe.avgMaeLosers.toFixed(2)}%) ${slCorrect ? 'es consistente con los ganadores — el SL parece bien colocado' : `excede a los ganadores (${maeMfe.avgMaeWinners.toFixed(2)}%) — el SL puede estar demasiado amplio en perdedores`}.`,
      type: slCorrect ? 'positive' : 'warning',
      impact: Math.abs(maeMfe.avgMaeLosers - maeMfe.avgMaeWinners) * 10,
    });
  }

  // System compliance impact
  const byCompliance = groupBy(trades.filter(t => t.systemCompliance), t => t.systemCompliance!);
  const full = byCompliance['100%'];
  const partial = Object.entries(byCompliance).filter(([k]) => k !== '100%').flatMap(([, g]) => g);
  if (full && full.length >= MIN_TRADES && partial.length >= MIN_TRADES) {
    const fullPnl = full.reduce((s, t) => s + t.netPnl, 0) / full.length;
    const partialPnl = partial.reduce((s, t) => s + t.netPnl, 0) / partial.length;
    if (fullPnl > partialPnl) {
      const pctDiff = partialPnl !== 0 ? ((fullPnl - partialPnl) / Math.abs(partialPnl)) * 100 : 100;
      insights.push({
        text: `Seguir el sistema al 100% mejora el P&L un ${pctDiff.toFixed(0)}% vs cumplimiento parcial (€${fullPnl.toFixed(0)} media vs €${partialPnl.toFixed(0)} media por trade).`,
        type: 'positive',
        impact: Math.abs(fullPnl - partialPnl) * full.length,
      });
    }
  }

  // Momentum alignment
  const momentum = getPerformanceByMomentum(trades);
  const aligned = momentum.find(m => m.name === 'Alineado');
  const notAligned = momentum.find(m => m.name === 'No Alineado');
  if (aligned && notAligned) {
    insights.push({
      text: `Los trades con momentum alineado ganan ${aligned.winRate.toFixed(0)}% vs ${notAligned.winRate.toFixed(0)}% cuando no está alineado. Impacto: €${aligned.totalPnl.toFixed(0)} vs €${notAligned.totalPnl.toFixed(0)}.`,
      type: aligned.winRate > notAligned.winRate ? 'positive' : 'warning',
      impact: Math.abs(aligned.totalPnl - notAligned.totalPnl),
    });
  }

  // Intervention cost
  const interventions = getInterventionCosts(trades);
  if (interventions.totalCount >= 2) {
    insights.push({
      text: `Las intervenciones manuales en ${interventions.totalCount} trades resultaron en un impacto neto de €${interventions.total.toFixed(0)}.`,
      type: interventions.total < 0 ? 'negative' : 'warning',
      impact: Math.abs(interventions.total),
    });
  }

  return insights.sort((a, b) => b.impact - a.impact);
}
