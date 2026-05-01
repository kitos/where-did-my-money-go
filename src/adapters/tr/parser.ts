import Papa from "papaparse";
import { mccMerchantCategoryId, mccSpendingCategory, mccSpendingCategoryId, type MccSpendingCategory } from "../mcc";
import type { CategoryNode, ParseResult, Transaction } from "../../model/transaction";
import {
  categoryColor,
  counterpartyCategoryId,
  createStaticCategoryMap,
  investmentInstrumentCategoryId,
  TradeRepublicCategory,
  type TradeRepublicCategory as TradeRepublicCategoryId,
} from "./categories";

const CARD_TYPES = new Set(["CARD_TRANSACTION", "CARD_TRANSACTION_INTERNATIONAL"]);
const TRANSFER_TYPES = new Set([
  "TRANSFER_INBOUND",
  "TRANSFER_OUTBOUND",
  "TRANSFER_INSTANT_INBOUND",
  "TRANSFER_INSTANT_OUTBOUND",
]);
const DIRECT_DEBIT_TYPES = new Set(["TRANSFER_DIRECT_DEBIT_INBOUND"]);
const INVESTMENT_BUY_TYPES = new Set(["BUY", "PRIVATE_MARKET_BUY"]);
const INVESTMENT_INCOME_TYPES = new Set(["SELL", "DIVIDEND", "INTEREST_PAYMENT", "BENEFITS_SAVEBACK"]);
const TOP_MERCHANTS_PER_MCC_CATEGORY = 3;
const OTHER_MERCHANTS_LABEL = "Other merchants";

type RawRow = Record<string, string | number | null | undefined>;
type TopMerchantsByMccCategory = Map<MccSpendingCategory, Set<string>>;

function cleanText(value: unknown): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  let text = String(value).replace(/\u00a0/g, " ").trim();
  if (text.endsWith("null")) text = text.slice(0, -4).trim().replace(/[,\s]+$/, "");
  return text;
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(text: string): string {
  const normalized = text.replace(/\s+/g, " ").replace(/^[\s\-*,]+|[\s\-*,]+$/g, "").replace(/\*$/, "");
  return normalized || "Unknown";
}

function assetClassCategoryFor(parentCategory: TradeRepublicCategoryId, row: RawRow): TradeRepublicCategoryId {
  const assetClass = cleanText(row.asset_class);
  const map: Partial<Record<TradeRepublicCategoryId, Record<string, TradeRepublicCategoryId>>> = {
    [TradeRepublicCategory.InvestmentBuy]: {
      CRYPTO: TradeRepublicCategory.InvestmentBuyCrypto,
      FUND: TradeRepublicCategory.InvestmentBuyFunds,
      STOCK: TradeRepublicCategory.InvestmentBuyStocks,
      BOND: TradeRepublicCategory.InvestmentBuyBonds,
      DERIVATIVE: TradeRepublicCategory.InvestmentBuyDerivatives,
    },
    [TradeRepublicCategory.InvestmentIncome]: {
      CRYPTO: TradeRepublicCategory.InvestmentIncomeCrypto,
      FUND: TradeRepublicCategory.InvestmentIncomeFunds,
      STOCK: TradeRepublicCategory.InvestmentIncomeStocks,
      BOND: TradeRepublicCategory.InvestmentIncomeBonds,
      DERIVATIVE: TradeRepublicCategory.InvestmentIncomeDerivatives,
    },
    [TradeRepublicCategory.InvestmentOut]: {
      CRYPTO: TradeRepublicCategory.InvestmentOutCrypto,
      FUND: TradeRepublicCategory.InvestmentOutFunds,
      STOCK: TradeRepublicCategory.InvestmentOutStocks,
      BOND: TradeRepublicCategory.InvestmentOutBonds,
      DERIVATIVE: TradeRepublicCategory.InvestmentOutDerivatives,
    },
  };

  return map[parentCategory]?.[assetClass] || {
    [TradeRepublicCategory.InvestmentBuy]: TradeRepublicCategory.InvestmentBuyOther,
    [TradeRepublicCategory.InvestmentIncome]: TradeRepublicCategory.InvestmentIncomeOther,
    [TradeRepublicCategory.InvestmentOut]: TradeRepublicCategory.InvestmentOutOther,
  }[parentCategory] || TradeRepublicCategory.Unknown;
}

