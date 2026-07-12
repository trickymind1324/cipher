import { useEffect, useState } from 'react';
import * as api from './api';
import type { Entities, Graph, Health, Trends } from './api';
import ChatPanel, { type Turn } from './components/ChatPanel';
import GraphView from './components/GraphView';
import TrendsView from './components/TrendsView';

const ROLES = ['CONSTABLE', 'INVESTIGATOR', 'SP'];

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [context, setContext] = useState<Entities>({});
  const [graph, setGraph] = useState<Graph | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [role, setRole] = useState('INVESTIGATOR');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('cipher-theme') || 'light');

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cipher-theme', theme);
  }, [theme]);

  async function ask(question: string) {
    setBusy(true);
    setTurns((t) => [...t, { question, pending: true }]);

    try {
      const result = await api.query(question, context, role);
      setContext(result.context);
      setTurns((t) => [...t.slice(0, -1), { question, result }]);

      // The question decides what the evidence panel shows. Trend and hotspot answers carry
      // their own chart data, so the panel renders exactly the numbers the answer quoted.
      if (result.intent === 'NETWORK' && result.entities.person_id) {
        api.network(result.entities.person_id, 2).then(showGraph).catch(() => {});
      } else if ((result.intent === 'TREND' || result.intent === 'HOTSPOT') && !result.abstained) {
        showTrends(result.data as Trends);
      }
    } catch (err) {
      setTurns((t) => [...t.slice(0, -1), { question, error: String((err as Error).message) }]);
    } finally {
      setBusy(false);
    }
  }

  // The evidence panel shows one thing at a time — whichever the last action asked for.
  const showGraph = (g: Graph) => {
    setGraph(g);
    setTrends(null);
    setRecord(null);
  };
  const showTrends = (t: Trends) => {
    setTrends(t);
    setGraph(null);
    setRecord(null);
  };
  const showRecord = (r: any) => {
    setRecord(r);
    setGraph(null);
    setTrends(null);
  };

  /** Clicking a citation opens the underlying record — the evidence trail, not a footnote. */
  async function openCitation(id: string) {
    if (id.startsWith('P-')) {
      const g = await api.network(id, 2).catch(() => null);
      if (g) showGraph(g);
      return;
    }
    const res = await fetch(api.firUrl(id));
    if (res.ok) showRecord(await res.json());
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">◈</span>
          <div>
            <h1>CIPHER</h1>
            <p>Grounded crime intelligence · Karnataka State Police</p>
          </div>
        </div>

        <div className="header-right">
          <label className="role">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="status">
            <span className={`pill ${health ? 'ok' : 'down'}`}>{health ? `v${health.version}` : 'offline'}</span>
            <span className="pill dim" title="Answer composition engine">
              {health?.llm === 'quickml' ? 'GLM 4.7 Flash' : 'records-only'}
            </span>
          </div>

          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      <main>
        <section className="left">
          <ChatPanel turns={turns} onAsk={ask} onCite={openCitation} busy={busy} />
        </section>

        <section className="right">
          {graph && <GraphView graph={graph} theme={theme} />}

          {trends && <TrendsView trends={trends} theme={theme} onCite={openCitation} />}

          {record && (
            <div className="record">
              <div className="graph-head">
                <h2>
                  {record.fir_id} <span className="dim">{record.fir_number}</span>
                </h2>
                <button className="ghost" onClick={() => setRecord(null)}>
                  Close
                </button>
              </div>
              <dl>
                <div><dt>Crime</dt><dd>{record.crime_type}</dd></div>
                <div><dt>Sections</dt><dd>{record.ipc_sections}</dd></div>
                <div><dt>Where</dt><dd>{record.police_station}, {record.taluk}, {record.district}</dd></div>
                <div><dt>Occurred</dt><dd>{record.occurrence_date} at {record.occurrence_time}</dd></div>
                <div><dt>Status</dt><dd>{record.status}</dd></div>
                <div><dt>IO</dt><dd>{record.io_officer}</dd></div>
              </dl>
              <p className="mo">{record.modus_operandi}</p>
              <h3>Parties</h3>
              <ul className="parties">
                {record.parties?.map((p: any) => (
                  <li key={p.id}>
                    <span className={`tag ${p.role}`}>{p.role}</span>
                    {p.person?.full_name}{' '}
                    <button className="cite" onClick={() => openCitation(p.person_id)}>
                      {p.person_id}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!graph && !trends && !record && (
            <div className="placeholder">
              <p className="dim">
                Evidence appears here — a network, a trend and hotspot map, or a record. Ask a question, or click
                any citation.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span className="dim">
          Synthetic data only — no real police records. Answers are limited to retrieved records; unsupported
          citations are rejected before an answer is shown.
        </span>
      </footer>
    </div>
  );
}
