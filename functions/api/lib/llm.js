'use strict';

/**
 * QuickML LLM Serving client — GLM 4.7 Flash.
 *
 * The GLM endpoint is OpenAI-compatible: `messages[]` in, `choices[0].message.content`
 * out. (The Vision model's endpoint uses a different `prompt`/`response` shape — don't
 * copy that one.) GLM also returns a `reasoning` field and supports tool calling; we use
 * neither, deliberately: retrieval decisions are made by rules in nlu.js, not by the model.
 *
 * Endpoint and model are known; only the credentials are missing until they are set in
 * the console. Config comes from function environment variables — never commit secrets:
 *   ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN   (required)
 *   QUICKML_URL       override endpoint (default below)
 *   QUICKML_MODEL     override model id  (default below)
 *   CATALYST_ORG      org id → CATALYST-ORG header
 *   ZOHO_ACCOUNTS     https://accounts.zoho.in
 *   ZOHO_SCOPE        QuickML.deployment.READ
 *
 * If unconfigured, isConfigured() is false and callers compose the answer deterministically.
 * This client never invents an answer to paper over a missing model.
 */

const DEFAULT_URL = 'https://api.catalyst.zoho.in/quickml/v1/project/43331000000013057/glm/chat';
const DEFAULT_MODEL = 'crm-di-glm47b_30b_it';
const DEFAULT_ORG = '60075928027';

const cfg = () => ({
	url: process.env.QUICKML_URL || DEFAULT_URL,
	model: process.env.QUICKML_MODEL || DEFAULT_MODEL,
	org: process.env.CATALYST_ORG || DEFAULT_ORG,
	accounts: process.env.ZOHO_ACCOUNTS || 'https://accounts.zoho.in',
	clientId: process.env.ZOHO_CLIENT_ID,
	clientSecret: process.env.ZOHO_CLIENT_SECRET,
	refreshToken: process.env.ZOHO_REFRESH_TOKEN,
	scope: process.env.ZOHO_SCOPE || 'QuickML.deployment.READ',
});

// Endpoint/model/org have defaults, so configuration reduces to: are the secrets set?
const isConfigured = () => {
	const c = cfg();
	return Boolean(c.clientId && c.clientSecret && c.refreshToken);
};

// ── OAuth token, cached until shortly before expiry ───────────────────────────
let token = { value: null, expiresAt: 0 };

async function accessToken() {
	if (token.value && Date.now() < token.expiresAt - 60_000) return token.value;

	const c = cfg();
	const res = await fetch(`${c.accounts}/oauth/v2/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			refresh_token: c.refreshToken,
			client_id: c.clientId,
			client_secret: c.clientSecret,
			grant_type: 'refresh_token',
			scope: c.scope,
		}),
	});

	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json.access_token) {
		throw new Error(`oauth_failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
	}

	token = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
	return token.value;
}

/**
 * Single-turn completion. Low temperature by default — this phrases answers from records
 * we supply, so we want the least creative behaviour available.
 */
async function chat({ prompt, system, temperature = 0.1, max_tokens = 700, timeoutMs = 25_000 }) {
	if (!isConfigured()) throw new Error('llm_not_configured');

	const c = cfg();
	const bearer = await accessToken();
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);

	try {
		const res = await fetch(c.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bearer}`,
				'CATALYST-ORG': c.org,
			},
			body: JSON.stringify({
				model: c.model,
				messages: [
					...(system ? [{ role: 'system', content: system }] : []),
					{ role: 'user', content: prompt },
				],
				temperature,
				max_tokens,
				stream: false,
			}),
			signal: ctrl.signal,
		});

		const json = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(`llm_http_${res.status}: ${JSON.stringify(json).slice(0, 200)}`);

		const text = json?.choices?.[0]?.message?.content;
		if (typeof text !== 'string') throw new Error(`llm_bad_shape: ${JSON.stringify(json).slice(0, 200)}`);

		return { text: text.trim(), model: json.model || c.model, usage: json.usage || null };
	} finally {
		clearTimeout(timer);
	}
}

// accessToken is shared with rag.js — both endpoints take the same OAuth bearer.
module.exports = { chat, isConfigured, config: cfg, accessToken };
