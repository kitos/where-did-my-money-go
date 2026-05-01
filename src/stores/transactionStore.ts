import { derived, writable } from "svelte/store";
import type { CategoryNode, Transaction } from "../model/transaction";

export type TransactionDataset = {
  transactions: Transaction[];
  categories: CategoryNode[];
  sourceName: string;
  notes: string[];
};

const emptyDataset: TransactionDataset = {
  transactions: [],
  categories: [],
  sourceName: "",
  notes: [],
};

export const transactionDataset = writable<TransactionDataset>(emptyDataset);

export const selectedDateRange = writable({
  startDate: "",
  endDate: "",
});

export const transactionDateRange = derived(transactionDataset, ($dataset) => {
  const dates = $dataset.transactions.map((transaction) => transaction.date).filter(Boolean).sort();
  return {
    minDate: dates[0] || "",
    maxDate: dates[dates.length - 1] || "",
  };
});

export const filteredTransactions = derived(
  [transactionDataset, selectedDateRange],
  ([$dataset, $selectedDateRange]) => {
    const { startDate, endDate } = $selectedDateRange;
    if (!startDate || !endDate) return [];
    return $dataset.transactions.filter((transaction) => transaction.date >= startDate && transaction.date <= endDate);
  },
);
