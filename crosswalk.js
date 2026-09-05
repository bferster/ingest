// Crosswalk & VERID (Persistent Person Identifier) Module
// Implements specifications in SKILLS/Crosswalk.md

const CROSSWALK_URLS = {
	'AUG': 'https://docs.google.com/spreadsheets/d/1OyE2864BiEAfqof6sgS8JC2IADNoXz1T7LOFje_vadw/export?format=csv'
};

const countyCrosswalkIndex = new Map();

/**
 * Construct baseline persistent person identifier (verid) for 1850 census mentions.
 * Format: <county>-VP-<century_suffix><line, zero-padded to 6 digits>
 * Examples:
 *   1850, line 1234  -> AUG-VP-50001234
 *   1850, line 234   -> AUG-VP-50000234
 *   1850, line 50234 -> AUG-VP-50050234
 */
function constructBaselineVerid(county, year, line) {
	const c = (county || 'AUG').toUpperCase().trim();
	const yr = parseInt(year, 10);
	const centurySuffix = String(yr - 1800).padStart(2, '0');
	let lineNum = String(line !== undefined && line !== null ? line : '').trim();
	const match = lineNum.match(/\d+/);
	const cleanLine = match ? match[0] : '0';
	const paddedLine = cleanLine.padStart(6, '0');
	return `${c}-VP-${centurySuffix}${paddedLine}`;
}

/**
 * Derive year from the mention's own stored source_year field,
 * never by re-parsing the mention_id string.
 */
function getYear(mention) {
	return mention ? mention.source_year : null;
}

/**
 * Load and build the crosswalk index for a county ONCE.
 * Maps later census mention IDs (object_id) to inherited verids and flags conflicts.
 */
async function buildCrosswalkIndex(county) {
	const c = (county || 'AUG').toUpperCase().trim();
	if (countyCrosswalkIndex.has(c)) {
		return countyCrosswalkIndex.get(c);
	}

	const url = CROSSWALK_URLS[c];
	if (!url) {
		if (typeof log === 'function') log(`No crosswalk URL configured for county ${c}.`);
		const emptyIndex = { objectToVerid: new Map(), objectToSubjects: new Map(), rawAssertions: [], conflicts: new Set() };
		countyCrosswalkIndex.set(c, emptyIndex);
		return emptyIndex;
	}

	if (typeof log === 'function') log(`Loading crosswalk dataset for ${c}...`);

	let rawAssertions = [];
	try {
		rawAssertions = await new Promise((resolve, reject) => {
			Papa.parse(url, {
				download: true,
				header: true,
				skipEmptyLines: true,
				transformHeader: h => h.trim(),
				complete: (results) => resolve(results.data || []),
				error: (err) => reject(err)
			});
		});
	} catch (err) {
		if (typeof log === 'function') log(`Failed to download crosswalk data: ${err.message}`, true);
		const emptyIndex = { objectToVerid: new Map(), objectToSubjects: new Map(), rawAssertions: [], conflicts: new Set() };
		countyCrosswalkIndex.set(c, emptyIndex);
		return emptyIndex;
	}

	if (typeof log === 'function') log(`Loaded ${rawAssertions.length} crosswalk rows for ${c}. Building index...`);

	const objectToSubjects = new Map();

	for (const row of rawAssertions) {
		const subj = (row.subject_id || '').trim();
		const obj = (row.object_id || '').trim();
		if (!subj || !obj) continue;

		if (!objectToSubjects.has(obj)) {
			objectToSubjects.set(obj, []);
		}
		objectToSubjects.get(obj).push({
			subject_id: subj,
			predicate: row.predicate || 'isSameAs',
			start_year: row.start_year,
			end_year: row.end_year,
			who: row.who,
			confidence: row.confidence
		});
	}

	// Helper to find 1850 ancestor recursively
	function find1850Ancestors(objId, visited = new Set()) {
		if (visited.has(objId)) return [];
		visited.add(objId);

		const links = objectToSubjects.get(objId);
		if (!links || links.length === 0) return [];

		const roots = new Set();
		for (const link of links) {
			const subjId = link.subject_id;
			if (subjId.includes('-1850-')) {
				// Reached 1850 baseline!
				roots.add(subjId);
			} else {
				// Chain further back
				const parentRoots = find1850Ancestors(subjId, new Set(visited));
				for (const r of parentRoots) roots.add(r);
			}
		}
		return Array.from(roots);
	}

	const objectToVerid = new Map();
	const conflicts = new Set();

	for (const [objId, links] of objectToSubjects.entries()) {
		const roots = find1850Ancestors(objId);
		if (roots.length === 1) {
			const root1850Id = roots[0];
			const parts = root1850Id.split('-');
			const linePart = parts[parts.length - 1];
			const verid = constructBaselineVerid(c, 1850, linePart);
			objectToVerid.set(objId, verid);
		} else if (roots.length > 1) {
			// Disagreement/multiple targets: recorded as conflict, never silently overwritten
			conflicts.add(objId);
		}
	}

	const index = {
		objectToVerid,
		objectToSubjects,
		rawAssertions,
		conflicts
	};
	countyCrosswalkIndex.set(c, index);

	if (typeof log === 'function') {
		log(`Crosswalk index for ${c} ready: ${objectToVerid.size} mentions mapped to inherited verid, ${conflicts.size} conflicts flagged.`);
	}

	return index;
}

