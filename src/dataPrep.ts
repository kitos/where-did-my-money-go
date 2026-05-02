import { parseTradeRepublicCsv } from "./adapters/tr/parser";

export async function parseTransactionCsv(file: File) {
  const parsed = await parseTradeRepublicCsv(file);

  return {
    notes: [],
    transactions: parsed.transactions,
    categories: parsed.categories,
    sourceName: file.name,
  };
}
