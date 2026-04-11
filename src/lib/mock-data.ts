export type AdxState = 'ACCELERATING' | 'RISING' | 'STABLE' | 'FADING';
export type DistanceLabel = 'VERY CLOSE' | 'CLOSE' | 'EXTENDED' | 'OVEREXTENDED';
export type EmotionalState = 'Calm' | 'Anxious' | 'Euphoric' | 'Tired' | 'Under pressure';
export type EntryReason = 'Scanner + stochastic signal' | 'Scanner only' | 'Stochastic only' | 'Intuition' | 'Other';
export type SystemCompliance = '100%' | 'Almost' | 'Partial' | 'No';
export type SetupDoubts = 'None, clear' | 'Yes but entering anyway' | 'Yes, serious doubts';
export type ManagingWait = 'Calm, not watching' | 'Watching a lot' | 'Desperate to close' | 'Fine';
export type ManualIntervention = 'None, EA managing' | 'Moved SL' | 'Closed early' | 'Added position';
export type HowClosed = 'TP hit' | 'SL hit' | 'Breakeven' | 'Closed manually';
export type FeelingResult = 'Good, correct process' | 'Good despite loss' | 'Bad despite win' | 'Bad, broke system';
export type WhatDoDifferently = 'Nothing' | 'Enter earlier' | 'Wait more confirmation' | 'Not have entered' | 'Let TP run more';

