import type { CategoryNode, Transaction } from "../model/transaction";
import type { FlowEdge, FlowGraph, FlowNode, FlowTransaction } from "../model/flow";

const INCOME_CATEGORY_ID = "income";
const OUTFLOW_CATEGORY_ID = "outflow";
const RETAINED_NODE_ID = "flow:retained";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string | null, T[]> {
  const grouped = new Map<string | null, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(item);
  }
  return grouped;
}

function formatTransaction(transaction: Transaction, note = ""): FlowTransaction {
  return {
    date: transaction.date,
    merchant: transaction.counterparty || "Unknown",
    amount: transaction.amount,
    type: transaction.rawType || transaction.type,
    description: transaction.type,
    note,
  };
}

function descendantCategoryIds(categoryId: string, childrenByParent: Map<string | null, CategoryNode[]>): Set<string> {
  const ids = new Set<string>([categoryId]);
  const stack = [...(childrenByParent.get(categoryId) || [])];

  while (stack.length) {
    const child = stack.pop();
    if (!child || ids.has(child.id)) continue;
    ids.add(child.id);
    stack.push(...(childrenByParent.get(child.id) || []));
  }

  return ids;
}

function aggregateTransactions(
  category: CategoryNode,
  transactionsByCategory: Map<string, Transaction[]>,
  childrenByParent: Map<string | null, CategoryNode[]>,
): Transaction[] {
  const ids = descendantCategoryIds(category.id, childrenByParent);
  return [...ids].flatMap((id) => transactionsByCategory.get(id) || []);
}

