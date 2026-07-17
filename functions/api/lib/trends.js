'use strict';

/**
 * Crime trends and hotspots (FR-PAT-01 / 02 / 06).
 *
 * Returns the monthly series, the per-area counts, and the individual FIR coordinates
 * behind them. The map plots real FIR locations rather than a synthesised density
 * surface, so every point on it opens a record — the same evidence rule as everywhere else.
 */

const store = require('./store');

/**
 * Insert the months that have no FIRs.
 *
 * The aggregation only emits months that produced a record, so a quiet month simply
 * vanishes. That makes a line chart lie (it joins across the gap as though nothing
 * happened) and it makes any "last 6 months" window span more than six calendar months.
 * Both problems disappear if zero months are explicit.
 */
function fillMonths(series, from, to) {
	if (!series.length) return series;

	const start = (from || series[0].key).slice(0, 7);
	const end = (to || series[series.length - 1].key).slice(0, 7);

	const byKey = new Map(series.map((s) => [s.key, s]));
	const out = [];

	let [y, m] = start.split('-').map(Number);
	const [ey, em] = end.split('-').map(Number);

	while (y < ey || (y === ey && m <= em)) {
		const key = `${y}-${String(m).padStart(2, '0')}`;
		out.push(byKey.get(key) || { key, count: 0, fir_ids: [] });
		if (++m > 12) {
			m = 1;
			y++;
		}
	}
	return out;
}

const mean = (xs) => (xs.length ? xs.reduce((a, s) => a + s.count, 0) / xs.length : 0);

/**
 * Direction of travel: the last 6 months against the 6 before them.
 *
 * A single-month spike test is the obvious thing to write and the wrong one here — the
 * newest month is usually partial (records are still being registered), so it reads as a
 * trough and hides a genuine rise. Comparing half-year windows is what actually answers
 * "is this getting worse".
 */
function movement(series) {
	if (series.length < 4) return null;

	const half = Math.min(6, Math.floor(series.length / 2));
	// drop the newest month: it is still filling up and would drag the average down
	const closed = series.slice(0, -1);
	if (closed.length < half * 2) return null;

	const recent = closed.slice(-half);
	const prior = closed.slice(-half * 2, -half);
	const a = mean(prior);
	const b = mean(recent);
	if (!a) return null;

	const change = (b - a) / a;
	return {
		recent_window: `${recent[0].key}..${recent[recent.length - 1].key}`,
		prior_window: `${prior[0].key}..${prior[prior.length - 1].key}`,
		recent_avg: +b.toFixed(1),
		prior_avg: +a.toFixed(1),
		change_pct: Math.round(change * 100),
		direction: change > 0.15 ? 'rising' : change < -0.15 ? 'falling' : 'flat',
	};
}

function build(filters = {}) {
	const f = {
		district: filters.district,
		area: filters.area,
		crime_type: filters.crime_type,
		from: filters.from,
		to: filters.to,
	};

	const series = fillMonths(store.aggregate({ by: 'month', ...f }), f.from, f.to);
	const areas = store.aggregate({ by: 'area', ...f });
	const byType = store.aggregate({ by: 'crime_type', ...f });

	const { rows: firs } = store.findFirs({ ...f, limit: Infinity });
	const total = firs.length;

	// Geo points: one per case, so a marker is always traceable to a record.
	const points = firs.map((x) => ({
		crime_no: x.crime_no,
		lat: x.lat,
		lon: x.lon,
		crime_type: x.crime_type,
		area: x.area,
		district: x.district,
		occurrence_date: x.occurrence_date,
		status: x.status,
	}));

	// Area centroids for the map's hotspot circles.
	const stationByArea = new Map(store.stations().map((s) => [s.area, s]));
	const hotspots = areas.map((a) => {
		const s = stationByArea.get(a.key);
		return {
			area: a.key,
			count: a.count,
			share: total ? +(a.count / total).toFixed(3) : 0,
			lat: s?.lat ?? null,
			lon: s?.lon ?? null,
			fir_ids: a.fir_ids,
		};
	});

	return {
		filters: f,
		total,
		series, // [{ key: '2026-04', count, fir_ids }]
		hotspots, // ranked by count
		by_crime_type: byType,
		points,
		top_area: hotspots[0] || null,
		movement: movement(series),
		evidence: firs.map((x) => x.crime_no),
	};
}

module.exports = { build };
