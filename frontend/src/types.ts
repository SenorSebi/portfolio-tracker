export interface DcaZone {
  id?: number;
  price_eur: number;
  label: string;
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
