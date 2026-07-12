'use strict';

/**
 * Append-only audit trail (LLD §2.4).
 *
 * In-process ring buffer for the prototype — it survives a warm function but not a cold
 * start. The real thing writes WORM rows to the Data Store `audit_log` table; the shape
 * below is already that row, so switching backends is a write call, not a redesign.
 */

const crypto = require('node:crypto');

const MAX = 500;
const entries = [];

function record({ user, role, question, result, ip }) {
	const row = {
		log_id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		user_id: user || 'demo-user',
		role: role || 'INVESTIGATOR',
		action_type: 'QUERY',
		query_text: question,
		language: result.language,
		resolved_intent: result.intent,
		entities_json: JSON.stringify(result.entities || {}),
		records_accessed: result.evidence || [],
		citations: result.citations || [],
		abstained: Boolean(result.abstained),
		answer_source: result.source,
		guardrail: result.guardrail || null,
		// Hash rather than the text: proves what was returned without duplicating record content.
		response_hash: crypto.createHash('sha256').update(result.answer || '').digest('hex'),
		latency_ms: result.latency_ms,
		client_ip: ip || null,
	};

	entries.push(row);
	if (entries.length > MAX) entries.shift();
	return row;
}

const recent = (n = 50) => entries.slice(-n).reverse();

module.exports = { record, recent };
