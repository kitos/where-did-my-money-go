export type Transaction = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  counterparty: string;
  type: string;
  rawType: string;
  categoryId: string;
};

export type CategoryNode = {
  id: string;
  label: string;
  parentId: string | null;
  color?: string;
  expandable?: boolean;
};

export type ParseResult = {
  transactions: Transaction[];
  categories: CategoryNode[];
};
