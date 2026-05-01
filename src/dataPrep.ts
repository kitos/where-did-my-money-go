import { parseTradeRepublicCsv } from "./adapters/tr/parser";

export async function parseTransactionCsv(file: File) {
  const parsed = await parseTradeRepublicCsv(file);

  return {
    notes: [
      "Data was parsed locally in your browser from the dropped CSV.",
      "Trade Republic CSV rows are converted into app transactions and adapter-defined categories.",
      "No upload is performed; the CSV file stays on this machine.",
    ],
    transactions: parsed.transactions,
    categories: parsed.categories,
    sourceName: file.name,
  };
}
