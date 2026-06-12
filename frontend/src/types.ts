export interface DcaZone {
  id?: number;
  price_eur: number;
  label: string;
}

export interface Thesis {
  id?: number;
  ticker: string;
  bucket: string;
  case: string;
  right_if: string;
  wrong_if: string;
  max_weight_pct?: number | null;
  check_cadence?: string;
  next_check_date?: string;
  last_checked_value?: string;
  last_checked_date?: string;
  updated_at?: string;
}

export interface TakeProfitRule {
  targetPct: number;
  sharesToSell: number;
  label: string;
}

export interface ExitRules {
  id?: number;
  ticker: string;
  stop_loss_pct: number | null;
  take_profit_rules: TakeProfitRule[];
  thesis_break_condition: string;
  trailing_stop_pct?: number | null;
  updated_at?: string;
}

export interface JournalEntry {
  id?: number;
  ticker: string | null;
  action: string;
  note: string;
  luck_or_skill: 'luck' | 'skill' | 'loss' | null;
  rule_followed: number;
  unplanned: number;
  created_at?: string;
}

export interface Alert {
  ticker: string;
  companyName: string;
  type: 'stop_loss' | 'take_profit';
  message: string;
  priceEur: number;
  triggerPriceEur: number;
}

export interface NewsItem {
  ticker?: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image?: string | null;
}

export interface Position {
  id: number;
  sector_id: number;
  ticker: string;
  company_name: string;
  position_type: 'Core' | 'Speculative' | 'Watchlist';
  shares: number;
  avg_cost_eur: number;
  target_size_eur: number;
  stop_loss_eur: number | null;
  notes: string;
  dca_zones: DcaZone[];
  thesis: Thesis | null;
  exit_rules: ExitRules | null;
  created_at: string;
}

export interface Sector {
  id: number;
  name: string;
  description: string;
  order_index: number;
  positions: Position[];
}

export interface PriceData {
  ticker: string;
  priceUsd: number;
  changePercent: number;
  currency: string;
  timestamp: number;
}

export interface PortfolioData {
  eurUsdRate: number;
  sectors: Sector[];
  prices: Record<string, PriceData>;
}

export interface Trade {
  id: number;
  position_id: number;
  trade_date: string;
  trade_type: 'Buy' | 'Sell';
  shares: number;
  price_eur: number;
  broker_fee_eur: number;
  notes: string;
  created_at: string;
}

export interface PositionFormData {
  ticker: string;
  company_name: string;
  sector_id: number;
  position_type: 'Core' | 'Speculative' | 'Watchlist';
  shares: number;
  avg_cost_eur: number;
  target_size_eur: number;
  stop_loss_eur: number | null;
  notes: string;
  dca_zones: DcaZone[];
}

export interface TradeFormData {
  position_id: number;
  trade_date: string;
  trade_type: 'Buy' | 'Sell';
  shares: number;
  price_eur: number;
  broker_fee_eur: number;
  notes: string;
}
