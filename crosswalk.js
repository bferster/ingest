// Crosswalk & VERID (Persistent Person Identifier) Module
// Implements specifications in SKILLS/Crosswalk.md

const CROSSWALK_URLS = {
	'AUG': 'https://docs.google.com/spreadsheets/d/1OyE2864BiEAfqof6sgS8JC2IADNoXz1T7LOFje_vadw/export?format=csv'
};

const countyCrosswalkIndex = new Map();

/**
 * Mint persistent person identifier (verid).
 * Format: <county>-VP-<century_suffix><line, zero-padded to 6 digits>
 * century_suffix is census_year % 100, formatted as exactly two digits
 * (1850 -> "50", 1870 -> "70", 1900 -> "00", 1910 -> "10").
 * line is census line number, always zero-padded to 6 digits.
 * Total length after "<county>-VP-" is always exactly 8 characters.
 *
 * Examples:
 *   1850, line 1234  -> AUG-VP-50001234
 *   1850, line 234   -> AUG-VP-50000234
 *   1850, line 50234 -> AUG-VP-50050234
 *   1900, line 1234  -> AUG-VP-00001234
 */
function mintVerid(county, year, line) {
	const c = (county || 'AUG').toUpperCase().trim();
	const yr = parseInt(year, 10);
	const centurySuffix = String(yr % 100).padStart(2, '0');
	let lineNum = String(line !== undefined && line !== null ? line : '').trim();
	const match = lineNum.match(/\d+/);
	const cleanLine = match ? match[0] : '0';
	const paddedLine = cleanLine.padStart(6, '0');
	return `${c}-VP-${centurySuffix}${paddedLine}`;
}

// Alias for backwards compatibility
const constructBaselineVerid = mintVerid;

/**
 * Derive year from the mention's own stored source_year field,
 * never by re-parsing the mention_id string.
 */
function getYear(mention) {
	return mention ? mention.source_year : null;
}

/**
 * Helper to normalize key lookups in objects
 */
function getCrosswalkRowValue(obj, key) {
	if (!obj) return undefined;
	if (typeof getRowValue === 'function') return getRowValue(obj, key);
	const normalize = (s) => s.toLowerCase().trim().replace(/[-_]/g, '');
	const target = normalize(key);
	const foundKey = Object.keys(obj).find(k => normalize(k) === target);
	return foundKey ? obj[foundKey] : null;
}

/**
 * Load and build the crosswalk index for a county ONCE.
 * Maps later census mention IDs (object_id) to candidate earlier mentions { subject_id, who }.
 * Also preloads all known verids from the database for the county.
 */
async function buildCrosswalkIndex(county, currentYear) {
	const c = (county || 'AUG').toUpperCase().trim();
	if (countyCrosswalkIndex.has(c)) {
		return countyCrosswalkIndex.get(c);
	}

	const url = CROSSWALK_URLS[c];
	const index = {
		county: c,
		crosswalk_index: new Map(), // object_id -> [{ subject_id, who }]
		rawAssertions: [],
		knownVerids: new Map(),     // mention_id -> verid
		pendingConflicts: [],       // array of conflict records
		resolvedConflicts: []
	};

	// 1. Preload existing verids from PostgreSQL mentions table for this county
	try {
		if (typeof POSTGREST_URL !== 'undefined') {
			let offset = 0;
			const limit = 50000;
			while (true) {
				const res = await fetch(`${POSTGREST_URL}/mentions?mention_id=like.${c}-CN-*&verid=not.is.null&select=mention_id,verid&limit=${limit}&offset=${offset}`, {
					headers: (typeof API_HEADERS !== 'undefined' ? API_HEADERS : {})
				});
				if (!res.ok) break;
				const data = await res.json();
				if (!data || data.length === 0) break;
				for (const item of data) {
					if (item.mention_id && item.verid) {
						index.knownVerids.set(item.mention_id, item.verid);
					}
				}
				if (data.length < limit) break;
				offset += limit;
			}
			if (typeof log === 'function') {
				log(`Preloaded ${index.knownVerids.size} known verids from database for county ${c}.`);
			}
		}
	} catch (err) {
		if (typeof log === 'function') {
			log(`Note: Could not preload existing verids from DB: ${err.message}`);
		}
	}

	// 2. Load crosswalk assertions spreadsheet if available
	if (url) {
		if (typeof log === 'function') log(`Loading crosswalk dataset for ${c}...`);
		try {
			const rawAssertions = await new Promise((resolve, reject) => {
				if (typeof Papa === 'undefined') {
					resolve([]);
					return;
				}
				Papa.parse(url, {
					download: true,
					header: true,
					skipEmptyLines: true,
					transformHeader: h => h.trim(),
					complete: (results) => resolve(results.data || []),
					error: (err) => reject(err)
				});
			});

			index.rawAssertions = rawAssertions;

			for (const row of rawAssertions) {
				const subj = (row.subject_id || '').trim();
				const obj = (row.object_id || '').trim();
				const who = (row.who || '').trim();
				if (!subj || !obj) continue;

				if (!index.crosswalk_index.has(obj)) {
					index.crosswalk_index.set(obj, []);
				}
				index.crosswalk_index.get(obj).push({
					subject_id: subj,
					who: who
				});
			}

			if (typeof log === 'function') {
				log(`Crosswalk index built for ${c}: ${rawAssertions.length} links indexed across ${index.crosswalk_index.size} target mentions.`);
			}
		} catch (err) {
			if (typeof log === 'function') log(`Failed to download crosswalk data: ${err.message}`, true);
		}
	} else {
		if (typeof log === 'function') log(`No crosswalk URL configured for county ${c}.`);
	}

	countyCrosswalkIndex.set(c, index);
	return index;
}

