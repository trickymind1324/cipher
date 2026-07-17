'use strict';

/**
 * Kannada/English → canonical taxonomy.
 *
 * This table exists because the LLM cannot be trusted with domain vocabulary.
 * Asked about "ಸರಗಳ್ಳತನ" (chain snatching), GLM 4.7 Flash rendered it as "Cybercrime"
 * and answered about phishing — fluent Kannada, wrong crime. Entity resolution is
 * therefore done here, deterministically, *before* anything reaches the model.
 *
 * Values on the right must match the dataset exactly (see store.stats()).
 */

const CRIME_TYPES = {
	// Chain Snatching
	'ಸರಗಳ್ಳತನ': 'Chain Snatching',
	'ಸರ ಕಳವು': 'Chain Snatching',
	'ಚೈನ್ ಸ್ನಾಚಿಂಗ್': 'Chain Snatching',
	'chain snatching': 'Chain Snatching',
	'chain-snatching': 'Chain Snatching',
	'snatching': 'Chain Snatching',

	// House Burglary
	'ಮನೆ ಕಳ್ಳತನ': 'House Burglary',
	'ಮನೆಗಳ್ಳತನ': 'House Burglary',
	'ಕನ್ನ ಕಳವು': 'House Burglary',
	'burglary': 'House Burglary',
	'burglaries': 'House Burglary',
	'house burglary': 'House Burglary',
	'housebreaking': 'House Burglary',
	'break-in': 'House Burglary',

	// Vehicle Theft
	'ವಾಹನ ಕಳ್ಳತನ': 'Vehicle Theft',
	'ಬೈಕ್ ಕಳ್ಳತನ': 'Vehicle Theft',
	'vehicle theft': 'Vehicle Theft',
	'bike theft': 'Vehicle Theft',
	'motorcycle theft': 'Vehicle Theft',
	'auto theft': 'Vehicle Theft',

	// Cheating / Online Fraud
	'ವಂಚನೆ': 'Cheating / Online Fraud',
	'ಆನ್‌ಲೈನ್ ವಂಚನೆ': 'Cheating / Online Fraud',
	'ಸೈಬರ್ ಅಪರಾಧ': 'Cheating / Online Fraud',
	'fraud': 'Cheating / Online Fraud',
	'cheating': 'Cheating / Online Fraud',
	'online fraud': 'Cheating / Online Fraud',
	'cyber fraud': 'Cheating / Online Fraud',
	'cybercrime': 'Cheating / Online Fraud',
	'phishing': 'Cheating / Online Fraud',

	// Robbery
	'ದರೋಡೆ': 'Robbery',
	'robbery': 'Robbery',
	'robberies': 'Robbery',
	'dacoity': 'Robbery',

	// Assault / Hurt
	'ಹಲ್ಲೆ': 'Assault / Hurt',
	'ಗಾಯ': 'Assault / Hurt',
	'assault': 'Assault / Hurt',
	'hurt': 'Assault / Hurt',
	'attack': 'Assault / Hurt',

	// Narcotics
	'ಮಾದಕ ವಸ್ತು': 'Narcotics Possession',
	'ಡ್ರಗ್ಸ್': 'Narcotics Possession',
	'narcotics': 'Narcotics Possession',
	'drugs': 'Narcotics Possession',
	'ndps': 'Narcotics Possession',
};

// Kannada is agglutinative: case endings attach to the noun and mutate its final vowel
// ("ಬೆಂಗಳೂರು" → "ಬೆಂಗಳೂರಿನಲ್ಲಿ", *in* Bengaluru). Matching the full nominative form would
// miss every inflected mention, so place names are matched on their stem instead.
const DISTRICTS = {
	'ಬೆಂಗಳೂರು ಉತ್ತರ': 'Bengaluru North',
	'ಬೆಂಗಳೂರ': 'Bengaluru North', // stem: covers ಬೆಂಗಳೂರು / ಬೆಂಗಳೂರಿನಲ್ಲಿ / ಬೆಂಗಳೂರಿನ
	'bengaluru north': 'Bengaluru North',
	'bangalore north': 'Bengaluru North',
	'bengaluru': 'Bengaluru North',
	'bangalore': 'Bengaluru North',
	'ಮೈಸೂರ': 'Mysuru', // stem: ಮೈಸೂರು / ಮೈಸೂರಿನಲ್ಲಿ
	mysuru: 'Mysuru',
	mysore: 'Mysuru',
	'ಕಲಬುರಗಿ': 'Kalaburagi', // stem is stable; suffixes append (ಕಲಬುರಗಿಯಲ್ಲಿ)
	kalaburagi: 'Kalaburagi',
	gulbarga: 'Kalaburagi',
};

// Station jurisdiction areas (the ER schema has no taluk level; areas map to Units).
const AREAS = {
	'ಯಲಹಂಕ': 'Yelahanka',
	yelahanka: 'Yelahanka',
	'ಹೆಬ್ಬಾಳ': 'Hebbal',
	hebbal: 'Hebbal',
	'ಪೀಣ್ಯ': 'Peenya',
	peenya: 'Peenya',
	'rt nagar': 'RT Nagar',
	'ಆರ್‌ಟಿ ನಗರ': 'RT Nagar',
	krishnaraja: 'Krishnaraja',
	nanjangud: 'Nanjangud',
	hunsur: 'Hunsur',
	'kalaburagi city': 'Kalaburagi City',
	aland: 'Aland',
	chittapur: 'Chittapur',
};

/** Longest-match-first so "bengaluru north" beats "bengaluru". */
const matchLongest = (text, table) => {
	const hay = text.toLowerCase();
	let best = null;
	for (const [term, canonical] of Object.entries(table)) {
		const t = term.toLowerCase();
		if (hay.includes(t) && (!best || t.length > best.term.length)) best = { term: t, canonical };
	}
	return best ? best.canonical : null;
};

const crimeType = (text) => matchLongest(text, CRIME_TYPES);
const district = (text) => matchLongest(text, DISTRICTS);
const area = (text) => matchLongest(text, AREAS);

/** Kannada script present → treat the turn as Kannada. */
const isKannada = (text) => /[ಀ-೿]/.test(String(text || ''));

module.exports = { crimeType, district, area, isKannada, CRIME_TYPES, DISTRICTS, AREAS };
