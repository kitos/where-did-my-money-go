import type { CategoryNode } from "../../model/transaction";
import { MCCS_BY_SPENDING_CATEGORY, mccSpendingCategoryId } from "../mcc";

export const TradeRepublicCategory = {
  Income: "income",
  Outflow: "outflow",
  Card: "card",
  CardRefund: "card_refund",
  DirectDebit: "direct_debit",
  TransferIn: "transfer_in",
  TransferOut: "transfer_out",
  InvestmentBuy: "investment_buy",
  InvestmentBuyCrypto: "investment_buy_crypto",
  InvestmentBuyFunds: "investment_buy_funds",
  InvestmentBuyStocks: "investment_buy_stocks",
  InvestmentBuyBonds: "investment_buy_bonds",
  InvestmentBuyDerivatives: "investment_buy_derivatives",
  InvestmentBuyOther: "investment_buy_other",
  InvestmentIncome: "investment_income",
  InvestmentIncomeCrypto: "investment_income_crypto",
  InvestmentIncomeFunds: "investment_income_funds",
  InvestmentIncomeStocks: "investment_income_stocks",
  InvestmentIncomeBonds: "investment_income_bonds",
  InvestmentIncomeDerivatives: "investment_income_derivatives",
  InvestmentIncomeOther: "investment_income_other",
  InvestmentOut: "investment_out",
  InvestmentOutCrypto: "investment_out_crypto",
  InvestmentOutFunds: "investment_out_funds",
  InvestmentOutStocks: "investment_out_stocks",
  InvestmentOutBonds: "investment_out_bonds",
  InvestmentOutDerivatives: "investment_out_derivatives",
  InvestmentOutOther: "investment_out_other",
  Tax: "tax",
  AssetTransfer: "asset_transfer",
  Unknown: "unknown",
} as const;

export type TradeRepublicCategory = (typeof TradeRepublicCategory)[keyof typeof TradeRepublicCategory];

export function counterpartyCategoryId(parentCategory: TradeRepublicCategory, counterparty: string): string {
  return `${parentCategory}/${slug(counterparty)}`;
}

export function investmentInstrumentCategoryId(assetClassCategory: TradeRepublicCategory, instrument: string): string {
  return `${assetClassCategory}/${slug(instrument)}`;
}

export function createStaticCategoryMap(): Map<string, CategoryNode> {
  return new Map(STATIC_CATEGORIES.map((category) => [category.id, { ...category }]));
}

export function categoryColor(category: TradeRepublicCategory): string | undefined {
  return CATEGORY_COLOR_BY_ID.get(category);
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

export const STATIC_CATEGORIES = [
  {
    id: TradeRepublicCategory.Income,
    label: "Income",
    parentId: null,
    color: "#4f7cff",
  },
  {
    id: TradeRepublicCategory.Outflow,
    label: "Outflow",
    parentId: null,
    color: "#c96f3b",
  },
  {
    id: TradeRepublicCategory.TransferIn,
    label: "Transfer in",
    parentId: TradeRepublicCategory.Income,
    color: "#6b8afd",
  },
  {
    id: TradeRepublicCategory.CardRefund,
    label: "Card refund",
    parentId: TradeRepublicCategory.Income,
    color: "#8fb0ff",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.Card,
    label: "Card",
    parentId: TradeRepublicCategory.Outflow,
    color: "#d5914b",
  },
  ...Object.keys(MCCS_BY_SPENDING_CATEGORY).map((category) => ({
    id: mccSpendingCategoryId(TradeRepublicCategory.Card, category),
    label: category,
    parentId: TradeRepublicCategory.Card,
    color: "#d5914b",
  })),
  {
    id: TradeRepublicCategory.DirectDebit,
    label: "Direct debit",
    parentId: TradeRepublicCategory.Outflow,
    color: "#9a6fb0",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.TransferOut,
    label: "Transfer out",
    parentId: TradeRepublicCategory.Outflow,
    color: "#7a7a7a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuy,
    label: "Investment buy",
    parentId: TradeRepublicCategory.Outflow,
    color: "#2e8b57",
  },
  {
    id: TradeRepublicCategory.InvestmentBuyCrypto,
    label: "Crypto",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#d09b3c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuyFunds,
    label: "Funds",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#46a071",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuyStocks,
    label: "Stocks",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#7bbf6a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuyBonds,
    label: "Bonds",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#8aa58c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuyDerivatives,
    label: "Derivatives",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#b8975a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentBuyOther,
    label: "Other instruments",
    parentId: TradeRepublicCategory.InvestmentBuy,
    color: "#6b9a76",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncome,
    label: "Investment income",
    parentId: TradeRepublicCategory.Income,
    color: "#46a071",
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeCrypto,
    label: "Crypto",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#d09b3c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeFunds,
    label: "Funds",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#46a071",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeStocks,
    label: "Stocks",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#7bbf6a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeBonds,
    label: "Bonds",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#8aa58c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeDerivatives,
    label: "Derivatives",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#b8975a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentIncomeOther,
    label: "Other instruments",
    parentId: TradeRepublicCategory.InvestmentIncome,
    color: "#6b9a76",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOut,
    label: "Investment out",
    parentId: TradeRepublicCategory.Outflow,
    color: "#8aa58c",
  },
  {
    id: TradeRepublicCategory.InvestmentOutCrypto,
    label: "Crypto",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#d09b3c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOutFunds,
    label: "Funds",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#46a071",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOutStocks,
    label: "Stocks",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#7bbf6a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOutBonds,
    label: "Bonds",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#8aa58c",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOutDerivatives,
    label: "Derivatives",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#b8975a",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.InvestmentOutOther,
    label: "Other instruments",
    parentId: TradeRepublicCategory.InvestmentOut,
    color: "#6b9a76",
    expandable: false,
  },
  {
    id: TradeRepublicCategory.Tax,
    label: "Tax",
    parentId: TradeRepublicCategory.Outflow,
    color: "#9b6d8a",
  },
  {
    id: TradeRepublicCategory.AssetTransfer,
    label: "Asset transfer",
    parentId: TradeRepublicCategory.Outflow,
    color: "#86a96f",
  },
  {
    id: TradeRepublicCategory.Unknown,
    label: "Unknown",
    parentId: TradeRepublicCategory.Outflow,
    color: "#8a8178",
  },
] satisfies CategoryNode[];

const CATEGORY_COLOR_BY_ID = new Map(STATIC_CATEGORIES.map((category) => [category.id, category.color]));