/**
 * Initialize crosswalk for a source before batch row processing.
 * current_year must always be passed explicitly. No default value.
 */
async function initCrosswalk(county, currentYear) {
	if (!currentYear) {
		throw new Error('current_year must always be passed explicitly. No default value.');
	}
	await buildCrosswalkIndex(county, currentYear);
}

/**
 * Helper to retrieve an earlier subject mention's existing verid.
 */
function getSubjectVerid(index, county, subjectId) {
	if (!subjectId) return null;

	// 1. Check known verids map (from DB or current run)
	if (index && index.knownVerids && index.knownVerids.has(subjectId)) {
		return index.knownVerids.get(subjectId);
	}

	// 2. If subject is an 1850 census mention, its verid was minted by standard construction
	const mMatch = subjectId.match(/^([A-Za-z]+)-CN-1850-(\d+)$/);
	if (mMatch) {
		return mintVerid(mMatch[1], 1850, mMatch[2]);
	}

	return null;
}

/**
 * Crosswalk() function — per SKILLS/Crosswalk.md
 *
 * Crosswalk(county, current_year):
 *   current_year must always be passed explicitly. No default value.
 *
 *   Every mention gets a verid. A mention without one is indistinguishable
 *   from a missing record or an ingest failure, so verid is never left null.
 *   A mention either inherits a verid from an earlier mention of the same person,
 *   or mints its own. Inheritance is preferred; minting is the fallback,
 *   never the absence of a value.
 */