/**
 * Initialize crosswalk for a source before batch row processing.
 * For 1850: no crosswalk index required.
 * For later years: loads & builds index ONCE.
 */
async function initCrosswalk(county, currentYear) {
	const yr = parseInt(currentYear, 10);
	if (yr === 1850) {
		return;
	}
	await buildCrosswalkIndex(county);
}

/**
 * Crosswalk() function — per SKILLS/Crosswalk.md
 * Assigns verid to mention:
 *   If current_year == 1850: assigns baseline verid.
 *   If current_year > 1850: inherits verid from crosswalk index if an unambiguous link exists,
 *                           otherwise keeps verid = null.
 */
function getCrosswalkRowValue(obj, key) {
	if (!obj) return undefined;
	if (typeof getRowValue === 'function') return getRowValue(obj, key);
	const normalize = (s) => s.toLowerCase().trim().replace(/[-_]/g, '');
	const target = normalize(key);
	const foundKey = Object.keys(obj).find(k => normalize(k) === target);
	return foundKey ? obj[foundKey] : null;
}

function Crosswalk(county, currentYear, mention, row, rowIndex) {
	const yr = parseInt(currentYear || (mention ? getYear(mention) : 1850), 10);
	const c = (county || 'AUG').toUpperCase().trim();

	if (yr === 1850) {
		let line = getCrosswalkRowValue(row, 'line');
		if (!line || String(line).trim() === '') {
			line = rowIndex >= 0 ? (rowIndex + 1) : '';
		}
		mention.verid = constructBaselineVerid(c, 1850, line);
		return;
	}

	const index = countyCrosswalkIndex.get(c);
	if (index && mention && mention.mention_id) {
		const inherited = index.objectToVerid.get(mention.mention_id);
		if (inherited) {
			mention.verid = inherited;
		} else {
			mention.verid = null;
		}
	} else {
		mention.verid = null;
	}
}

/**
 * Ingests crosswalk assertions directly from Google Sheet into PostgreSQL assertions table.
 */
async function ingestCrosswalkAssertions(county) {
	const c = (county || 'AUG').toUpperCase().trim();
	if (typeof actionSelect !== 'undefined') actionSelect.disabled = true;
	if (typeof progressSection !== 'undefined') progressSection.classList.remove('hidden');

	try {
		const index = await buildCrosswalkIndex(c);
		const rawAssertions = index.rawAssertions;
		if (!rawAssertions || rawAssertions.length === 0) {
			log(`No crosswalk assertions found to ingest for county ${c}.`);
			return;
		}

		log(`Ingesting ${rawAssertions.length} crosswalk assertions for county ${c}...`);
		const startTime = Date.now();
		const BATCH_SIZE = 1000;
		let count = 0;

		for (let i = 0; i < rawAssertions.length; i += BATCH_SIZE) {
			if (typeof stopIngestion !== 'undefined' && stopIngestion) {
				log('Crosswalk assertions ingestion stopped by user.');
				break;
			}

			const chunk = rawAssertions.slice(i, i + BATCH_SIZE);
			const batch = chunk.map(r => ({
				assertion_id: r.assertion_id && r.assertion_id.trim() ? r.assertion_id.trim() : undefined,
				subject_id: (r.subject_id || '').trim(),
				predicate: (r.predicate || 'isSameAs').trim(),
				object_id: (r.object_id || '').trim(),
				county: c,
				start_year: parseValidYear(r.start_year),
				end_year: parseValidYear(r.end_year),
				who: (r.who || 'crosswalk').trim(),
				confidence: r.confidence ? parseFloat(r.confidence) : 0.9
			})).filter(a => a.subject_id && a.predicate && a.object_id);

			try {
				const postRes = await fetch(`${POSTGREST_URL}/assertions`, {
					method: 'POST',
					headers: {
						...API_HEADERS,
						'Prefer': 'resolution=merge-duplicates'
					},
					body: JSON.stringify(batch)
				});
				if (!postRes.ok) {
					const errText = await postRes.text();
					log(`Failed to insert crosswalk assertions batch at row ${i}: ${errText}`, true);
				} else {
					count += batch.length;
				}
			} catch (err) {
				log(`Error inserting crosswalk assertion batch: ${err.message}`, true);
			}

			if (typeof updateProgress === 'function') {
				updateProgress(count, rawAssertions.length, startTime, 'crosswalk assertions ingested');
			}
		}

		log(`Finished ingesting crosswalk assertions: ${count} assertions processed.`);
	} catch (err) {
		log(`Failed to ingest crosswalk assertions: ${err.message}`, true);
	} finally {
		if (typeof actionSelect !== 'undefined') {
			actionSelect.disabled = false;
			actionSelect.value = '';
		}
	}
}

// Export for Node testing if in module environment
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		constructBaselineVerid,
		getYear,
		CROSSWALK_URLS,
		buildCrosswalkIndex,
		initCrosswalk,
		Crosswalk,
		ingestCrosswalkAssertions
	};
}
