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
  stock: '#c8b48c',
  bond: '#8b7355',
  fund: '#a09080',
  realestate: '#7a6a5a',
  deposit: '#6b8070',
  other: '#5a5548',
};

export interface Asset {
  id?: number;
  type: AssetType;
  ticker?: string;
  isin?: string;
  moexSecid?: string;
  moexBoardId?: string;
  moexMarket?: 'shares' | 'bonds';
  name: string;
  currency?: string;
  emitter?: string;
  securityCategory?: string;
  issueInfo?: string;
  dataSource: DataSource;
  createdAt: Date;
  updatedAt: Date;
  averagePrice?: number;
  currentPrice?: number;
  faceValue?: number;

  // quantity with source tracking
  quantity: number;
  quantitySource: 'import' | 'manual';
  importedQuantity?: number;

  // payment per unit with source tracking
  paymentPerUnit?: number;
  paymentPerUnitSource: 'fact' | 'manual';

  // frequency with source tracking
  frequencyPerYear: number;
  frequencySource: 'moex' | 'manual';
  moexFrequency?: number;

  // transferred from PaymentSchedule
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
}

// PaymentSchedule — DELETED (merged into Asset)

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