function Crosswalk(county, currentYear, mentionOrMentions, row, rowIndex) {
	if (!currentYear) {
		throw new Error('current_year must always be passed explicitly. No default value.');
	}

	const c = (county || 'AUG').toUpperCase().trim();
	const yr = parseInt(currentYear, 10);

	let index = countyCrosswalkIndex.get(c);
	if (!index) {
		// Fallback empty index if called before async init completes
		index = {
			county: c,
			crosswalk_index: new Map(),
			rawAssertions: [],
			knownVerids: new Map(),
			pendingConflicts: []
		};
		countyCrosswalkIndex.set(c, index);
	}

	const mentions = Array.isArray(mentionOrMentions) ? mentionOrMentions : [mentionOrMentions];

	for (const m of mentions) {
		if (!m) continue;

		let line = getCrosswalkRowValue(row, 'line') || (m && m.line);
		if (!line || String(line).trim() === '') {
			if (m.mention_id) {
				const parts = m.mention_id.split('-');
				line = parts[parts.length - 1];
			} else if (rowIndex >= 0) {
				line = rowIndex + 1;
			} else {
				line = '1';
			}
		}

		// Look up candidate links from earlier censuses
		const candidates = (m.mention_id && index.crosswalk_index.has(m.mention_id))
			? index.crosswalk_index.get(m.mention_id)
			: [];

		// Case 1: Candidates is empty -> Mint fresh verid
		if (!candidates || candidates.length === 0) {
			m.verid = mintVerid(c, yr, line);
			if (m.mention_id) index.knownVerids.set(m.mention_id, m.verid);
			continue;
		}

		// Group candidates by subject_id, collecting who values for each
		const grouped = new Map(); // subject_id -> [who]
		for (const cand of candidates) {
			const subj = (cand.subject_id || '').trim();
			if (!subj) continue;
			if (!grouped.has(subj)) grouped.set(subj, []);
			grouped.get(subj).push((cand.who || 'unknown').trim());
		}

		const distinctSubjects = Array.from(grouped.keys());

		// If no valid subject IDs parsed
		if (distinctSubjects.length === 0) {
			m.verid = mintVerid(c, yr, line);
			if (m.mention_id) index.knownVerids.set(m.mention_id, m.verid);
			continue;
		}

		// Case 2: Exactly one distinct subject_id -> Inherit
		if (distinctSubjects.length === 1) {
			const subjId = distinctSubjects[0];
			const inheritedVerid = getSubjectVerid(index, c, subjId);
			if (inheritedVerid) {
				m.verid = inheritedVerid;
			} else {
				// Fallback to minting if the earlier mention holds no known verid
				m.verid = mintVerid(c, yr, line);
			}
			if (m.mention_id) index.knownVerids.set(m.mention_id, m.verid);
			continue;
		}

		// Case 3: Two or more sources agree on the same subject_id, and it is the majority among the candidates
		const totalCandidates = candidates.length;
		let majoritySubject = null;
		let majorityWho = null;

		for (const [subjId, whoList] of grouped.entries()) {
			if (whoList.length >= 2 && whoList.length > totalCandidates / 2) {
				majoritySubject = subjId;
				majorityWho = whoList;
				break;
			}
		}

		if (majoritySubject) {
			// Inherit that subject mention's verid
			const inheritedVerid = getSubjectVerid(index, c, majoritySubject);
			m.verid = inheritedVerid || mintVerid(c, yr, line);
			if (m.mention_id) index.knownVerids.set(m.mention_id, m.verid);

			const dissenting = candidates
				.filter(cand => cand.subject_id !== majoritySubject)
				.map(cand => `${cand.who || 'unknown'} -> ${cand.subject_id}`);

			if (typeof log === 'function') {
				log(`Crosswalk majority agreement for ${m.mention_id} -> ${majoritySubject} (agreed: [${majorityWho.join(', ')}], dissented: [${dissenting.join(', ')}])`);
			}
		} else {
			// Case 4: Sources disagree with no majority.
			// Mint a fresh verid for m using the construction above.
			// Write a conflict record (see Resolution below).
			// Do NOT leave verid null. Do NOT pick a default source as a tiebreaker.
			m.verid = mintVerid(c, yr, line);
			if (m.mention_id) index.knownVerids.set(m.mention_id, m.verid);

			const whoByCandidate = {};
			for (const [subjId, whoList] of grouped.entries()) {
				whoByCandidate[subjId] = whoList;
			}

			const conflictRecord = {
				mention_id: m.mention_id,
				candidate_subject_ids: distinctSubjects,
				who_by_candidate: whoByCandidate,
				current_year: yr,
				logged_date: new Date().toISOString(),
				status: 'open'
			};

			index.pendingConflicts.push(conflictRecord);

			if (typeof log === 'function') {
				log(`Crosswalk conflict for ${m.mention_id}: ${distinctSubjects.length} candidate targets with no majority. Minted fresh verid ${m.verid}. Conflict recorded.`);
			}
		}
	}
}

/**
 * Persist any pending conflict records to the conflicts table in PostgreSQL.
 */
