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
  area?: string;
  person_id?: string;
  person_name?: string;
  crime_no?: string;
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

export type Trends = {
  filters: { district?: string; area?: string; crime_type?: string; from?: string; to?: string };
  total: number;
  series: { key: string; count: number; fir_ids: string[] }[];
  hotspots: { area: string; count: number; share: number; lat: number | null; lon: number | null; fir_ids: string[] }[];
  by_crime_type: { key: string; count: number }[];
  points: { crime_no: string; lat: number; lon: number; crime_type: string; area: string; occurrence_date: string }[];
  top_area: Trends['hotspots'][number] | null;
  movement: {
    recent_window: string;
    prior_window: string;
    recent_avg: number;
    prior_avg: number;
    change_pct: number;
    direction: 'rising' | 'falling' | 'flat';
  } | null;
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

export function trends(e: Entities) {
  const q = new URLSearchParams();
  if (e.district) q.set('district', e.district);
  if (e.area) q.set('area', e.area);
  if (e.crime_type) q.set('crime_type', e.crime_type);
  if (e.date?.from) q.set('from', e.date.from);
  if (e.date?.to) q.set('to', e.date.to);
  return get<Trends>(`/trends?${q}`);
}

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

export type ExportTurn = {
  question: string;
  answer: string;
  citations: string[];
  abstained: boolean;
  language: string;
  provenance: Provenance;
};

/** F6 — download the conversation as a PDF. The server streams it straight back. */
export async function exportPdf(turns: ExportTurn[], role: string): Promise<Blob> {
  const res = await fetch(`${BASE}/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turns, role }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.blob();
}
