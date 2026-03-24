import { resolveSecurityFull } from './moex-api';
import type { ImportAssetRow } from './import-parser';

const FUND_BOARDS = new Set(['TQTF', 'TQIF', 'TQPI']);

export function mapMoexMarketToType(
  market: 'shares' | 'bonds',
  boardId: string,
): string {
  if (market === 'bonds') return 'Облигации';
  if (FUND_BOARDS.has(boardId)) return 'Фонды';
  return 'Акции';
}

function needsEnrichment(row: ImportAssetRow): boolean {
  if (!row.isin) return false;
  if (row.type === 'Прочее') return true;
  if (!row.ticker) return true;
  if (row.ticker === row.isin) return true;
  if (row.name === row.isin) return true;
  return false;
}

export async function enrichFromMoex(
  rows: ImportAssetRow[],
): Promise<ImportAssetRow[]> {
  const result = rows.map((r) => ({ ...r }));

  for (const row of result) {
    if (!needsEnrichment(row)) continue;

    let info;
    try {
      info = await resolveSecurityFull(row.isin!);
    } catch {
      continue;
    }
    if (!info) continue;

    if (row.type === 'Прочее') {
      row.type = mapMoexMarketToType(info.market, info.primaryBoardId);
    }
    if (!row.ticker || row.ticker === row.isin) {
      row.ticker = info.secid;
    }
    if (row.name === row.isin && info.shortName) {
      row.name = info.shortName;
    }
    if (!row.emitter && info.emitter) {
      row.emitter = info.emitter;
    }
  }

  return result;
}
