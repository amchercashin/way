export type DataSource = 'moex' | 'import' | 'manual';

export type AssetType = 'stock' | 'bond' | 'fund' | 'realestate' | 'deposit' | 'other';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Акции',
  bond: 'Облигации',
  fund: 'Фонды',
  realestate: 'Недвижимость',
  deposit: 'Вклады',
  other: 'Прочее',
};

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  stock: '#e9c46a',
  bond: '#7b68ee',
  fund: '#e76f51',
  realestate: '#e94560',
  deposit: '#2a9d8f',
  other: '#888888',
};

export interface Asset {
  id?: number;
  type: AssetType;
  ticker?: string;
  name: string;
  quantity: number;
  averagePrice?: number;
  currentPrice?: number;
  faceValue?: number;
  dataSource: DataSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSchedule {
  id?: number;
  assetId: number;
  frequencyPerYear: number;
  lastPaymentAmount: number;
  lastPaymentDate?: Date;
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
  dataSource: DataSource;
}

export interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: DataSource;
}

export interface ImportRecord {
  id?: number;
  date: Date;
  source: 'sber_xls' | 'sber_html' | 'csv' | 'markdown' | 'ai_import' | 'manual';
  mode: 'update' | 'add';
  itemsChanged: number;
  itemsAdded: number;
  itemsUnchanged: number;
}

export interface PortfolioStats {
  totalIncomePerMonth: number;
  totalIncomePerYear: number;
  totalValue: number;
  yieldPercent: number;
}

export interface CategoryStats extends PortfolioStats {
  type: AssetType;
  assetCount: number;
  portfolioSharePercent: number;
}

export interface AssetStats {
  incomePerMonth: number;
  incomePerYear: number;
  value: number;
  yieldPercent: number;
  portfolioSharePercent: number;
}