export interface Trade {
  id: string;
  ticket: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  slPrice: number;
  tpPrice: number;
  lotSize: number;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  durationHours: number;
  magicNumber: number;
  eaComment: string;
  adxValue: number;
  adxState: AdxState;
  distanceToMA50: number;
  distanceToMA50Label: DistanceLabel;
  momentum20d: number;
  momentumAligned: boolean;
  stochasticK: number;
  scannerRank: number | null;
  vixAtEntry: number | null;
  emotionalState: EmotionalState | null;
  reasonForEntry: EntryReason | null;
  systemCompliance: SystemCompliance | null;
  setupDoubts: SetupDoubts | null;
  preTradeNotes: string | null;
  managingWait: ManagingWait | null;
  manualIntervention: ManualIntervention | null;
  duringTradeNotes: string | null;
  howClosed: HowClosed | null;
  feelingResult: FeelingResult | null;
  whatDoDifferently: WhatDoDifferently | null;
  postTradeNotes: string | null;
  status: 'open' | 'closed';
  isWin: boolean;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface MonthlyPnl {
  month: string;
  pnl: number;
}

export const closedTrades: Trade[] = [
  {
    id: 't1', ticket: 100001, symbol: 'EURUSD', direction: 'BUY',
    entryDate: '2026-01-06T08:30:00', exitDate: '2026-01-09T14:20:00',
    entryPrice: 1.0285, exitPrice: 1.0342, slPrice: 1.0241, tpPrice: 1.0355,
    lotSize: 0.50, grossPnl: 285, commission: -7, swap: -3.2, netPnl: 274.8,
    durationHours: 78, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 38.2, adxState: 'ACCELERATING', distanceToMA50: 0.8, distanceToMA50Label: 'CLOSE',
    momentum20d: 2.1, momentumAligned: true, stochasticK: 28.4, scannerRank: 2, vixAtEntry: 18.5,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Strong trend on scanner, ADX accelerating. Clean setup.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Perfect execution. System worked as designed.',
    status: 'closed', isWin: true
  },
  {
    id: 't2', ticket: 100002, symbol: 'GBPUSD', direction: 'SELL',
    entryDate: '2026-01-10T09:00:00', exitDate: '2026-01-11T16:45:00',
    entryPrice: 1.2156, exitPrice: 1.2198, slPrice: 1.2198, tpPrice: 1.2065,
    lotSize: 0.40, grossPnl: -168, commission: -6.4, swap: -1.8, netPnl: -176.2,
    durationHours: 32, magicNumber: 101, eaComment: 'S1_STOCH_SELL',
    adxValue: 29.1, adxState: 'RISING', distanceToMA50: 1.2, distanceToMA50Label: 'CLOSE',
    momentum20d: -1.4, momentumAligned: true, stochasticK: 72.1, scannerRank: 5, vixAtEntry: 21.3,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Scanner ranked GBP well. ADX rising.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'SL hit', feelingResult: 'Good despite loss',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Loss but followed system. No regrets.',
    status: 'closed', isWin: false
  },
  {
    id: 't3', ticket: 100003, symbol: 'XAUUSD', direction: 'BUY',
    entryDate: '2026-01-14T10:15:00', exitDate: '2026-01-20T11:30:00',
    entryPrice: 2652.40, exitPrice: 2698.80, slPrice: 2628.50, tpPrice: 2705.00,
    lotSize: 0.10, grossPnl: 464, commission: -12, swap: -8.5, netPnl: 443.5,
    durationHours: 145, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 42.7, adxState: 'ACCELERATING', distanceToMA50: 1.5, distanceToMA50Label: 'CLOSE',
    momentum20d: 3.8, momentumAligned: true, stochasticK: 24.6, scannerRank: 1, vixAtEntry: 16.8,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Gold #1 on scanner. Monster ADX.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: 'Price pulled back slightly on day 3 but held above MA50.',
    howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Textbook trade. Strong trend, clean entry, EA did its job.',
    status: 'closed', isWin: true
  },
  {
    id: 't4', ticket: 100004, symbol: 'USDJPY', direction: 'BUY',
    entryDate: '2026-01-21T07:45:00', exitDate: '2026-01-22T15:00:00',
    entryPrice: 156.82, exitPrice: 156.45, slPrice: 155.90, tpPrice: 158.20,
    lotSize: 0.30, grossPnl: -70.5, commission: -4.5, swap: 2.1, netPnl: -72.9,
    durationHours: 31, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 26.3, adxState: 'STABLE', distanceToMA50: 2.8, distanceToMA50Label: 'EXTENDED',
    momentum20d: 0.9, momentumAligned: true, stochasticK: 31.2, scannerRank: 7, vixAtEntry: 23.1,
    emotionalState: 'Anxious', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: 'Almost',
    setupDoubts: 'Yes but entering anyway', preTradeNotes: 'Scanner rank is low. ADX just stable, not rising. Entering anyway.',
    managingWait: 'Watching a lot', manualIntervention: 'None, EA managing',
    duringTradeNotes: 'Kept checking the chart. Nervous about the weak ADX.',
    howClosed: 'SL hit', feelingResult: 'Bad, broke system',
    whatDoDifferently: 'Wait more confirmation', postTradeNotes: 'Should have trusted the low scanner rank. ADX was flat.',
    status: 'closed', isWin: false
  },
  {
    id: 't5', ticket: 100005, symbol: 'US500', direction: 'BUY',
    entryDate: '2026-01-27T14:30:00', exitDate: '2026-02-03T10:00:00',
    entryPrice: 5985.50, exitPrice: 6048.20, slPrice: 5942.00, tpPrice: 6055.00,
    lotSize: 0.20, grossPnl: 1254, commission: -18, swap: -12.4, netPnl: 1223.6,
    durationHours: 163, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 35.8, adxState: 'RISING', distanceToMA50: 0.6, distanceToMA50Label: 'VERY CLOSE',
    momentum20d: 1.8, momentumAligned: true, stochasticK: 26.8, scannerRank: 1, vixAtEntry: 15.2,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'SP500 top of scanner. Clean stochastic signal below 30.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Beautiful trade. Patience paid off.',
    status: 'closed', isWin: true
  },
  {
    id: 't6', ticket: 100006, symbol: 'GER40', direction: 'BUY',
    entryDate: '2026-02-04T08:00:00', exitDate: '2026-02-05T16:30:00',
    entryPrice: 21250, exitPrice: 21185, slPrice: 21120, tpPrice: 21450,
    lotSize: 0.10, grossPnl: -65, commission: -8, swap: -2.1, netPnl: -75.1,
    durationHours: 32, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 22.1, adxState: 'FADING', distanceToMA50: 3.2, distanceToMA50Label: 'EXTENDED',
    momentum20d: 0.4, momentumAligned: false, stochasticK: 33.5, scannerRank: 9, vixAtEntry: 28.4,
    emotionalState: 'Euphoric', reasonForEntry: 'Intuition', systemCompliance: 'Partial',
    setupDoubts: 'Yes, serious doubts', preTradeNotes: 'Feeling lucky after recent wins. Entered despite weak signals.',
    managingWait: 'Desperate to close', manualIntervention: 'None, EA managing',
    duringTradeNotes: 'Regretting this entry. ADX fading, momentum not aligned.',
    howClosed: 'SL hit', feelingResult: 'Bad, broke system',
    whatDoDifferently: 'Not have entered', postTradeNotes: 'Classic overconfidence after winning streak. Must stick to scanner ranks.',
    status: 'closed', isWin: false
  },
  {
    id: 't7', ticket: 100007, symbol: 'AUDUSD', direction: 'SELL',
    entryDate: '2026-02-10T09:30:00', exitDate: '2026-02-14T11:00:00',
    entryPrice: 0.6285, exitPrice: 0.6218, slPrice: 0.6328, tpPrice: 0.6210,
    lotSize: 0.60, grossPnl: 402, commission: -9.6, swap: -4.8, netPnl: 387.6,
    durationHours: 97, magicNumber: 101, eaComment: 'S1_STOCH_SELL',
    adxValue: 36.4, adxState: 'ACCELERATING', distanceToMA50: 1.1, distanceToMA50Label: 'CLOSE',
    momentum20d: -2.6, momentumAligned: true, stochasticK: 74.2, scannerRank: 2, vixAtEntry: 19.7,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'AUD bearish trend strong. Scanner confirms.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: null,
    status: 'closed', isWin: true
  },
  {
    id: 't8', ticket: 100008, symbol: 'USDCAD', direction: 'BUY',
    entryDate: '2026-02-17T08:15:00', exitDate: '2026-02-18T09:45:00',
    entryPrice: 1.4385, exitPrice: 1.4352, slPrice: 1.4340, tpPrice: 1.4460,
    lotSize: 0.35, grossPnl: -80.5, commission: -5.6, swap: 1.2, netPnl: -84.9,
    durationHours: 25, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 31.2, adxState: 'RISING', distanceToMA50: 0.9, distanceToMA50Label: 'CLOSE',
    momentum20d: 1.2, momentumAligned: true, stochasticK: 29.8, scannerRank: 4, vixAtEntry: 20.1,
    emotionalState: 'Tired', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Late night session. Setup looks valid though.',
    managingWait: 'Fine', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'SL hit', feelingResult: 'Good despite loss',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Valid setup, just didnt work. Part of the game.',
    status: 'closed', isWin: false
  },
  {
    id: 't9', ticket: 100009, symbol: 'EURUSD', direction: 'BUY',
    entryDate: '2026-02-24T10:00:00', exitDate: '2026-02-28T14:00:00',
    entryPrice: 1.0410, exitPrice: 1.0478, slPrice: 1.0368, tpPrice: 1.0485,
    lotSize: 0.45, grossPnl: 306, commission: -7.2, swap: -5.4, netPnl: 293.4,
    durationHours: 100, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 40.1, adxState: 'ACCELERATING', distanceToMA50: 0.5, distanceToMA50Label: 'VERY CLOSE',
    momentum20d: 2.8, momentumAligned: true, stochasticK: 22.1, scannerRank: 1, vixAtEntry: 14.6,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'EUR back to #1 on scanner. Very strong setup.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Consistent execution pays.',
    status: 'closed', isWin: true
  },
  {
    id: 't10', ticket: 100010, symbol: 'XAUUSD', direction: 'BUY',
    entryDate: '2026-03-03T09:00:00', exitDate: '2026-03-05T12:00:00',
    entryPrice: 2720.50, exitPrice: 2710.20, slPrice: 2695.00, tpPrice: 2765.00,
    lotSize: 0.08, grossPnl: -82.4, commission: -9.6, swap: -5.2, netPnl: -97.2,
    durationHours: 51, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 28.5, adxState: 'STABLE', distanceToMA50: 2.1, distanceToMA50Label: 'EXTENDED',
    momentum20d: 1.1, momentumAligned: true, stochasticK: 30.5, scannerRank: 4, vixAtEntry: 22.8,
    emotionalState: 'Anxious', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'Yes but entering anyway', preTradeNotes: 'Gold looking extended but scanner still shows trend. Slight doubt.',
    managingWait: 'Watching a lot', manualIntervention: 'Moved SL',
    duringTradeNotes: 'Moved SL tighter because I was nervous. Bad decision.',
    howClosed: 'SL hit', feelingResult: 'Bad, broke system',
    whatDoDifferently: 'Not have entered', postTradeNotes: 'SL would have held if I hadnt moved it. Lost because of intervention.',
    status: 'closed', isWin: false
  },
  {
    id: 't11', ticket: 100011, symbol: 'US500', direction: 'BUY',
    entryDate: '2026-03-06T14:00:00', exitDate: '2026-03-12T10:30:00',
    entryPrice: 6015.00, exitPrice: 6092.50, slPrice: 5968.00, tpPrice: 6098.00,
    lotSize: 0.15, grossPnl: 1162.5, commission: -13.5, swap: -9.8, netPnl: 1139.2,
    durationHours: 140, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 37.9, adxState: 'RISING', distanceToMA50: 0.4, distanceToMA50Label: 'VERY CLOSE',
    momentum20d: 2.2, momentumAligned: true, stochasticK: 25.4, scannerRank: 1, vixAtEntry: 16.1,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'SP500 strongest on scanner again. Low VIX.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'SP500 continues to be the best instrument for the system.',
    status: 'closed', isWin: true
  },
  {
    id: 't12', ticket: 100012, symbol: 'GBPUSD', direction: 'BUY',
    entryDate: '2026-03-13T08:30:00', exitDate: '2026-03-14T11:00:00',
    entryPrice: 1.2890, exitPrice: 1.2845, slPrice: 1.2842, tpPrice: 1.2965,
    lotSize: 0.35, grossPnl: -157.5, commission: -5.6, swap: -2.1, netPnl: -165.2,
    durationHours: 26, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 24.8, adxState: 'FADING', distanceToMA50: 1.8, distanceToMA50Label: 'EXTENDED',
    momentum20d: -0.3, momentumAligned: false, stochasticK: 28.9, scannerRank: 8, vixAtEntry: 25.6,
    emotionalState: 'Under pressure', reasonForEntry: 'Stochastic only', systemCompliance: 'Partial',
    setupDoubts: 'Yes, serious doubts', preTradeNotes: 'Forced trade. Wanted to recover losses. Momentum not aligned.',
    managingWait: 'Desperate to close', manualIntervention: 'Closed early',
    duringTradeNotes: 'Should not have entered this. Panic closing.',
    howClosed: 'Closed manually', feelingResult: 'Bad, broke system',
    whatDoDifferently: 'Not have entered', postTradeNotes: 'Revenge trading. Classic mistake. Must wait for scanner confirmation.',
    status: 'closed', isWin: false
  },
  {
    id: 't13', ticket: 100013, symbol: 'AUDUSD', direction: 'SELL',
    entryDate: '2026-03-17T09:00:00', exitDate: '2026-03-21T15:30:00',
    entryPrice: 0.6195, exitPrice: 0.6142, slPrice: 0.6238, tpPrice: 0.6135,
    lotSize: 0.55, grossPnl: 291.5, commission: -8.8, swap: -4.2, netPnl: 278.5,
    durationHours: 102, magicNumber: 101, eaComment: 'S1_STOCH_SELL',
    adxValue: 34.2, adxState: 'RISING', distanceToMA50: 0.9, distanceToMA50Label: 'CLOSE',
    momentum20d: -2.1, momentumAligned: true, stochasticK: 73.8, scannerRank: 3, vixAtEntry: 18.9,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Back to disciplined trading. AUD bearish, scanner confirms.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Discipline restored. Process over outcome.',
    status: 'closed', isWin: true
  },
  {
    id: 't14', ticket: 100014, symbol: 'USOIL', direction: 'SELL',
    entryDate: '2026-03-24T13:00:00', exitDate: '2026-03-26T09:00:00',
    entryPrice: 68.45, exitPrice: 68.90, slPrice: 69.10, tpPrice: 66.80,
    lotSize: 0.50, grossPnl: -225, commission: -10, swap: -3.5, netPnl: -238.5,
    durationHours: 44, magicNumber: 101, eaComment: 'S1_STOCH_SELL',
    adxValue: 27.4, adxState: 'RISING', distanceToMA50: 1.4, distanceToMA50Label: 'CLOSE',
    momentum20d: -1.6, momentumAligned: true, stochasticK: 71.2, scannerRank: 5, vixAtEntry: 20.5,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Oil short. Scanner and stochastic aligned.',
    managingWait: 'Fine', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'SL hit', feelingResult: 'Good despite loss',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Valid setup. Oil reversed on news. Accept and move on.',
    status: 'closed', isWin: false
  },
  {
    id: 't15', ticket: 100015, symbol: 'EURUSD', direction: 'BUY',
    entryDate: '2026-03-31T10:00:00', exitDate: '2026-04-04T14:00:00',
    entryPrice: 1.0520, exitPrice: 1.0598, slPrice: 1.0478, tpPrice: 1.0605,
    lotSize: 0.40, grossPnl: 312, commission: -6.4, swap: -4.8, netPnl: 300.8,
    durationHours: 100, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 41.5, adxState: 'ACCELERATING', distanceToMA50: 0.3, distanceToMA50Label: 'VERY CLOSE',
    momentum20d: 3.2, momentumAligned: true, stochasticK: 21.5, scannerRank: 1, vixAtEntry: 13.8,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'EUR strongest again. Monster ADX above 40.',
    managingWait: 'Calm, not watching', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'TP hit', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Three EUR wins in a row. System is working.',
    status: 'closed', isWin: true
  },
  {
    id: 't16', ticket: 100016, symbol: 'USDJPY', direction: 'BUY',
    entryDate: '2026-04-07T07:30:00', exitDate: '2026-04-08T16:00:00',
    entryPrice: 158.20, exitPrice: 158.05, slPrice: 157.45, tpPrice: 159.50,
    lotSize: 0.25, grossPnl: -23.6, commission: -3.8, swap: 1.5, netPnl: -25.9,
    durationHours: 33, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 30.5, adxState: 'STABLE', distanceToMA50: 1.6, distanceToMA50Label: 'EXTENDED',
    momentum20d: 0.7, momentumAligned: true, stochasticK: 29.1, scannerRank: 6, vixAtEntry: 24.2,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'JPY setup decent. Not top of scanner but valid.',
    managingWait: 'Fine', manualIntervention: 'None, EA managing',
    duringTradeNotes: null, howClosed: 'Breakeven', feelingResult: 'Good, correct process',
    whatDoDifferently: 'Nothing', postTradeNotes: 'Breakeven. EA did its job protecting capital.',
    status: 'closed', isWin: false
  },
];

export const openPositions: Trade[] = [
  {
    id: 'o1', ticket: 100017, symbol: 'XAUUSD', direction: 'BUY',
    entryDate: '2026-04-09T09:00:00', exitDate: null,
    entryPrice: 2745.00, exitPrice: null, slPrice: 2718.00, tpPrice: 2790.00,
    lotSize: 0.10, grossPnl: 185, commission: -9.6, swap: -2.1, netPnl: 173.3,
    durationHours: 48, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 39.2, adxState: 'ACCELERATING', distanceToMA50: 0.7, distanceToMA50Label: 'CLOSE',
    momentum20d: 3.1, momentumAligned: true, stochasticK: 23.8, scannerRank: 1, vixAtEntry: 15.4,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'Gold #1 on scanner. Strong trend.',
    managingWait: null, manualIntervention: null, duringTradeNotes: null,
    howClosed: null, feelingResult: null, whatDoDifferently: null, postTradeNotes: null,
    status: 'open', isWin: false
  },
  {
    id: 'o2', ticket: 100018, symbol: 'US500', direction: 'BUY',
    entryDate: '2026-04-10T14:30:00', exitDate: null,
    entryPrice: 6125.00, exitPrice: null, slPrice: 6078.00, tpPrice: 6195.00,
    lotSize: 0.12, grossPnl: 96, commission: -10.8, swap: -1.2, netPnl: 84,
    durationHours: 22, magicNumber: 101, eaComment: 'S1_STOCH_BUY',
    adxValue: 33.8, adxState: 'RISING', distanceToMA50: 0.5, distanceToMA50Label: 'VERY CLOSE',
    momentum20d: 1.9, momentumAligned: true, stochasticK: 27.4, scannerRank: 2, vixAtEntry: 16.8,
    emotionalState: 'Calm', reasonForEntry: 'Scanner + stochastic signal', systemCompliance: '100%',
    setupDoubts: 'None, clear', preTradeNotes: 'SP500 #2 on scanner. Good conditions.',
    managingWait: null, manualIntervention: null, duringTradeNotes: null,
    howClosed: null, feelingResult: null, whatDoDifferently: null, postTradeNotes: null,
    status: 'open', isWin: false
  },
];

export const equityCurve: EquityPoint[] = [
  { date: '2025-10-01', equity: 10000 }, { date: '2025-10-15', equity: 10180 },
  { date: '2025-11-01', equity: 10350 }, { date: '2025-11-15', equity: 10120 },
  { date: '2025-12-01', equity: 10480 }, { date: '2025-12-15', equity: 10720 },
  { date: '2026-01-01', equity: 10650 }, { date: '2026-01-10', equity: 10925 },
  { date: '2026-01-20', equity: 11368 }, { date: '2026-01-27', equity: 11295 },
  { date: '2026-02-03', equity: 12519 }, { date: '2026-02-10', equity: 12444 },
  { date: '2026-02-14', equity: 12831 }, { date: '2026-02-24', equity: 12746 },
  { date: '2026-02-28', equity: 13040 }, { date: '2026-03-06', equity: 12942 },
  { date: '2026-03-12', equity: 14082 }, { date: '2026-03-17', equity: 13917 },
  { date: '2026-03-21', equity: 14195 }, { date: '2026-03-26', equity: 13957 },
  { date: '2026-03-31', equity: 13880 }, { date: '2026-04-04', equity: 14181 },
  { date: '2026-04-08', equity: 14155 }, { date: '2026-04-11', equity: 14412 },
];

export const monthlyPnl: MonthlyPnl[] = [
  { month: 'May 25', pnl: 320 }, { month: 'Jun 25', pnl: -180 },
  { month: 'Jul 25', pnl: 540 }, { month: 'Aug 25', pnl: 210 },
  { month: 'Sep 25', pnl: -95 }, { month: 'Oct 25', pnl: 480 },
  { month: 'Nov 25', pnl: -230 }, { month: 'Dec 25', pnl: 720 },
  { month: 'Jan 26', pnl: 645 }, { month: 'Feb 26', pnl: 524 },
  { month: 'Mar 26', pnl: 1514 }, { month: 'Apr 26', pnl: 257 },
];

export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getTradeColorStrip(trade: Trade): string {
  if (trade.status === 'open') return 'bg-primary';
  const followedSystem = trade.systemCompliance === '100%' && trade.manualIntervention === 'None, EA managing';
  if (trade.isWin && followedSystem) return 'bg-success';
  if (trade.isWin && !followedSystem) return 'bg-yellow-500';
  if (!trade.isWin && followedSystem) return 'bg-orange-500';
  return 'bg-destructive';
}

// Computed stats
export function computeStats() {
  const all = closedTrades;
  const totalPnl = all.reduce((s, t) => s + t.netPnl, 0) + openPositions.reduce((s, t) => s + t.netPnl, 0);
  const wins = all.filter(t => t.isWin);
  const losses = all.filter(t => !t.isWin);
  const winRate = all.length > 0 ? (wins.length / all.length) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Streak
  let currentStreak = 0;
  let streakType: 'W' | 'L' = 'W';
  for (let i = all.length - 1; i >= 0; i--) {
    if (i === all.length - 1) {
      streakType = all[i].isWin ? 'W' : 'L';
      currentStreak = 1;
    } else if ((streakType === 'W' && all[i].isWin) || (streakType === 'L' && !all[i].isWin)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    totalPnl,
    winRate,
    profitFactor,
    openCount: openPositions.length,
    currentStreak,
    streakType,
    totalTrades: all.length,
    wins: wins.length,
    losses: losses.length,
  };
}
