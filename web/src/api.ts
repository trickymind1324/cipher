/** Calls to the Catalyst function. In dev, Vite proxies /server to catalyst serve. */

const BASE = '/server/api';

export type Provenance = {
  source: 'llm' | 'template' | 'template_after_guardrail' | 'template_after_llm_error' | 'abstain';
  guardrail: { blocked: boolean; reason: string; ids?: string[] } | null;
  records_retrieved: number;
  latency_ms: number;
};

export type Entities = {
  crime_type?: string;
  district?: string;
  taluk?: string;
  person_id?: string;
  person_name?: string;
  fir_id?: string;
  date?: { from: string; to: string; label: string };
};

export type QueryResult = {
  answer: string;
  abstained: boolean;
  citations: string[];
  intent: string;
  language: 'en' | 'kn';
  entities: Entities;
  carried_over: string[];
  result_kind?: string;
  data?: any;
  provenance: Provenance;
  context: Entities;
};

export type GraphNode = {
  id: string;
  label: string;
  hop: number;
  is_seed: boolean;
  district: string;
  taluk: string;
  fir_count: number;
  crime_types: string[];
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'CO_ACCUSED' | 'SHARES_IDENTIFIER';
  weight: number;
  label: string;
  fir_ids?: string[];
  attribute_type?: string;
  attribute_value?: string;
};

export type Graph = {
  seed: { person_id: string; name: string };
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  insights: {
    persons: number;
    co_accused_edges: number;
    identifier_edges: number;
    identifier_only_links: { between: [string, string]; via: string; note: string }[];
  };
  evidence: string[];
};

export type Health = { status: string; version: string; store: string; llm: string };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const health = () => get<Health>('/health');

export const network = (personId: string, depth = 2) =>
  get<Graph>(`/network?person_id=${encodeURIComponent(personId)}&depth=${depth}`);

export async function query(question: string, context: Entities, role: string): Promise<QueryResult> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, role }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const firUrl = (id: string) => `${BASE}/firs/${id}`;