async function flushCrosswalkConflicts(county) {
	const c = (county || 'AUG').toUpperCase().trim();
	const index = countyCrosswalkIndex.get(c);
	if (!index || !index.pendingConflicts || index.pendingConflicts.length === 0) {
		return;
	}

	const conflictsToSave = [...index.pendingConflicts];
	index.pendingConflicts = [];

	if (typeof log === 'function') {
		log(`Writing ${conflictsToSave.length} crosswalk conflict records to database...`);
	}

	const BATCH_SIZE = 500;
	for (let i = 0; i < conflictsToSave.length; i += BATCH_SIZE) {
		const chunk = conflictsToSave.slice(i, i + BATCH_SIZE);
		try {
			const postRes = await fetch(`${POSTGREST_URL}/conflicts`, {
				method: 'POST',
				headers: {
					...API_HEADERS,
					'Prefer': 'return=minimal'
				},
				body: JSON.stringify(chunk)
			});
			if (!postRes.ok) {
				const errText = await postRes.text();
				if (typeof log === 'function') log(`Failed to save conflicts batch: ${errText}`, true);
			}
		} catch (err) {
			if (typeof log === 'function') log(`Error writing conflicts to database: ${err.message}`, true);
		}
	}
}

/**
 * Supersede procedure per SKILLS/Crosswalk.md
 *
 * When two verids are found to refer to the same person:
 *   - The verid anchored at the earlier mention survives.
 *   - The later verid is retired.
 *   - A row is written to the supersede table:
 *       retired_verid, surviving_verid, reason, who, decided_date
 *   - Mentions carrying the retired verid are updated to the surviving one.
 *   - The retired verid is never reused and never deleted.
 */
async function recordSupersede(retiredVerid, survivingVerid, reason, who) {
	if (!retiredVerid || !survivingVerid) {
		throw new Error('Both retiredVerid and survivingVerid are required for supersede.');
	}

	if (typeof log === 'function') {
		log(`Recording supersede: ${retiredVerid} -> ${survivingVerid} (Reason: ${reason || 'none'}, By: ${who || 'system'})`);
	}

	// 1. Write row to supersede table
	const supersedeRecord = {
		retired_verid: retiredVerid,
		surviving_verid: survivingVerid,
		reason: reason || null,
		who: who || 'human',
		decided_date: new Date().toISOString()
	};

	const postRes = await fetch(`${POSTGREST_URL}/supersede`, {
		method: 'POST',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation'
		},
		body: JSON.stringify([supersedeRecord])
	});

	if (!postRes.ok) {
		const err = await postRes.text();
		throw new Error(`Failed to write to supersede table: ${err}`);
	}

	// 2. Update mentions carrying the retired verid to the surviving verid
	const patchRes = await fetch(`${POSTGREST_URL}/mentions?verid=eq.${retiredVerid}`, {
		method: 'PATCH',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation'
		},
		body: JSON.stringify({ verid: survivingVerid })
	});

	if (!patchRes.ok) {
		const err = await patchRes.text();
		throw new Error(`Failed to update mentions from ${retiredVerid} to ${survivingVerid}: ${err}`);
	}

	if (typeof log === 'function') {
		log(`Successfully superseded ${retiredVerid} with ${survivingVerid}. Mentions updated.`);
	}
}

/**
 * Resolve a conflict record:
 * - 'resolved-supersede': supersedes the mention's minted verid with the chosen candidate's verid.
 * - 'resolved-distinct': closes conflict and keeps the minted verid.
 */
async function resolveConflict(conflictId, resolutionType, options = {}) {
	if (!conflictId) throw new Error('conflictId is required');

	if (resolutionType === 'resolved-supersede') {
		const { retiredVerid, survivingVerid, reason, who } = options;
		await recordSupersede(retiredVerid, survivingVerid, reason, who);
	}

	const patchRes = await fetch(`${POSTGREST_URL}/conflicts?conflict_id=eq.${conflictId}`, {
		method: 'PATCH',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation'
		},
		body: JSON.stringify({ status: resolutionType })
	});

	if (!patchRes.ok) {
		const err = await patchRes.text();
		throw new Error(`Failed to update conflict status: ${err}`);
	}

	if (typeof log === 'function') {
		log(`Conflict ${conflictId} marked as ${resolutionType}.`);
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
		const index = await buildCrosswalkIndex(c, 1860);
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
		mintVerid,
		constructBaselineVerid,
		getYear,
		CROSSWALK_URLS,
		buildCrosswalkIndex,
		initCrosswalk,
		Crosswalk,
		flushCrosswalkConflicts,
		recordSupersede,
		resolveConflict,
		ingestCrosswalkAssertions
	};
}
