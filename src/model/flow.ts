export type FlowTransaction = {
  date: string;
  merchant: string;
  amount: number;
  type: string;
  description: string;
  note: string;
};

export type FlowNode = {
  id: string;
  label: string;
  value: number;
  color?: string;
  sortOrder?: number;
  layoutColumn?: number;
  transactions: FlowTransaction[];
  expansionDirection?: "incoming" | "outgoing";
  autoExpand?: boolean;
  expandable?: boolean;
};

export type FlowEdge = {
  source: string;
  target: string;
  value: number;
  transactions: FlowTransaction[];
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  roots: string[];
  totals: {
    incoming: number;
    outflow: number;
    retained: number;
  };
};
