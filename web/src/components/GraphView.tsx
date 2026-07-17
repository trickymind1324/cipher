import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { Core, EventObject } from 'cytoscape';
import type { Graph, GraphEdge, GraphNode } from '../api';

type Selection =
  | { kind: 'node'; node: GraphNode }
  | { kind: 'edge'; edge: GraphEdge }
  | null;

/**
 * Co-accused edges are drawn solid, shared-identifier edges dashed and amber.
 * The distinction is the point: a dashed edge means "these two were never charged
 * together, but the same phone or vehicle is on both records" — a lead, not a fact
 * already in a case file.
 */
export default function GraphView({ graph, theme }: { graph: Graph; theme: string }) {
  const box = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const [selected, setSelected] = useState<Selection>(null);

  useEffect(() => {
    if (!box.current) return;

    // Cytoscape paints to a canvas, so it can't inherit the CSS variables the rest of
    // the UI uses. Read them here and rebuild when the theme changes.
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const colors = {
      seed: v('--g-node-seed'),
      hop1: v('--g-node-hop1'),
      hop2: v('--g-node-hop2'),
      label: v('--g-node-label'),
      edge: v('--g-edge'),
      shared: v('--g-edge-shared'),
      select: v('--g-select'),
    };

    const instance = cytoscape({
      container: box.current,
      elements: [
        ...graph.nodes.map((n) => ({ data: { ...n } })),
        ...graph.edges.map((e) => ({ data: { ...e } })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (n: any) =>
              n.data('is_seed') ? colors.seed : n.data('hop') === 1 ? colors.hop1 : colors.hop2,
            width: (n: any) => 22 + Math.min(n.data('fir_count') || 0, 14) * 2.2,
            height: (n: any) => 22 + Math.min(n.data('fir_count') || 0, 14) * 2.2,
            label: 'data(label)',
            color: colors.label,
            'font-size': 10,
            'text-valign': 'bottom',
            'text-margin-y': 4,
          },
        },
        {
          selector: 'edge[type="CO_ACCUSED"]',
          style: {
            width: (e: any) => 1 + Math.min(e.data('weight') || 1, 6),
            'line-color': colors.edge,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge[type="SHARES_IDENTIFIER"]',
          style: {
            width: 2.5,
            'line-color': colors.shared,
            'line-style': 'dashed',
            'curve-style': 'bezier',
          },
        },
        {
          selector: ':selected',
          style: {
            'line-color': colors.select,
            'background-color': colors.select,
            'border-width': 3,
            'border-color': colors.select,
          },
        },
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 90, padding: 30 },
    });

    instance.on('tap', 'node', (evt: EventObject) => setSelected({ kind: 'node', node: evt.target.data() }));
    instance.on('tap', 'edge', (evt: EventObject) => setSelected({ kind: 'edge', edge: evt.target.data() }));
    instance.on('tap', (evt: EventObject) => {
      if (evt.target === instance) setSelected(null);
    });

    cy.current = instance;
    return () => instance.destroy();
  }, [graph, theme]);

  const leads = graph.insights.identifier_only_links;

  return (
    <div className="graph">
      <div className="graph-head">
        <div>
          <h2>
            Network around <strong>{graph.seed.name}</strong> <span className="mono dim">{graph.seed.person_id}</span>
          </h2>
          <p className="dim">
            {graph.insights.persons} persons · {graph.insights.co_accused_edges} co-accused links ·{' '}
            {graph.insights.identifier_edges} shared-identifier links · {graph.evidence.length} source FIRs
          </p>
        </div>
        <button className="ghost" onClick={() => cy.current?.fit(undefined, 30)}>
          Fit
        </button>
      </div>

      {leads.length > 0 && (
        <div className="leads">
          <span className="tag">LEAD</span>
          {leads.map((l, i) => (
            <span key={i}>
              <span className="mono">{l.between[0]}</span> ↔ <span className="mono">{l.between[1]}</span> share{' '}
              <span className="mono">{l.via}</span> but were never charged in the same FIR
            </span>
          ))}
        </div>
      )}

      <div className="graph-canvas" ref={box} />

      <div className="graph-foot">
        <div className="legend">
          <span><i className="dot seed" /> subject</span>
          <span><i className="dot hop1" /> direct link</span>
          <span><i className="dot hop2" /> 2nd hop</span>
          <span><i className="line solid" /> co-accused</span>
          <span><i className="line dashed" /> shared phone/vehicle</span>
        </div>

        {selected?.kind === 'node' && (
          <div className="inspect">
            <strong>{selected.node.label}</strong> <span className="mono dim">{selected.node.id}</span>
            <p className="dim">
              {selected.node.district} · accused in {selected.node.fir_count} case
              {selected.node.fir_count === 1 ? '' : 's'} ·{' '}
              {selected.node.crime_types.join(', ') || 'no recorded crime types'}
            </p>
          </div>
        )}

        {selected?.kind === 'edge' && (
          <div className="inspect">
            {selected.edge.type === 'CO_ACCUSED' ? (
              <>
                <strong>Co-accused</strong> — charged together in {selected.edge.fir_ids?.length} case(s)
                <p className="mono dim">{selected.edge.fir_ids?.join(', ')}</p>
              </>
            ) : (
              <>
                <strong>Shared identifier</strong> — same {selected.edge.attribute_type} on both records
                <p className="mono dim">{selected.edge.attribute_value}</p>
              </>
            )}
          </div>
        )}

        {!selected && <div className="inspect dim">Click a person or a link to see the records behind it.</div>}
      </div>
    </div>
  );
}