export function buildFlowGraph(transactions: Transaction[], categories: CategoryNode[], rangeLabel: string): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const nodeIds = new Set<string>();
  const childrenByParent = groupBy(categories, (category) => category.parentId);
  const transactionsByCategory = groupBy(transactions, (transaction) => transaction.categoryId) as Map<string, Transaction[]>;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categorySortOrder = buildCategorySortOrder(categories, childrenByParent);

  function isIncomeCategory(category: CategoryNode): boolean {
    let current: CategoryNode | undefined = category;
    while (current) {
      if (current.id === INCOME_CATEGORY_ID) return true;
      current = current.parentId ? categoryById.get(current.parentId) : undefined;
    }
    return false;
  }

  function addNode(node: FlowNode) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(source: string, target: string, value: number, edgeTransactions: FlowTransaction[]) {
    if (value <= 0) return;
    edges.push({ source, target, value: roundMoney(value), transactions: edgeTransactions });
  }

  function categoryTransactions(category: CategoryNode): Transaction[] {
    return aggregateTransactions(category, transactionsByCategory, childrenByParent);
  }

  function categoryValue(category: CategoryNode): number {
    return sum(categoryTransactions(category), (transaction) => Math.abs(transaction.amount));
  }

  const valuedCategories = categories.filter((category) => categoryValue(category) > 0);
  const valuedCategoryIds = new Set(valuedCategories.map((category) => category.id));

  for (const category of valuedCategories) {
    const txs = categoryTransactions(category);
    addNode({
      id: category.id,
      label: category.label,
      value: roundMoney(sum(txs, (transaction) => Math.abs(transaction.amount))),
      color: category.color,
      sortOrder: categorySortOrder.get(category.id) || 999_000,
      layoutColumn: layoutColumnForCategory(category, categoryById),
      transactions: txs.map((transaction) => formatTransaction(transaction)),
      expansionDirection: isIncomeCategory(category) ? "incoming" : "outgoing",
      autoExpand: category.id === OUTFLOW_CATEGORY_ID,
      expandable: category.expandable,
    });
  }

  const rootCategories = [...(childrenByParent.get(null) || [])].filter((category) => valuedCategoryIds.has(category.id));
  for (const root of rootCategories) {
    if (root.id === INCOME_CATEGORY_ID) continue;
    const txs = categoryTransactions(root);
    addEdge(
      INCOME_CATEGORY_ID,
      root.id,
      sum(txs, (transaction) => Math.abs(transaction.amount)),
      txs.map((transaction) => formatTransaction(transaction)),
    );
  }

  for (const category of valuedCategories) {
    const children = [...(childrenByParent.get(category.id) || [])]
      .filter((child) => valuedCategoryIds.has(child.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    for (const child of children) {
      const txs = categoryTransactions(child);
      const value = sum(txs, (transaction) => Math.abs(transaction.amount));
      const source = isIncomeCategory(category) ? child.id : category.id;
      const target = isIncomeCategory(category) ? category.id : child.id;
      addEdge(source, target, value, txs.map((transaction) => formatTransaction(transaction)));
    }
  }

  const incomingValue = sum(transactions.filter((transaction) => transaction.amount > 0), (transaction) => transaction.amount);
  const outflowValue = sum(transactions.filter((transaction) => transaction.amount < 0), (transaction) => Math.abs(transaction.amount));
  const retainedValue = Math.max(incomingValue - outflowValue, 0);

  if (retainedValue > 0) {
    const retainedTransaction = {
      date: rangeLabel,
      merchant: "Cash retained",
      amount: roundMoney(retainedValue),
      type: "CALCULATION",
      description: "Positive net cash flow for selected range",
      note: "",
    };
    addNode({
      id: RETAINED_NODE_ID,
      label: "Cash retained",
      value: roundMoney(retainedValue),
      color: "#73be86",
      sortOrder: 30_000,
      layoutColumn: 3,
      transactions: [retainedTransaction],
    });
    addEdge(INCOME_CATEGORY_ID, RETAINED_NODE_ID, retainedValue, [retainedTransaction]);
  }

  return {
    nodes,
    edges,
    roots: nodes.some((node) => node.id === INCOME_CATEGORY_ID) ? [INCOME_CATEGORY_ID] : [],
    totals: {
      incoming: roundMoney(incomingValue),
      outflow: roundMoney(outflowValue),
      retained: roundMoney(retainedValue),
    },
  };
}

function layoutColumnForCategory(category: CategoryNode, categoryById: Map<string, CategoryNode>): number {
  const path = categoryPath(category, categoryById);
  if (category.id === INCOME_CATEGORY_ID) return 2;
  if (path[0] === INCOME_CATEGORY_ID) return Math.max(0, 2 - (path.length - 1));
  if (category.id === OUTFLOW_CATEGORY_ID) return 3;
  if (path[0] === OUTFLOW_CATEGORY_ID) return 3 + (path.length - 1);
  return 9;
}

function categoryPath(category: CategoryNode, categoryById: Map<string, CategoryNode>): string[] {
  const path: string[] = [];
  let current: CategoryNode | undefined = category;
  while (current) {
    path.unshift(current.id);
    current = current.parentId ? categoryById.get(current.parentId) : undefined;
  }
  return path;
}

function buildCategorySortOrder(
  categories: CategoryNode[],
  childrenByParent: Map<string | null, CategoryNode[]>,
): Map<string, number> {
  const order = new Map<string, number>();
  const staticOrder = new Map<string, number>([
    ["income", 10_000],
    ["card_refund", 10_100],
    ["investment_income", 10_200],
    ["transfer_in", 10_300],
    ["outflow", 20_000],
    ["card", 20_100],
    ["direct_debit", 20_200],
    ["investment_buy", 20_300],
    ["transfer_out", 20_400],
  ]);

  const byId = new Map(categories.map((category) => [category.id, category]));

  function baseOrder(category: CategoryNode): number {
    if (staticOrder.has(category.id)) return staticOrder.get(category.id) || 999_000;
    if (!category.parentId) return 900_000;
    const parent = byId.get(category.parentId);
    const siblings = [...(childrenByParent.get(category.parentId) || [])].sort((a, b) => {
      const explicit = (staticOrder.get(a.id) || 999_000) - (staticOrder.get(b.id) || 999_000);
      return explicit || a.label.localeCompare(b.label);
    });
    const siblingIndex = Math.max(0, siblings.findIndex((sibling) => sibling.id === category.id));
    return parent ? baseOrder(parent) + siblingIndex + 1 : 900_000 + siblingIndex;
  }

  for (const category of categories) {
    order.set(category.id, baseOrder(category));
  }

  return order;
}
