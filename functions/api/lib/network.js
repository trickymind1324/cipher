'use strict';

/**
 * Criminal-network graph builder (FR-NET-02 / FR-NET-07).
 *
 * Two kinds of edge, and the difference is the entire point of the feature:
 *
 *   CO_ACCUSED        two people charged in the same FIR. Already visible in any case file.
 *   SHARES_IDENTIFIER two people with the same phone or vehicle on record, who may never
 *                     have been charged together. This is the link a human would have to
 *                     join across records by hand to notice.
 *
 * Every edge carries the record ids it was derived from, so nothing on the canvas is
 * asserted without a source the officer can open.
 */

const store = require('./store');

/**
 * Breadth-first expansion from a seed person.
 * @param {string} personId
 * @param {number} depth  hops from the seed (1–3)
 */
function build(personId, depth = 2) {
	const seed = store.getPerson(personId);
	if (!seed) return null;

	const hops = Math.min(Math.max(Number(depth) || 2, 1), 3);

	const nodes = new Map();
	const edges = new Map();

	const addNode = (person, hop) => {
		if (!person) return;
		const existing = nodes.get(person.person_id);
		// keep the shortest hop distance if reached by several paths
		if (existing) {
			existing.hop = Math.min(existing.hop, hop);
			return;
		}
		const firs = store.firsOfPerson(person.person_id);
		const accusedIn = firs.filter((f) => f.role === 'accused');
		nodes.set(person.person_id, {
			id: person.person_id,
			label: person.full_name,
			hop,
			is_seed: person.person_id === seed.person_id,
			district: person.district,
			fir_count: accusedIn.length,
			crime_types: [...new Set(accusedIn.map((f) => f.fir.crime_type))],
		});
	};

	// undirected: one edge per unordered pair per type
	const addEdge = (a, b, type, payload) => {
		const [x, y] = [a, b].sort();
		const key = `${type}:${x}:${y}`;
		if (edges.has(key)) return;
		edges.set(key, { id: key, source: x, target: y, type, ...payload });
	};

	addNode(seed, 0);
	let frontier = [seed.person_id];

	for (let hop = 1; hop <= hops; hop++) {
		const next = [];

		for (const pid of frontier) {
			for (const c of store.coAccused(pid)) {
				addNode(store.getPerson(c.person_id), hop);
				addEdge(pid, c.person_id, 'CO_ACCUSED', {
					weight: c.shared_firs.length,
					label: `${c.shared_firs.length} shared case${c.shared_firs.length === 1 ? '' : 's'}`,
					fir_ids: c.shared_firs,
				});
				if (!nodes.has(c.person_id) || nodes.get(c.person_id).hop === hop) next.push(c.person_id);
			}

			for (const l of store.sharedAttributeLinks(pid)) {
				addNode(store.getPerson(l.person_id), hop);
				addEdge(pid, l.person_id, 'SHARES_IDENTIFIER', {
					weight: 1,
					label: `same ${l.type}`,
					attribute_type: l.type,
					attribute_value: l.value,
				});
				if (!nodes.has(l.person_id) || nodes.get(l.person_id).hop === hop) next.push(l.person_id);
			}
		}

		frontier = [...new Set(next)];
		if (!frontier.length) break;
	}

	const nodeList = [...nodes.values()];
	const edgeList = [...edges.values()];

	// A person linked only by a shared phone/vehicle — never charged alongside the seed.
	// These are the leads the graph exists to surface, so name them explicitly.
	const coAccusedPairs = new Set(
		edgeList.filter((e) => e.type === 'CO_ACCUSED').map((e) => `${e.source}:${e.target}`)
	);
	const identifierOnly = edgeList
		.filter((e) => e.type === 'SHARES_IDENTIFIER' && !coAccusedPairs.has(`${e.source}:${e.target}`))
		.map((e) => ({
			between: [e.source, e.target],
			via: `${e.attribute_type} ${e.attribute_value}`,
			note: 'linked by a shared identifier but never charged in the same case',
		}));

	return {
		seed: { person_id: seed.person_id, name: seed.full_name },
		depth: hops,
		nodes: nodeList,
		edges: edgeList,
		insights: {
			persons: nodeList.length,
			co_accused_edges: edgeList.filter((e) => e.type === 'CO_ACCUSED').length,
			identifier_edges: edgeList.filter((e) => e.type === 'SHARES_IDENTIFIER').length,
			identifier_only_links: identifierOnly,
		},
		// every FIR that produced a co-accused edge — the graph's evidence trail
		evidence: [...new Set(edgeList.flatMap((e) => e.fir_ids || []))],
	};
}

module.exports = { build };
