import { useState } from 'react';
import type { QueryResult } from '../api';

export type Turn = {
  question: string;
  result?: QueryResult;
  error?: string;
  pending?: boolean;
};

const SUGGESTIONS = [
  'Which area has the most chain snatching in Bengaluru North in 2026?',
  'Who are the repeat chain snatching accused in Bengaluru North?',
  'Show the network around P-0070',
  'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳ ಬಗ್ಗೆ ಹೇಳಿ',
  'List narcotics cases in Kalaburagi',
];

/** How the answer was produced, stated plainly rather than buried. */
function Provenance({ r }: { r: QueryResult }) {
  const p = r.provenance;

  if (r.abstained) {
    return <div className="prov abstain">Abstained — no records matched, so nothing was answered.</div>;
  }

  const blocked = p.guardrail?.blocked;
  return (
    <div className={`prov ${blocked ? 'blocked' : ''}`}>
      {blocked && p.guardrail?.reason === 'unsupported_ids' && (
        <>
          <strong>Guardrail stopped the model.</strong> It cited {p.guardrail.ids?.join(', ')}, which was never
          retrieved. That answer was discarded and replaced with one built directly from the records.{' '}
        </>
      )}
      {blocked && p.guardrail?.reason === 'llm_error' && (
        <>
          <strong>Model unavailable.</strong> Answer built directly from the records instead.{' '}
        </>
      )}
      {p.source === 'template' && <>Composed from records (model not configured). </>}
      {p.source === 'llm' && <>Composed by GLM 4.7 Flash from retrieved records only. </>}
      {p.records_retrieved} records retrieved · {p.latency_ms} ms
    </div>
  );
}

export default function ChatPanel({
  turns,
  onAsk,
  onCite,
  busy,
}: {
  turns: Turn[];
  onAsk: (q: string) => void;
  onCite: (id: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    onAsk(q);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-log">
        {turns.length === 0 && (
          <div className="empty">
            <h2>Ask about the records.</h2>
            <p className="dim">
              Every answer is drawn only from FIR records and cites them. When no record supports an answer,
              CIPHER says so instead of guessing.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ghost" onClick={() => onAsk(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className="turn">
            <div className="q">{t.question}</div>

            {t.pending && <div className="a pending">Retrieving records…</div>}
            {t.error && <div className="a error">{t.error}</div>}

            {t.result && (
              <div className={`a ${t.result.abstained ? 'abstained' : ''}`}>
                <pre>{t.result.answer}</pre>

                {t.result.citations.length > 0 && (
                  <div className="cites">
                    {t.result.citations.map((c) => (
                      <button key={c} className="cite" onClick={() => onCite(c)} title="Open this record">
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {t.result.carried_over.length > 0 && (
                  <div className="carried dim">carried from previous turn: {t.result.carried_over.join(', ')}</div>
                )}

                <Provenance r={t.result} />
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="ask" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask in English or Kannada…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !text.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