function extractCounterparty(row: RawRow): string {
  const rawType = cleanText(row.type);
  const description = cleanText(row.description);

  if (description && rawType === "TRANSFER_DIRECT_DEBIT_INBOUND") {
    const match = description.match(/Sepa Direct Debit transfer to (.+?) \([A-Z]{2}\d{2}/);
    if (match) return normalizeName(match[1]);
  }

  if (description && TRANSFER_TYPES.has(rawType)) {
    const match = description.match(/(?:Incoming transfer from|Outgoing transfer for) (.+?) \([A-Z]{2}\d{2}/);
    if (match) return normalizeName(match[1]);
  }

  for (const column of ["name", "counterparty_name", "description", "payment_reference"]) {
    let text = cleanText(row[column]);
    if (!text) continue;
    text = text
      .replace(/,\s*exchange rate:.*$/i, "")
      .replace(/\s+\([A-Z]{2}\d{2}.*\)$/, "")
      .replace(/\b[A-Z0-9]{3,}\d[A-Z0-9]*\b/g, "")
      .replace(/\s+qlub,.*$/i, "")
      .trim();
    if (text) return normalizeName(text);
  }

  return rawType || "Unknown";
}

function normalizeType(rawType: string, amount: number): string {
  return categoryForRawType(rawType, amount);
}

function categoryForRawType(rawType: string, amount: number): TradeRepublicCategoryId {
  if (CARD_TYPES.has(rawType)) return amount >= 0 ? TradeRepublicCategory.CardRefund : TradeRepublicCategory.Card;
  if (DIRECT_DEBIT_TYPES.has(rawType)) return TradeRepublicCategory.DirectDebit;
  if (TRANSFER_TYPES.has(rawType)) return amount >= 0 ? TradeRepublicCategory.TransferIn : TradeRepublicCategory.TransferOut;
  if (INVESTMENT_BUY_TYPES.has(rawType)) return TradeRepublicCategory.InvestmentBuy;
  if (INVESTMENT_INCOME_TYPES.has(rawType)) return amount >= 0 ? TradeRepublicCategory.InvestmentIncome : TradeRepublicCategory.InvestmentOut;
  if (rawType === "TAX_OPTIMIZATION") return TradeRepublicCategory.Tax;
  if (rawType === "FREE_RECEIPT") return TradeRepublicCategory.AssetTransfer;
  return TradeRepublicCategory.Unknown;
}

function ensureCounterpartyCategory(categories: Map<string, CategoryNode>, parentCategory: TradeRepublicCategoryId, counterparty: string): string {
  const id = counterpartyCategoryId(parentCategory, counterparty);
  if (!categories.has(id)) {
    categories.set(id, {
      id,
      label: counterparty,
      parentId: parentCategory,
      color: categoryColor(parentCategory),
    });
  }
  return id;
}

function ensureMccMerchantCategory(
  categories: Map<string, CategoryNode>,
  mccCategory: MccSpendingCategory,
  merchantGroup: string,
): string {
  const parentId = TradeRepublicCategory.Card;
  const mccCategoryId = mccSpendingCategoryId(parentId, mccCategory);
  const merchantId = mccMerchantCategoryId(parentId, mccCategory, merchantGroup);
  if (!categories.has(merchantId)) {
    categories.set(merchantId, {
      id: merchantId,
      label: merchantGroup,
      parentId: mccCategoryId,
      color: categoryColor(TradeRepublicCategory.Card),
      expandable: false,
    });
  }

  return merchantId;
}

function ensureInvestmentInstrumentCategory(
  categories: Map<string, CategoryNode>,
  assetClassCategory: TradeRepublicCategoryId,
  instrument: string,
): string {
  const instrumentId = investmentInstrumentCategoryId(assetClassCategory, instrument);

  if (!categories.has(instrumentId)) {
    categories.set(instrumentId, {
      id: instrumentId,
      label: instrument,
      parentId: assetClassCategory,
      color: categoryColor(assetClassCategory),
    });
  }

  return instrumentId;
}

function merchantGroupForMccCategory(
  mccCategory: MccSpendingCategory,
  merchant: string,
  topMerchantsByMccCategory: TopMerchantsByMccCategory,
): string {
  return topMerchantsByMccCategory.get(mccCategory)?.has(merchant) ? merchant : OTHER_MERCHANTS_LABEL;
}

function categoryIdForRow(
  row: RawRow,
  category: TradeRepublicCategoryId,
  counterparty: string,
  topMerchantsByMccCategory: TopMerchantsByMccCategory,
): string {
  if (category === TradeRepublicCategory.Card) {
    const mccCategory = mccSpendingCategory(row.mcc_code);
    if (mccCategory) {
      return mccMerchantCategoryId(
        TradeRepublicCategory.Card,
        mccCategory,
        merchantGroupForMccCategory(mccCategory, counterparty, topMerchantsByMccCategory),
      );
    }
  }
  if (category === TradeRepublicCategory.InvestmentBuy || category === TradeRepublicCategory.InvestmentIncome || category === TradeRepublicCategory.InvestmentOut) {
    return investmentInstrumentCategoryId(assetClassCategoryFor(category, row), counterparty);
  }
  return counterpartyCategoryId(category, counterparty);
}

function buildTransaction(raw: RawRow, rowIndex: number, topMerchantsByMccCategory: TopMerchantsByMccCategory): Transaction | null {
  const date = cleanText(raw.date);
  const amount = numberOrZero(raw.amount);
  if (!date || !Number.isFinite(amount)) return null;

  const rawType = cleanText(raw.type);
  const counterparty = extractCounterparty(raw);
  const category = categoryForRawType(rawType, amount);

  return {
    id: `${date}:${rowIndex}:${amount}:${rawType}:${counterparty}`,
    date,
    amount,
    currency: cleanText(raw.currency) || "EUR",
    counterparty,
    type: normalizeType(rawType, amount),
    rawType,
    categoryId: categoryIdForRow(raw, category, counterparty, topMerchantsByMccCategory),
  };
}

function topCardMerchantsByMccCategory(rows: RawRow[]): TopMerchantsByMccCategory {
  const totalsByCategory = new Map<MccSpendingCategory, Map<string, number>>();

  for (const row of rows) {
    const amount = numberOrZero(row.amount);
    if (categoryForRawType(cleanText(row.type), amount) !== TradeRepublicCategory.Card) continue;

    const mccCategory = mccSpendingCategory(row.mcc_code);
    if (!mccCategory) continue;

    const merchant = extractCounterparty(row);
    if (!totalsByCategory.has(mccCategory)) totalsByCategory.set(mccCategory, new Map());

    const totalsByMerchant = totalsByCategory.get(mccCategory);
    totalsByMerchant?.set(merchant, (totalsByMerchant.get(merchant) || 0) + Math.abs(amount));
  }

  return new Map(
    [...totalsByCategory.entries()].map(([mccCategory, totalsByMerchant]) => [
      mccCategory,
      new Set(
        [...totalsByMerchant.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, TOP_MERCHANTS_PER_MCC_CATEGORY)
          .map(([merchant]) => merchant),
      ),
    ]),
  );
}

export function parseTradeRepublicCsv(file: File | string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors?.length) {
          reject(new Error(result.errors.map((error) => error.message).join("; ")));
          return;
        }

        const categories = createStaticCategoryMap();
        const transactions: Transaction[] = [];
        const topMerchantsByMccCategory = topCardMerchantsByMccCategory(result.data);

        result.data.forEach((raw, rowIndex) => {
          const transaction = buildTransaction(raw, rowIndex, topMerchantsByMccCategory);
          if (!transaction) return;

          const category = categoryForRawType(transaction.rawType, transaction.amount);
          const mccCategory = category === TradeRepublicCategory.Card ? mccSpendingCategory(raw.mcc_code) : null;
          if (mccCategory) {
            ensureMccMerchantCategory(
              categories,
              mccCategory,
              merchantGroupForMccCategory(mccCategory, transaction.counterparty, topMerchantsByMccCategory),
            );
          } else if (category === TradeRepublicCategory.InvestmentBuy || category === TradeRepublicCategory.InvestmentIncome || category === TradeRepublicCategory.InvestmentOut) {
            ensureInvestmentInstrumentCategory(categories, assetClassCategoryFor(category, raw), transaction.counterparty);
          } else {
            ensureCounterpartyCategory(categories, category, transaction.counterparty);
          }
          transactions.push(transaction);
        });

        transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
        resolve({ transactions, categories: [...categories.values()] });
      },
      error: (error) => reject(error),
    });
  });
}
