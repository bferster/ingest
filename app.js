const POSTGREST_URL = '/pgrst';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const API_HEADERS = {
	'Content-Type': 'application/json',
	'Authorization': `Bearer ${JWT_TOKEN}`
};
let sourcesData = [];
let currentCsvData = [];
let selectedSource = null;
let currentConfidence = 1.0;
let stopIngestion = false;

class MentionIdGenerator {
	constructor() {
		this.usedIds = {};
	}
	generate(county, type, year, line) {
		let cleanLine = String(line || '').trim();
		if (!cleanLine) {
			cleanLine = 'unknown';
		}
		const baseId = `${county}-${type}-${year}-${cleanLine}`;
		if (this.usedIds[baseId] === undefined) {
			this.usedIds[baseId] = 0;
			return baseId;
		} else {
			this.usedIds[baseId]++;
			return `${baseId}.${this.usedIds[baseId]}`;
		}
	}
}

function getFormatParams(format, sourceYear) {
	let type = '';
	let year = sourceYear;
	if (format.includes('Census')) {
		type = 'CN';
		year = format.includes('1880') ? '1880' : '1870';
	} else if (format.includes('FindAGrave')) {
		type = 'FG';
		year = '1600';
	} else if (format.includes('Church')) {
		type = 'CH';
		year = '1851';
	} else if (format.includes('FreeBlackRegister')) {
		type = 'FBR';
		year = '1800';
	} else if (format.includes('FreedmansList')) {
		type = 'FL';
		year = '1865';
	} else if (format.includes('SlaveSchedule')) {
		type = 'SS';
		year = sourceYear;
	} else if (format.includes('VitalRecord')) {
		type = 'VR';
		year = '1715';
	}
	return { type: type || 'GEN', year: year || sourceYear };
}

let idGenerator = new MentionIdGenerator();
let householdMap = new Map();
let familyMap = new Map();

const sourceSelect = document.getElementById('source-select');
const processBtn = document.getElementById('process-btn');
const limitCheckbox = document.getElementById('limit-checkbox');
const stopBtn = document.getElementById('stop-btn');
const previewSection = document.getElementById('preview-section');
const progressSection = document.getElementById('progress-section');
const logOutput = document.getElementById('log-output');
const previewHeaders = document.getElementById('preview-headers');
const previewBody = document.getElementById('preview-body');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const actionSelect = document.getElementById('action-select');

// Helper to fetch all existing assertion keys for a specific 'who' tag
async function fetchExistingAssertionKeys(who) {
	const keys = new Set();
	let offset = 0;
	const limit = 2000;
	while (true) {
		const res = await fetch(`${POSTGREST_URL}/assertions?who=eq.${who}&select=subject_id,predicate,object_id,object_string&limit=${limit}&offset=${offset}&order=assertion_id.asc`, { headers: API_HEADERS });
		if (!res.ok) {
			log(`Warning: Failed to fetch existing assertions for ${who} at offset ${offset}`, true);
			break;
		}
		const data = await res.json();
		if (data.length === 0) break;
		data.forEach(a => {
			const obj = a.object_id || a.object_string || 'null';
			keys.add(`${a.subject_id}|${a.predicate}|${obj}`);
		});
		if (data.length < limit) break;
		offset += limit;
	}
	return keys;
}


function log(message, isError = false) {
	const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
	const logLine = `[${timestamp}] ${message}\n`;
	logOutput.textContent += logLine;
	logOutput.scrollTop = logOutput.scrollHeight;
	if (isError) {
		console.error(message);
	} else {
		console.log(message);
	}
}

// 1. Load sources.csv
async function loadSources() {
	try {
		log('Loading sources.csv...');
		// Add cache buster so the browser doesn't load a stale CSV
		Papa.parse('sources.csv?' + new Date().getTime(), {
			download: true,
			header: true,
			skipEmptyLines: true,
			transformHeader: h => h.trim(),
			transform: (value) => {
				let val = value.trim();
				if (val.startsWith('"') && val.endsWith('"')) {
					val = val.slice(1, -1);
				}
				return val;
			},
			complete: function (results) {
				sourcesData = results.data;
				populateSourceDropdown();
				log(`Loaded ${sourcesData.length} sources.`);
			},
			error: function (err) {
				log(`Error loading sources.csv: ${err}`, true);
			}
		});
	} catch (err) {
		log(`Failed to load sources: ${err.message}`, true);
	}
}

function populateSourceDropdown() {
	sourceSelect.innerHTML = '<option value="">-- Select a source --</option>';
	sourcesData.forEach((source, index) => {
		if (source.display_name) {
			const option = document.createElement('option');
			option.value = index;
			option.textContent = source.display_name;
			sourceSelect.appendChild(option);
		}
	});
	sourceSelect.addEventListener('change', () => {
		if (sourceSelect.value !== "") {
			loadSourcePreview();
		} else {
			previewSection.classList.add('hidden');
			progressSection.classList.add('hidden');
		}
	});
}

// 2. Load Preview
async function loadSourcePreview() {
	const selectedIndex = sourceSelect.value;
	if (selectedIndex === "") return;

	selectedSource = sourcesData[selectedIndex];
	const url = selectedSource.url;

	log(`Loading data from URL: ${url}`);
	previewSection.classList.add('hidden');

	Papa.parse(url, {
		download: true,
		header: true,
		skipEmptyLines: true,
		transformHeader: h => h.trim(),
		transform: (value) => {
			let val = value.trim();
			if (val.startsWith('"') && val.endsWith('"')) {
				val = val.slice(1, -1);
			}
			return val;
		},
		complete: async function (results) {
			currentCsvData = results.data;
			log(`Successfully parsed ${currentCsvData.length} rows.`);
			showPreview();

			// Try to fetch confidence from the format .md file
			let formatFileName = selectedSource.format;
			// The CSV might say '1870Census.md' instead of '1870CensusFormat.md'
			if (formatFileName && !formatFileName.includes('Format')) {
				formatFileName = formatFileName.replace('.md', 'Format.md');
			}
			if (!formatFileName) {
				// Try guessing from display_name
				formatFileName = selectedSource.display_name.replace(/\s+/g, '') + 'Format.md';
			}

			try {
				// Add cache buster to bypass browser caching of .md files
				const mdRes = await fetch(`SKILLS/${formatFileName}?${new Date().getTime()}`);
				if (mdRes.ok) {
					const mdText = await mdRes.text();
					const match = mdText.match(/confidence field is set to\s*([0-9.]+)/i);
					if (match && match[1]) {
						currentConfidence = parseFloat(match[1]);
						log(`Parsed confidence ${currentConfidence} from ${formatFileName}.`);
					} else {
						currentConfidence = 1.0;
						log(`No confidence specified in ${formatFileName}, defaulting to 1.0.`);
					}
				} else {
					currentConfidence = 1.0;
					log(`Format file ${formatFileName} not found, defaulting confidence to 1.0.`);
				}
			} catch (e) {
				currentConfidence = 1.0;
				log(`Error reading format file, defaulting confidence to 1.0.`);
			}
		},
		error: function (err) {
			log(`Error parsing CSV: ${err}`, true);
		}
	});
}

function showPreview() {
	if (currentCsvData.length === 0) {
		log("CSV is empty.");
		return;
	}

	// Clear previous
	previewHeaders.innerHTML = '';
	previewBody.innerHTML = '';

	// Headers
	const headers = Object.keys(currentCsvData[0]);
	headers.forEach(h => {
		const th = document.createElement('th');
		th.textContent = h;
		previewHeaders.appendChild(th);
	});

	// Rows (up to 30)
	const previewRows = currentCsvData.slice(0, 30);
	previewRows.forEach(row => {
		const tr = document.createElement('tr');
		headers.forEach(h => {
			const td = document.createElement('td');
			td.textContent = row[h] || '';
			tr.appendChild(td);
		});
		previewBody.appendChild(tr);
	});

	previewSection.classList.remove('hidden');
	processBtn.disabled = false;
}

// 3. Process File
processBtn.addEventListener('click', async () => {
	processBtn.disabled = true;
	stopBtn.disabled = false;
	previewSection.classList.add('hidden');
	progressSection.classList.remove('hidden');
	stopIngestion = false;

	// Reset ID generator for the current source run
	idGenerator = new MentionIdGenerator();

	try {
		// Pre-calculate household and family IDs (Census formats carry-forward logic)
		householdMap.clear();
		familyMap.clear();
		if (selectedSource.format.includes('Census')) {
			let lastDwelling = null;
			let lastFamily = null;
			for (let i = 0; i < currentCsvData.length; i++) {
				const row = currentCsvData[i];
				let rawDwelling = getRowValue(row, 'dwelling');
				let rawFamily = getRowValue(row, 'family');

				if (rawDwelling !== null && rawDwelling !== undefined && String(rawDwelling).trim() !== '') {
					lastDwelling = String(rawDwelling).trim();
					rawDwelling = lastDwelling;
				} else {
					rawDwelling = lastDwelling;
				}

				if (rawFamily !== null && rawFamily !== undefined && String(rawFamily).trim() !== '') {
					lastFamily = String(rawFamily).trim();
					rawFamily = lastFamily;
				} else {
					rawFamily = lastFamily;
				}

				const hId = rawDwelling ? `HC${selectedSource.year}-${rawDwelling}` : null;
				const fId = rawFamily ? `FC${selectedSource.year}-${rawFamily}` : null;

				if (hId) householdMap.set(i, hId);
				if (fId) familyMap.set(i, fId);
			}
		}

		const useLimit = limitCheckbox.checked;
		const totalRows = useLimit ? Math.min(50, currentCsvData.length) : currentCsvData.length;
		let processedRows = 0;

		log(`Starting ingestion of ${totalRows} rows${useLimit ? ' (Limited to 50)' : ''}...`);
		const startTime = Date.now();

		// Fast deduplication check removed as per instructions
		const dbSource = await getDatabaseSource(selectedSource);

		const BATCH_SIZE = 100;
		let batch = [];

		for (let i = 0; i < totalRows; i++) {
			if (stopIngestion) {
				log(`Ingestion stopped by user at row ${i}.`);
				break;
			}

			const row = currentCsvData[i];
			const originalDataStr = JSON.stringify(row);

			// Duplicate check removed as per instructions

			try {
				const mention = await prepareMention(row, i);
				batch.push(mention);

				if (batch.length >= BATCH_SIZE || i === totalRows - 1) {
					await insertBatch(batch);
					processedRows += batch.length;
					batch = [];
					updateProgress(processedRows, totalRows, startTime);
				}
			} catch (err) {
				log(`Error processing batch near row ${i + 1}: ${err.message}`, true);
			}
		}

		// Final progress update if needed
		updateProgress(processedRows, totalRows, startTime);
		log(`Finished row ingestion.`);

		// Post-hoc Mentions and Assertions
		if (stopIngestion) {
			log('Ingestion stopped by user. Finalizing processed rows...');
		} else {
			log('Ingestion complete. Starting post-hoc processing...');
		}

		try {
			await processPostHocMentions();
			await processPostHocAssertions();
		} catch (err) {
			log(`Failed post-hoc processing: ${err.message}`, true);
		}

		log(`Ingestion batch complete.`);
	} catch (globalErr) {
		log(`Fatal Ingestion Error: ${globalErr.message}`, true);
	} finally {
		processBtn.disabled = false;
		stopBtn.disabled = true;
	}
});

async function insertBatch(batch) {
	if (batch.length === 0) return;
	const postRes = await fetch(`${POSTGREST_URL}/mentions`, {
		method: 'POST',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation,resolution=merge-duplicates'
		},
		body: JSON.stringify(batch)
	});

	if (!postRes.ok) {
		const err = await postRes.text();
		throw new Error(`Batch insert failed: ${err}`);
	}
}

stopBtn.addEventListener('click', () => {
	stopIngestion = true;
	stopBtn.disabled = true;
	log('Stop signal received. Stopping after current row completes...');
});

function updateProgress(processed, total, startTime, stage = 'rows processed') {
	const percentage = Math.round((processed / total) * 100);
	progressFill.style.width = `${percentage}%`;

	let estText = '';
	if (processed >= 5 && startTime) {
		const elapsed = (Date.now() - startTime) / 1000; // in seconds
		const timePerRow = elapsed / processed;
		const remaining = (total - processed) * timePerRow;

		const mins = Math.floor(remaining / 60);
		const secs = Math.floor(remaining % 60);
		estText = ` (Est. remaining: ${mins}m ${secs}s)`;
	}

	progressText.textContent = `${processed} / ${total} ${stage}${estText}`;
}

// Sub-functions for processing
// Helper for robust field lookup (handles case, whitespace, hyphens vs underscores)
function getRowValue(obj, key) {
	if (!obj) return undefined;
	const normalize = (s) => s.toLowerCase().trim().replace(/[-_]/g, '');
	const target = normalize(key);
	const foundKey = Object.keys(obj).find(k => normalize(k) === target);
	return foundKey ? obj[foundKey] : null;
}

async function prepareMention(row, rowIndex = -1) {
	// 1. Extract full_name and basic normalization
	const firstName = row.first_name || row.FirstName || row.GivenName || '';
	const middleName = row.middle_name || row.MiddleName || '';
	const lastName = row.last_name || row.LastName || row.Surname || '';
	const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();


	// 3. Normalize fields (Stubbing the advanced logic outlined in Normalize.md)
	const nysiisLastName = simpleNysiis(lastName);
	const normFirstName = normalizeFirstName(firstName);
	const rawOccupation = (row.occupation || row.Occupation || '').trim();
	const normOccupation = normalizeOccupation(rawOccupation);
	const normRace = simpleRaceNorm(row.race || row.Race || '');

	let computedBirthYear = null;
	if (row.birth_year || row.BirthYear || row.birthYear) {
		computedBirthYear = parseInt(row.birth_year || row.BirthYear || row.birthYear);
	} else if (row.age || row.Age) {
		const age = parseInt(row.age || row.Age);
		if (!isNaN(age)) {
			computedBirthYear = selectedSource.year - age;
		}
	}
	if (isNaN(computedBirthYear)) computedBirthYear = null;

	const deathYear = (row.death_year || row.DeathYear) ? parseInt(row.death_year || row.DeathYear) : null;

	const format = selectedSource.format || '';
	const county = selectedSource.county || 'ALB';
	const { type, year } = getFormatParams(format, selectedSource.year);
	const line = getRowValue(row, 'line') || '';
	const mId = idGenerator.generate(county, type, year, line);

	// 4. Construct Mention Object
	const mention = {
		mention_id: mId,
		source: await getDatabaseSource(selectedSource),
		source_year: parseInt(selectedSource.year),
		county: selectedSource.county || '',
		original_data: row, // will be converted to JSONB by PostgREST
		confidence: currentConfidence,
		full_name: fullName,
		first_name: firstName,
		middle_name: middleName,
		last_name: lastName,
		birth_year: computedBirthYear,
		death_year: isNaN(deathYear) ? null : deathYear,
		race: (row.race || row.Race) ? String(row.race || row.Race).toUpperCase() : null,
		gender: (row.gender || row.Gender || row.Sex) ? String(row.gender || row.Gender || row.Sex).toUpperCase() : null,
		occupation: rawOccupation,
		norm_first_name: normFirstName,
		nysiis_last_name: nysiisLastName,
		norm_race: normRace,
		norm_occupation: normOccupation,
		is_enslaver: String(row.is_enslaver || row.IsEnslaver || '').toUpperCase() === 'Y' || String(row.is_enslaver || row.IsEnslaver || '').toLowerCase() === 'TRUE',
		head: String(row.head || row.Head || '').toUpperCase() === 'Y' || String(row.head || row.Head || '').toLowerCase() === 'TRUE',
		legal_status: '', // Default
		household_id: rowIndex >= 0 ? (householdMap.get(rowIndex) || null) : null,
		family_id: rowIndex >= 0 ? (familyMap.get(rowIndex) || null) : null
	};

	applyFormatSpecificRules(mention, row);
	return mention;
}

async function getDatabaseSource(source) {
	const format = source.format || '';
	if (format.includes('SlaveSchedule')) return `ALB_SS-${source.year}`;
	if (format.includes('FreeBlackRegister')) return "ALB_FBR";
	if (format.includes('FindAGrave')) return "ALB_FindAGrave";
	if (format.includes('FreedmansList')) return "ALB_FL-1865";
	if (format.includes('VitalRecord')) return "ALB_VR_1715";
	return source.display_name;
}

async function applyFormatSpecificRules(mention, row) {
	const format = selectedSource.format || '';

	// Census Formats (1870, 1880)
	if (format.includes('Census')) {
		mention.legal_status = 'F';
	}

	// FreeBlackRegister
	if (format.includes('FreeBlackRegister')) {
		mention.legal_status = 'F';
		mention.confidence = 0.85;

		// Date column override for source_year
		const rawDate = row.date || row.Date || '';
		if (rawDate) {
			const yr = parseInt(rawDate);
			if (!isNaN(yr)) mention.source_year = yr;
		}

		// Race logic based on color
		const color = (row.color || row.Color || '').toLowerCase();
		if (color.includes('light') || color.includes('mulatto') || color.includes('brown') || color.includes('olive') || color.includes('tawny')) {
			mention.race = 'M';
			mention.norm_race = 'B';
		} else if (color.includes('yellow') || color.includes('indian')) {
			mention.race = 'I';
			mention.norm_race = 'B';
		} else {
			mention.race = 'B';
			mention.norm_race = 'B';
		}

		// Height translation
		if (row.height) {
			const match = row.height.match(/(\d+)\s*'\s*(\d+)\s*"?/);
			if (match) {
				const inches = parseInt(match[1]) * 12 + parseInt(match[2]);
				mention.original_data.height = inches;
			}
		} else if (row.Height) {
			const match = row.Height.match(/(\d+)\s*'\s*(\d+)\s*"?/);
			if (match) {
				const inches = parseInt(match[1]) * 12 + parseInt(match[2]);
				mention.original_data.Height = inches;
			}
		}
	}

	// FindAGrave
	if (format.includes('FindAGrave')) {
		mention.confidence = 0.8;
	}

	// FreedmansList
	if (format.includes('FreedmansList')) {
		mention.legal_status = 'F';
		mention.norm_race = 'B';
		if (row.record_year) {
			const yr = parseInt(row.record_year);
			if (!isNaN(yr)) mention.source_year = yr;
		}
	}

	// VitalRecord
	if (format.includes('VitalRecord')) {
		mention.confidence = 0.84;
		if (row.record_year) {
			const yr = parseInt(row.record_year);
			if (!isNaN(yr)) mention.source_year = yr;
		} else if (row.birth_year) {
			const yr = parseInt(row.birth_year);
			if (!isNaN(yr)) mention.source_year = yr;
		}
	}

	// Church
	if (format.includes('Church')) {
		mention.confidence = 0.8;
	}

	// SlaveSchedule
	if (format.includes('SlaveSchedule')) {
		mention.legal_status = 'E';
		mention.confidence = 0.82;
	}
}

async function createAssertions(mention, row) {
	// Assertions are created here based on the format .md files
	// Since we don't have the specific format files parsed, we stub this out.
	// E.g., check for explicit relationships and POST to /assertions
}

async function processPostHocMentions() {
	log('Starting Post-Hoc Mentions processing...');

	const dbSource = await getDatabaseSource(selectedSource);

	// Deduplicate mentions before further processing
	await removeDuplicateMentions(dbSource);

	if (selectedSource.format.includes('Census')) {
		log('Household and family IDs pre-populated during ingestion. Skipping post-hoc updates.');
		return;
	}

	let allMentions = [];
	let offset = 0;
	const limit = 1000;

	while (true) {
		const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
		if (!res.ok) {
			throw new Error('Failed to fetch mentions for post-hoc processing');
		}
		const data = await res.json();
		if (data.length === 0) break;
		allMentions = allMentions.concat(data);
		if (data.length < limit) break;
		offset += limit;
	}

	const mentions = allMentions;

	if (selectedSource.format.includes('SlaveSchedule')) {
		await processEnslaverMentions(mentions);
		return;
	}

	if (selectedSource.format.includes('VitalRecord')) {
		await processVitalRecordPostHoc(mentions);
		return;
	}

	if (selectedSource.format.includes('Church')) {
		await processChurchEnslaverMentions(mentions);
		return;
	}

	if (!selectedSource.format.includes('Census')) {
		log('Skipping Census post-hoc processing for non-census format.');
		return;
	}

	// Sort mentions by line number to ensure carry-forward logic works correctly
	mentions.sort((a, b) => {
		const lineA = parseInt(getRowValue(a.original_data, 'line') || 0);
		const lineB = parseInt(getRowValue(b.original_data, 'line') || 0);
		return lineA - lineB;
	});

	// Group by source_year and dwelling/family (Census logic)
	log(`Found ${mentions.length} mentions to check for household/family IDs.`);

	// Group mention IDs by their combined target IDs to minimize requests
	const updateGroups = {}; // "hId|fId" -> [mention_id]

	let lastDwelling = null;
	let lastFamily = null;

	mentions.forEach(m => {
		if (!m.source_year || !m.original_data) return;

		// Use robust field lookup for dwelling and family
		let rawDwelling = getRowValue(m.original_data, 'dwelling');
		let rawFamily = getRowValue(m.original_data, 'family');

		// Carry-forward logic: if blank, use the last seen value
		if (rawDwelling !== null && rawDwelling !== undefined && String(rawDwelling).trim() !== '') {
			lastDwelling = String(rawDwelling).trim();
			rawDwelling = lastDwelling;
		} else {
			rawDwelling = lastDwelling;
		}

		if (rawFamily !== null && rawFamily !== undefined && String(rawFamily).trim() !== '') {
			lastFamily = String(rawFamily).trim();
			rawFamily = lastFamily;
		} else {
			rawFamily = lastFamily;
		}

		const hId = rawDwelling ? `HC${m.source_year}-${rawDwelling}` : null;
		const fId = rawFamily ? `FC${m.source_year}-${rawFamily}` : null;

		if (!hId && !fId) return;

		const key = `${hId || ''}|${fId || ''}`;
		if (!updateGroups[key]) updateGroups[key] = [];
		updateGroups[key].push(m.mention_id);
	});

	const keys = Object.keys(updateGroups);
	log(`Updating ${keys.length} combined household/family groups...`);

	let processed = 0;
	const total = keys.length;
	const startTime = Date.now();

	// Process updates with a concurrency limit
	const CONCURRENCY = 10;
	for (let i = 0; i < keys.length; i += CONCURRENCY) {
		const chunk = keys.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (key) => {
			const [hId, fId] = key.split('|');
			const ids = updateGroups[key];
			const updateData = {};
			if (hId) updateData.household_id = hId;
			if (fId) updateData.family_id = fId;

			try {
				// Chunk IDs if there are too many for a single URL
				for (let j = 0; j < ids.length; j += 100) {
					const idChunk = ids.slice(j, j + 100);
					// Quote UUIDs to ensure PostgREST parses them correctly
					const idList = idChunk.map(id => `"${id}"`).join(',');
					await fetch(`${POSTGREST_URL}/mentions?mention_id=in.(${idList})`, {
						method: 'PATCH',
						headers: API_HEADERS,
						body: JSON.stringify(updateData)
					});
				}
			} catch (err) {
				log(`Failed to update group ${key}: ${err.message}`, true);
			}
			processed++;
		}));
		updateProgress(processed, total, startTime, 'household/family groups updated');
	}
}

async function processEnslaverMentions(mentions) {
	log('Processing Enslaver Mentions for Slave Schedule...');

	const enslaved = mentions.filter(m => m.legal_status === 'E');
	const enslavers = new Map(); // name -> original_row

	enslaved.forEach(m => {
		const name = getRowValue(m.original_data, 'enslaver_full_name');
		if (name && !enslavers.has(name)) {
			enslavers.set(name, m.original_data);
		}
	});

	log(`Found ${enslavers.size} unique enslavers in processed data.`);
	let processed = 0;
	const total = enslavers.size;
	const startTime = Date.now();

	const enslaverNames = Array.from(enslavers.keys());
	const dbSource = await getDatabaseSource(selectedSource);

	// 1. Bulk check for existing enslavers
	log(`Checking database for existing records for ${enslaverNames.length} enslavers...`);
	const existingEnslavers = new Set();
	for (let i = 0; i < enslaverNames.length; i += 100) {
		const chunk = enslaverNames.slice(i, i + 100);
		try {
			const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&full_name=in.(${chunk.map(n => `"${n.replace(/"/g, '""')}"`).join(',')})&is_enslaver=is.true`, { headers: API_HEADERS });
			if (res.ok) {
				const data = await res.json();
				data.forEach(m => existingEnslavers.add(m.full_name));
			}
		} catch (err) {
			log(`Bulk check failed for a chunk: ${err.message}`, true);
		}
	}

	const enslaversToCreate = [];
	for (const [fullName, row] of enslavers) {
		if (existingEnslavers.has(fullName)) continue;

		const { first, middle, last } = parseGeneralName(fullName);
		const format = selectedSource.format || '';
		const county = selectedSource.county || 'ALB';
		const { type, year } = getFormatParams(format, selectedSource.year);
		const line = getRowValue(row, 'line') || '';
		const mId = idGenerator.generate(county, type, year, line);

		enslaversToCreate.push({
			mention_id: mId,
			source: dbSource,
			source_year: parseInt(selectedSource.year),
			county: selectedSource.county || '',
			original_data: row,
			confidence: 0.83,
			full_name: fullName,
			first_name: first,
			middle_name: middle,
			last_name: last,
			legal_status: '',
			is_enslaver: true,
			race: 'W',
			norm_race: 'W',
			norm_first_name: normalizeFirstName(first),
			nysiis_last_name: simpleNysiis(last)
		});
	}

	if (enslaversToCreate.length > 0) {
		log(`Inserting ${enslaversToCreate.length} new enslaver mentions...`);
		await insertBatch(enslaversToCreate);
	} else {
		log('All enslavers already exist in database.');
	}
}

async function processChurchEnslaverMentions(mentions) {
	log('Processing Enslaver Mentions for Church records...');

	const enslavers = new Map(); // name -> original_row

	mentions.forEach(m => {
		const name = getRowValue(m.original_data, 'enslaver_full_name');
		if (name && !enslavers.has(name)) {
			enslavers.set(name, m.original_data);
		}
	});

	log(`Found ${enslavers.size} unique enslavers in processed data.`);
	let processed = 0;
	const total = enslavers.size;
	const startTime = Date.now();

	const enslaverNames = Array.from(enslavers.keys());
	const dbSource = await getDatabaseSource(selectedSource);

	const enslaversToCreate = [];
	for (const [fullName, row] of enslavers) {
		const { first, middle, last } = parseGeneralName(fullName);
		const format = selectedSource.format || '';
		const county = selectedSource.county || 'ALB';
		const { type, year } = getFormatParams(format, selectedSource.year);
		const line = getRowValue(row, 'line') || '';
		const mId = idGenerator.generate(county, type, year, line);

		enslaversToCreate.push({
			mention_id: mId,
			source: dbSource,
			source_year: parseInt(getRowValue(row, 'record_year') || selectedSource.year),
			county: selectedSource.county || '',
			original_data: row,
			confidence: 0.85,
			full_name: fullName,
			first_name: first,
			middle_name: middle,
			last_name: last,
			legal_status: '',
			is_enslaver: true,
			race: 'W',
			norm_race: 'W',
			norm_first_name: normalizeFirstName(first),
			nysiis_last_name: simpleNysiis(last)
		});
	}

	if (enslaversToCreate.length > 0) {
		log(`Inserting ${enslaversToCreate.length} new enslaver mentions...`);
		await insertBatch(enslaversToCreate);
	} else {
		log('All enslavers already exist in database.');
	}
}

function parseGeneralName(fullName, isVitalRecordParent = false) {
	const parts = fullName.trim().split(/\s+/);
	let first = '', middle = '', last = '';

	const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', '2nd', '3rd', '4th', '5th'];
	let lastIdx = parts.length - 1;
	if (lastIdx > 0 && suffixes.includes(parts[lastIdx].toLowerCase().replace(/[.,]/g, ''))) {
		lastIdx--;
	}

	if (parts.length === 1) {
		last = parts[0];
		if (isVitalRecordParent) first = parts[0];
	} else if (parts.length === 2) {
		first = parts[0];
		last = parts[lastIdx];
	} else {
		first = parts[0];
		middle = parts.slice(1, lastIdx).join(' ').replace(/[.,]/g, '');
		last = parts[lastIdx];
	}
	return { first, middle, last };
}

async function processVitalRecordPostHoc(mentions) {
	log(`Processing Parent Mentions for ${mentions.length} Vital Records mentions...`);
	let processed = 0;
	const total = mentions.length;
	const startTime = Date.now();
	const parentsToCreate = [];

	for (const childMention of mentions) {
		processed++;
		if (processed % 100 === 0 || processed === total) {
			updateProgress(processed, total, startTime, 'records scanned for parents');
		}
		const row = childMention.original_data;
		if (!row) continue;

		const motherName = getRowValue(row, 'mother');
		const fatherName = getRowValue(row, 'father');

		if (childMention.full_name === motherName || childMention.full_name === fatherName) {
			continue;
		}

		const parents = [
			{ name: motherName, gender: 'F' },
			{ name: fatherName, gender: 'M' }
		];

		for (const p of parents) {
			if (p.name && p.name.trim()) {
				const fullName = p.name.replace(/[.,]/g, '').trim();
				const { first, middle, last } = parseGeneralName(fullName, true);
				const format = selectedSource.format || '';
				const county = selectedSource.county || 'ALB';
				const { type, year } = getFormatParams(format, selectedSource.year);
				const line = getRowValue(row, 'line') || '';
				const mId = idGenerator.generate(county, type, year, line);

				parentsToCreate.push({
					mention_id: mId,
					source: "ALB_VR_1715",
					source_year: childMention.source_year,
					county: selectedSource.county || '',
					original_data: row,
					confidence: 0.85,
					full_name: fullName,
					first_name: first,
					middle_name: middle,
					last_name: last,
					gender: p.gender,
					norm_first_name: normalizeFirstName(first),
					nysiis_last_name: simpleNysiis(last)
				});
			}
		}
	}

	// Batch write parents in parallel
	log(`Writing ${parentsToCreate.length} parent mentions...`);
	const BATCH_SIZE = 100;
	const batches = [];
	for (let i = 0; i < parentsToCreate.length; i += BATCH_SIZE) {
		batches.push(parentsToCreate.slice(i, i + BATCH_SIZE));
	}

	let parentsWritten = 0;
	const pStartTime = Date.now();
	const CONCURRENCY = 10;

	for (let i = 0; i < batches.length; i += CONCURRENCY) {
		const chunk = batches.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (batch) => {
			try {
				await insertBatch(batch);
				parentsWritten += batch.length;
			} catch (err) {
				log(`Failed to write parent mention batch: ${err.message}`, true);
			}
			updateProgress(parentsWritten, parentsToCreate.length, pStartTime, 'parent mentions written');
		}));
	}

	log(`Finished creating ${parentsWritten} parent mentions.`);
}

async function processPostHocAssertions() {
	log('Starting Post-Hoc Assertions processing...');

	const dbSource = await getDatabaseSource(selectedSource);

	let allMentions = [];
	let offset = 0;
	const limit = 1000;

	while (true) {
		const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
		if (!res.ok) {
			throw new Error('Failed to fetch mentions for assertions');
		}
		const data = await res.json();
		if (data.length === 0) break;
		allMentions = allMentions.concat(data);
		if (data.length < limit) break;
		offset += limit;
	}

	const mentions = allMentions;

	if (selectedSource.format.includes('SlaveSchedule')) {
		await processSlaveScheduleAssertions(mentions);
	} else if (selectedSource.format.includes('VitalRecord')) {
		await processVitalRecordAssertions(mentions);
	} else if (selectedSource.format.includes('Church')) {
		await processChurchAssertions(mentions);
	} else if (selectedSource.format.includes('Census')) {
		// Sort by line number from original_data to maintain enumeration order
		mentions.sort((a, b) => {
			const lineA = parseInt(a.original_data?.line || 0);
			const lineB = parseInt(b.original_data?.line || 0);
			return lineA - lineB;
		});

		// Group by family_id (preferred for relationships) or household_id
		const groups = {};
		mentions.forEach(m => {
			const groupId = m.family_id || m.household_id;
			if (!groupId) return;
			if (!groups[groupId]) groups[groupId] = [];
			groups[groupId].push(m);
		});

		let matchedCount = 0;
		const totalGroups = Object.keys(groups).length;
		const startTime = Date.now();
		const assertionsToCreate = [];

		// Deduplication: Fetch existing assertions for this source type
		const whoTag = selectedSource.year == 1880 ? "1880Census" : "1870Census";
		log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
		const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
		log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

		log(`Matching relationships for ${totalGroups} family/household groups...`);

		for (const [groupId, members] of Object.entries(groups)) {
			matchedCount++;
			if (matchedCount % 10 === 0 || matchedCount === totalGroups) {
				updateProgress(matchedCount, totalGroups, startTime, 'groups matched');
			}

			const head = members.find(m => m.head === true);
			if (!head) continue;

			for (let i = 0; i < members.length; i++) {
				const self = members[i];
				const next = members[i + 1];

				// Skip head for relation identification as per instruction 74
				if (self.mention_id === head.mention_id) continue;

				let predicate = null;
				let confidence = 0.5;
				let who = "1870Census";

				const is1880 = selectedSource.year == 1880;

				if (is1880) {
					who = "1880Census";
					confidence = 0.9;
					// 1880 Census Logic (Relation-based)
					const relation = self.original_data?.relation;
					if (relation && relation.toLowerCase() !== "self") {
						const relationMap = {
							"wife": "isSpouseOf",
							"son": "isChildOf",
							"daughter": "isChildOf",
							"brother": "isSiblingOf",
							"sister": "isSiblingOf",
							"father": "isParentOf",
							"mother": "isParentOf",
							"grandfather": "isGrandParentOf",
							"grandmother": "isGrandParentOf",
							"uncle": "isPiblingeOf",
							"aunt": "isPiblingOf",
							"cousin": "isCousinOf",
							"nephew": "isNiblingOf",
							"niece": "isNiblingOf",
							"son-in-law": "isChildInLawOf",
							"daughter-in-law": "isChildInLawOf",
							"brother-in-law": "isSiblingInLawOf",
							"sister-in-law": "isSiblingInLawOf",
							"father-in-law": "isParentInLawOf",
							"mother-in-law": "isParentInLawOf",
							"grandfather-in-law": "isGrandParentInLawOf",
							"grandmother-in-law": "isGrandParentInLawOf",
							"uncle-in-law": "isPiblingInLawOf",
							"aunt-in-law": "isPiblingInLawOf",
							"cousin-in-law": "isCousinInLawOf",
							"nephew-in-law": "isNiblingInLawOf",
							"niece-in-law": "isNiblingInLawOf"
						};
						predicate = relationMap[relation.toLowerCase()] || null;
					}
				} else {
					// 1870 Census Logic (Inferred-based)
					who = "1870Census";
					confidence = 0.5;

					// Rule 75: isSpouseOf
					if (next && self.gender === 'M' && next.gender === 'F') {
						const selfYear = self.birth_year || 0;
						const nextYear = next.birth_year || 0;
						const yearDiff = selfYear - nextYear;
						if (yearDiff >= -5 && yearDiff <= 15) {
							predicate = 'isSpouseOf';
						}
					}
				}

				if (predicate) {
					let subjId = head.mention_id;
					let objId = self.mention_id;

					if (subjId && objId) {
						const aKey = `${subjId}|${predicate}|${objId}`;
						if (!existingAssertionKeys.has(aKey)) {
							assertionsToCreate.push({
								subject_id: subjId,
								predicate: predicate,
								county: selectedSource.county || '',
								object_id: objId,
								who: who,
								start_year: parseInt(selectedSource.year),
								confidence: confidence
							});
							existingAssertionKeys.add(aKey);
						}
					}
				}
			}
		}

		// Write assertions in parallel batches
		log(`Writing ${assertionsToCreate.length} Census assertions...`);
		const BATCH_SIZE = 100;
		const assertionBatches = [];
		for (let i = 0; i < assertionsToCreate.length; i += BATCH_SIZE) {
			assertionBatches.push(assertionsToCreate.slice(i, i + BATCH_SIZE));
		}

		let assertionsWritten = 0;
		const aStartTime = Date.now();
		const CONCURRENCY = 10;

		for (let i = 0; i < assertionBatches.length; i += CONCURRENCY) {
			const chunk = assertionBatches.slice(i, i + CONCURRENCY);
			await Promise.all(chunk.map(async (batch) => {
				try {
					await saveAssertionsBatch(batch);
					assertionsWritten += batch.length;
				} catch (err) {
					log(`Failed to write Census assertion batch: ${err.message}`, true);
				}
				updateProgress(assertionsWritten, assertionsToCreate.length, aStartTime, 'assertions written');
			}));
		}

		log(`Created ${assertionsWritten} Census household assertions.`);
	} else {
		log('Skipping post-hoc assertions for non-supported format.');
	}
	await removeDuplicateAssertions();
}

async function removeDuplicateAssertions() {
	log('Cleaning up duplicate assertions...');
	let allAssertions = [];
	let offset = 0;
	const limit = 2000;
	while (true) {
		const res = await fetch(`${POSTGREST_URL}/assertions?select=assertion_id,subject_id,predicate,object_id,object_string,who,confidence,created&limit=${limit}&offset=${offset}&order=assertion_id.asc`, { headers: API_HEADERS });
		if (!res.ok) throw new Error('Failed to fetch assertions for cleanup');
		const data = await res.json();
		if (data.length === 0) break;
		allAssertions = allAssertions.concat(data);
		if (allAssertions.length % 5000 === 0) {
			log(`Fetched ${allAssertions.length} assertions...`);
		}
		if (data.length < limit) break;
		offset += limit;
	}

	log(`Total assertions to check: ${allAssertions.length}`);

	const groups = {};
	allAssertions.forEach(a => {
		// Key must account for both object_id and object_string to be unique
		const objValue = a.object_id || a.object_string || 'null';
		const key = `${a.subject_id}|${a.predicate}|${objValue}`;
		if (!groups[key]) groups[key] = [];
		groups[key].push(a);
	});

	const idsToDelete = [];
	for (const key in groups) {
		const group = groups[key];
		if (group.length > 1) {
			// Keep the best one:
			// 1. Non-expanded preferred
			// 2. Higher confidence
			// 3. Earliest created
			group.sort((a, b) => {
				if (a.who !== 'expanded' && b.who === 'expanded') return -1;
				if (a.who === 'expanded' && b.who !== 'expanded') return 1;
				if ((b.confidence || 0) !== (a.confidence || 0)) return (b.confidence || 0) - (a.confidence || 0);
				return (a.created || '').localeCompare(b.created || '');
			});
			// Collect all but the first one
			for (let i = 1; i < group.length; i++) {
				if (group[i].assertion_id) {
					idsToDelete.push(group[i].assertion_id);
				}
			}
		}
	}

	if (idsToDelete.length > 0) {
		log(`Found ${idsToDelete.length} duplicates. Deleting in batches...`);
		for (let i = 0; i < idsToDelete.length; i += 100) {
			const chunk = idsToDelete.slice(i, i + 100);
			try {
				const idList = chunk.map(id => `"${id}"`).join(',');
				const delRes = await fetch(`${POSTGREST_URL}/assertions?assertion_id=in.(${idList})`, {
					method: 'DELETE',
					headers: API_HEADERS
				});
				if (!delRes.ok) {
					log(`Warning: Failed to delete batch starting at ${i}`, true);
				}
			} catch (e) {
				log(`Error deleting batch: ${e.message}`, true);
			}
		}
		log(`Successfully processed deletion of ${idsToDelete.length} assertions.`);
	} else {
		log('No duplicate assertions found.');
	}
}

async function removeDuplicateMentions(dbSource) {
	log('Checking for duplicate mentions to remove...');
	let allMentions = [];
	let offset = 0;
	const limit = 2000;
	while (true) {
		const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&select=mention_id,full_name,original_data&limit=${limit}&offset=${offset}&order=mention_id.asc`, { headers: API_HEADERS });
		if (!res.ok) throw new Error('Failed to fetch mentions for cleanup');
		const data = await res.json();
		if (data.length === 0) break;
		allMentions = allMentions.concat(data);
		if (data.length < limit) break;
		offset += limit;
	}

	const groups = {};
	allMentions.forEach(m => {
		// Key by full_name and stringified original_data
		const key = `${m.full_name || ''}|${JSON.stringify(m.original_data || {})}`;
		if (!groups[key]) groups[key] = [];
		groups[key].push(m.mention_id);
	});

	const idsToDelete = [];
	for (const key in groups) {
		const ids = groups[key];
		if (ids.length > 1) {
			// Keep the first one, delete the rest
			idsToDelete.push(...ids.slice(1));
		}
	}

	if (idsToDelete.length > 0) {
		log(`Found ${idsToDelete.length} duplicate mentions. Deleting...`);
		for (let i = 0; i < idsToDelete.length; i += 100) {
			const chunk = idsToDelete.slice(i, i + 100);
			try {
				const idList = chunk.map(id => `"${id}"`).join(',');
				const delRes = await fetch(`${POSTGREST_URL}/mentions?mention_id=in.(${idList})`, {
					method: 'DELETE',
					headers: API_HEADERS
				});
				if (!delRes.ok) {
					log(`Warning: Failed to delete mention batch starting at ${i}`, true);
				}
			} catch (e) {
				log(`Error deleting mention batch: ${e.message}`, true);
			}
		}
		log(`Successfully deleted ${idsToDelete.length} duplicate mentions.`);
	} else {
		log('No duplicate mentions found.');
	}
}

async function saveAssertionsBatch(assertions) {
	if (assertions.length === 0) return;
	const res = await fetch(`${POSTGREST_URL}/assertions`, {
		method: 'POST',
		headers: API_HEADERS,
		body: JSON.stringify(assertions)
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(err);
	}
}

async function processSlaveScheduleAssertions(mentions) {
	log('Creating wasEnslavedBy assertions for Slave Schedule...');

	const enslaved = mentions.filter(m => m.legal_status === 'E');
	const enslavers = mentions.filter(m => m.is_enslaver === true);

	const enslaverMap = new Map(); // full_name -> mention_id
	enslavers.forEach(e => {
		enslaverMap.set(e.full_name, e.mention_id);
	});

	// Deduplication: Fetch existing assertions for slaveSchedule
	log('Checking for existing slaveSchedule assertions to avoid duplicates...');
	const existingAssertionKeys = await fetchExistingAssertionKeys('slaveSchedule');
	log(`Found ${existingAssertionKeys.size} existing assertions for slaveSchedule.`);

	// Group enslaved mention IDs by their enslaver_id for bulk patching
	const enslaverGroups = {}; // enslaver_id -> [mention_id]
	const assertionsToCreate = [];

	for (const m of enslaved) {
		const enslaverName = getRowValue(m.original_data, 'enslaver_full_name');
		const enslaverId = enslaverMap.get(enslaverName);

		if (enslaverId) {
			if (!enslaverGroups[enslaverId]) enslaverGroups[enslaverId] = [];
			enslaverGroups[enslaverId].push(m.mention_id);

			const objValue = enslaverId || 'null';
			const aKey = `${m.mention_id}|wasEnslavedBy|${objValue}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: m.mention_id,
					predicate: 'wasEnslavedBy',
					county: selectedSource.county || '',
					object_id: enslaverId,
					who: 'slaveSchedule',
					start_year: parseInt(selectedSource.year),
					end_year: parseInt(selectedSource.year),
					confidence: 0.8
				});
				existingAssertionKeys.add(aKey);
			}
		}
	}

	const enslaverIds = Object.keys(enslaverGroups);
	log(`Linking ${enslaverIds.length} enslaver groups...`);

	let processed = 0;
	const total = enslaverIds.length;
	const startTime = Date.now();

	const CONCURRENCY = 10;

	// Phase 1: Bulk PATCH enslaver_id
	for (let i = 0; i < enslaverIds.length; i += CONCURRENCY) {
		const chunk = enslaverIds.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (eId) => {
			const mIds = enslaverGroups[eId];
			try {
				for (let j = 0; j < mIds.length; j += 100) {
					const idChunk = mIds.slice(j, j + 100);
					const idList = idChunk.map(id => `"${id}"`).join(',');
					await fetch(`${POSTGREST_URL}/mentions?mention_id=in.(${idList})`, {
						method: 'PATCH',
						headers: API_HEADERS,
						body: JSON.stringify({ enslaver_id: eId })
					});
				}
			} catch (err) {
				log(`Failed to link enslaver ${eId}: ${err.message}`, true);
			}
			processed++;
			updateProgress(processed, total, startTime, 'enslavers linked');
		}));
	}

	// Phase 2: Bulk POST assertions in parallel
	log(`Writing ${assertionsToCreate.length} assertions...`);
	const BATCH_SIZE = 100;
	const assertionBatches = [];
	for (let i = 0; i < assertionsToCreate.length; i += BATCH_SIZE) {
		assertionBatches.push(assertionsToCreate.slice(i, i + BATCH_SIZE));
	}

	let assertionsWritten = 0;
	const aTotal = assertionBatches.length;
	const aStartTime = Date.now();

	for (let i = 0; i < assertionBatches.length; i += CONCURRENCY) {
		const chunk = assertionBatches.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (batch) => {
			try {
				await saveAssertionsBatch(batch);
				assertionsWritten += batch.length;
			} catch (err) {
				log(`Failed to write assertion batch: ${err.message}`, true);
			}
			updateProgress(assertionsWritten, assertionsToCreate.length, aStartTime, 'assertions written');
		}));
	}

	log(`Created ${assertionsWritten} wasEnslavedBy assertions and linked enslaver IDs.`);
}

async function processVitalRecordAssertions(mentions) {
	log(`Creating Parent-Child assertions for ${mentions.length} Vital Records mentions...`);

	// Deduplication: Fetch existing assertions for vitalRecords
	log('Checking for existing vitalRecords assertions to avoid duplicates...');
	const existingAssertionKeys = await fetchExistingAssertionKeys('vitalRecords');
	log(`Found ${existingAssertionKeys.size} existing assertions for vitalRecords.`);

	// Group by original_data line number
	const groups = {};

	mentions.forEach(m => {
		const row = m.original_data;
		const line = getRowValue(row, 'line');
		if (!line) return;

		if (!groups[line]) groups[line] = { child: null, mother: null, father: null };

		const motherName = getRowValue(row, 'mother');
		const fatherName = getRowValue(row, 'father');

		if (motherName && m.full_name === motherName && m.gender === 'F') {
			groups[line].mother = m;
		} else if (fatherName && m.full_name === fatherName && m.gender === 'M') {
			groups[line].father = m;
		} else {
			// It's the child if it's not a parent we recognized
			// Prefer the mention created first (lowest ID) as the child
			if (!groups[line].child || m.mention_id < groups[line].child.mention_id) {
				groups[line].child = m;
			}
		}
	});

	const assertionBatches = [];
	const currentBatch = [];

	for (const line in groups) {
		const { child, mother, father } = groups[line];
		if (!child) continue;

		if (mother) {
			const mKey = `${mother.mention_id}|IsMotherOf|${child.mention_id}`;
			if (!existingAssertionKeys.has(mKey)) {
				currentBatch.push({
					subject_id: mother.mention_id,
					predicate: 'IsMotherOf',
					county: selectedSource.county || '',
					object_id: child.mention_id,
					who: 'vitalRecords',
					start_year: child.source_year,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(mKey);
			}
		}
		if (father) {
			const fKey = `${father.mention_id}|IsFatherOf|${child.mention_id}`;
			if (!existingAssertionKeys.has(fKey)) {
				currentBatch.push({
					subject_id: father.mention_id,
					predicate: 'IsFatherOf',
					county: selectedSource.county || '',
					object_id: child.mention_id,
					who: 'vitalRecords',
					start_year: child.source_year,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(fKey);
			}
		}

		if (currentBatch.length >= 100) {
			assertionBatches.push([...currentBatch]);
			currentBatch.length = 0;
		}
	}
	if (currentBatch.length > 0) assertionBatches.push(currentBatch);
	console.log
	let count = 0;
	const startTime = Date.now();
	const CONCURRENCY = 10;

	for (let i = 0; i < assertionBatches.length; i += CONCURRENCY) {
		const chunk = assertionBatches.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (batch) => {
			try {
				await saveAssertionsBatch(batch);
				count += batch.length;
			} catch (err) {
				log(`Failed to write Vital Record assertion batch: ${err.message}`, true);
			}
			updateProgress(count, assertionBatches.length * 100, startTime, 'assertions written'); // Rough estimate for total
		}));
	}
	log(`Created ${count} parent-child assertions for Vital Records.`);
}

async function processChurchAssertions(mentions) {
	log('Creating wasEnslavedBy assertions for Church records...');

	const dbSource = await getDatabaseSource(selectedSource); 
	
	const enslaved = mentions.filter(m => getRowValue(m.original_data, 'enslaver_full_name'));
	if (enslaved.length === 0) {
		log('No enslaved persons with enslavers found in these records.');
		return;
	}

	const enslaverNames = Array.from(new Set(enslaved.map(m => getRowValue(m.original_data, 'enslaver_full_name'))));
	const enslaverMap = new Map(); 

	for (let i = 0; i < enslaverNames.length; i += 100) {
		const chunk = enslaverNames.slice(i, i + 100);
		try {
			const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&full_name=in.(${chunk.map(n => `"${n.replace(/"/g, '""')}"`).join(',')})&is_enslaver=is.true`, { headers: API_HEADERS });
			if (res.ok) {
				const data = await res.json();
				data.forEach(m => enslaverMap.set(m.full_name, m.mention_id));
			}
		} catch (err) {
			log(`Failed to fetch enslavers for assertions: ${err.message}`, true);
		}
	}

	log(`Checking for existing ${dbSource} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(dbSource);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${dbSource}.`);

	const assertionsToCreate = [];

	for (const m of enslaved) {
		const enslaverName = getRowValue(m.original_data, 'enslaver_full_name');
		const enslaverId = enslaverMap.get(enslaverName);
		
		if (enslaverId) {
			const objValue = enslaverId || 'null';
			const aKey = `${m.mention_id}|wasEnslavedBy|${objValue}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: m.mention_id,
					predicate: 'wasEnslavedBy',
					county: selectedSource.county || '',
					object_id: enslaverId,
					who: dbSource,
					start_year: parseInt(getRowValue(m.original_data, 'record_year') || selectedSource.year),
					end_year: null,
					confidence: 0.8
				});
				existingAssertionKeys.add(aKey);
			}
		}
	}

	log(`Writing ${assertionsToCreate.length} assertions...`);
	const BATCH_SIZE = 100;
	const assertionBatches = [];
	for (let i = 0; i < assertionsToCreate.length; i += BATCH_SIZE) {
		assertionBatches.push(assertionsToCreate.slice(i, i + BATCH_SIZE));
	}

	let assertionsWritten = 0;
	const aStartTime = Date.now();
	const CONCURRENCY = 10;

	for (let i = 0; i < assertionBatches.length; i += CONCURRENCY) {
		const chunk = assertionBatches.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (batch) => {
			try {
				await saveAssertionsBatch(batch);
				assertionsWritten += batch.length;
			} catch (err) {
				log(`Failed to write assertion batch: ${err.message}`, true);
			}
			updateProgress(assertionsWritten, assertionsToCreate.length, aStartTime, 'assertions written');
		}));
	}

	log(`Created ${assertionsWritten} wasEnslavedBy assertions for Church records.`);
}

async function saveAssertion(assertion) {
	console.log(assertion);
	const res = await fetch(`${POSTGREST_URL}/assertions`, {
		method: 'POST',
		headers: API_HEADERS,
		body: JSON.stringify(assertion)
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(err);
	}
}

// Jaro-Winkler string similarity algorithm
function jaroWinkler(s1, s2) {
	if (!s1 || !s2) return 0.0;
	s1 = s1.toLowerCase();
	s2 = s2.toLowerCase();
	
	if (s1 === s2) return 1.0;
	
	const len1 = s1.length;
	const len2 = s2.length;
	const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
	
	const matches1 = new Array(len1).fill(false);
	const matches2 = new Array(len2).fill(false);
	
	let m = 0;
	for (let i = 0; i < len1; i++) {
		const start = Math.max(0, i - matchWindow);
		const end = Math.min(len2 - 1, i + matchWindow);
		for (let j = start; j <= end; j++) {
			if (!matches2[j] && s1[i] === s2[j]) {
				matches1[i] = true;
				matches2[j] = true;
				m++;
				break;
			}
		}
	}
	
	if (m === 0) return 0.0;
	
	// Count transpositions
	let t = 0;
	let k = 0;
	for (let i = 0; i < len1; i++) {
		if (matches1[i]) {
			while (!matches2[k]) {
				k++;
			}
			if (s1[i] !== s2[k]) {
				t++;
			}
			k++;
		}
	}
	t = t / 2;
	
	const jaro = (m / len1 + m / len2 + (m - t) / m) / 3.0;
	
	// Winkler prefix scale
	let l = 0;
	const maxPrefix = Math.min(4, Math.min(len1, len2));
	for (let i = 0; i < maxPrefix; i++) {
		if (s1[i] === s2[i]) {
			l++;
		} else {
			break;
		}
	}
	
	const p = 0.1;
	return jaro + l * p * (1.0 - jaro);
}

// Soundex Algorithm
function soundex(str) {
	if (!str) return '';
	let s = str.toUpperCase().replace(/[^A-Z]/g, '');
	if (!s) return '';

	const firstLetter = s[0];
	const mappings = {
		B: '1', F: '1', P: '1', V: '1',
		C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
		D: '3', T: '3',
		L: '4',
		M: '5', N: '5',
		R: '6'
	};

	let codes = [firstLetter];
	let prevCode = mappings[firstLetter] || '';

	for (let i = 1; i < s.length; i++) {
		let char = s[i];
		let code = mappings[char] || '';

		if (char === 'H' || char === 'W') {
			continue;
		}

		if (code) {
			if (code !== prevCode) {
				codes.push(code);
			}
			prevCode = code;
		} else {
			prevCode = '';
		}
	}

	return (codes.join('') + '000').substring(0, 4);
}

// Full NYSIIS Algorithm
function simpleNysiis(str) {
	if (!str) return '';
	let s = str.toUpperCase().replace(/[^A-Z]/g, '');
	if (!s) return '';

	// At beginning of name
	if (s.startsWith('MAC')) {
		s = 'MC' + s.substring(3);
	} else if (s.startsWith('KN')) {
		s = 'N' + s.substring(2);
	} else if (s.startsWith('SCH')) {
		s = 'S' + s.substring(3);
	}

	// At end of name
	if (s.endsWith('EE')) {
		s = s.substring(0, s.length - 2) + 'Y';
	} else if (s.endsWith('IE')) {
		s = s.substring(0, s.length - 2) + 'Y';
	} else if (s.endsWith('DT') || s.endsWith('RT') || s.endsWith('RD') || s.endsWith('NT') || s.endsWith('ND')) {
		s = s.substring(0, s.length - 2) + 'D';
	}

	// Remove trailing S or A
	if (s.endsWith('S') || s.endsWith('A')) {
		s = s.substring(0, s.length - 1);
	}

	if (!s) return '';

	// Keep the first character of the current string
	const firstChar = s[0];
	let remainder = s.substring(1);
	let processed = '';

	const isVowel = (char) => {
		return char && 'AEIOU'.includes(char);
	};

	for (let i = 0; i < remainder.length; i++) {
		let char = remainder[i];

		// PH -> F
		if (char === 'P' && remainder[i + 1] === 'H') {
			processed += 'F';
			i++;
			continue;
		}

		if (char === 'H') {
			let prec = s[i];
			let foll = s[i + 2];
			if (isVowel(prec) && isVowel(foll)) {
				processed += 'H';
			}
			continue;
		}

		if (char === 'W') {
			let prec = s[i];
			if (!isVowel(prec)) {
				processed += 'W';
			}
			continue;
		}

		if ('AEIOU'.includes(char)) {
			processed += 'A';
		} else if (char === 'Q') {
			processed += 'G';
		} else if (char === 'Z') {
			processed += 'S';
		} else if (char === 'M') {
			processed += 'N';
		} else if (char === 'K') {
			processed += 'C';
		} else {
			processed += char;
		}
	}

	let result = firstChar + processed;

	// Collapse duplicates
	let collapsed = '';
	for (let i = 0; i < result.length; i++) {
		if (result[i] !== result[i - 1]) {
			collapsed += result[i];
		}
	}

	return collapsed;
}

// Race Normalization
function simpleRaceNorm(str) {
	if (!str) return '';
	const s = str.trim().toUpperCase();
	if (s === 'W' || s === 'CAUC' || s === 'CAUCASIAN' || s === 'WHITE') return 'W';
	return 'B';
}

const occupationCategories = [
	{ label: "Agriculture", examples: ["farmer", "farmhand", "planter", "gardener", "cattle work", "dairyman", "shepherd", "hostler"] },
	{ label: "Food", examples: ["baker", "butcher", "miller", "flour work", "confectioner"] },
	{ label: "Textile", examples: ["tailor", "seamstress", "dressmaker", "weaver", "spinner"] },
	{ label: "Leather", examples: ["shoemaker", "shoe maker", "saddler", "tanner", "harness maker"] },
	{ label: "Metal", examples: ["blacksmith", "silversmith", "tinsmith", "gunsmith", "locksmith", "b smith", "blk-smith", "bsmith"] },
	{ label: "Woodwork", examples: ["carpenter", "cabinetmaker", "wheelwright", "chairmaker"] },
	{ label: "Construction", examples: ["mason", "brickmaker", "plasterer", "painter", "slater"] },
	{ label: "Transportation", examples: ["railroad worker", "railroad", "conductor", "engineer", "brakeman", "flagman", "boatman", "ferryman", "sailor", "waterman", "teamster", "drayman", "wagoner", "driver", "expressman", "rail road"] },
	{ label: "Domestic", examples: ["domestic", "servant", "cook", "butler", "chambermaid", "housekeeper", "laundress", "washerwoman", "nurse", "governess", "keep house", "keeping house", "at home", "house keeper", "house-keeping"] },
	{ label: "Commerce", examples: ["merchant", "grocer", "dealer", "trader", "storekeeper"] },
	{ label: "Office", examples: ["clerk", "bookkeeper", "accountant", "copyist"] },
	{ label: "Profession", examples: ["lawyer", "physician", "surveyor", "architect", "photographer", "doctor", "dentist", "banker", "nurse"] },
	{ label: "Education", examples: ["teacher", "college", "professor", "school", "university prof"] },
	{ label: "Religion", examples: ["minister", "preacher", "librarian"] },
	{ label: "Manufacturing", examples: ["machinist", "factory", "foundry", "manufacturer"] },
	{ label: "Extraction", examples: ["miner", "coal", "quarryman", "well digger"] },
	{ label: "Government", examples: ["police", "sheriff", "constable", "judge", "jailer", "postmaster", "tax collector", "inspector", "enumerator", "mayor", "post master", "post mistress"] },
	{ label: "Hospitality", examples: ["hotel", "saloonkeeper", "bartender", "waiter", "boarding house"] },
	{ label: "Craftsman", examples: ["jeweler", "watchmaker", "printer", "cooper"] },
	{ label: "Laborer", examples: ["laborer", "helper", "assistant", "errand"] }
];

function normalizeOccupation(raw) {
	if (!raw) return '';

	let s = raw.toLowerCase();

	// Remove punctuation
	s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

	// Remove specific words
	const removeWords = ["assist", "assistant", "intern", "app", "appren", "apprentice", "apprenticed"];
	removeWords.forEach(w => {
		const regex = new RegExp(`\\b${w}\\b`, 'gi');
		s = s.replace(regex, '');
	});

	s = s.replace(/\s{2,}/g, " ").trim();
	if (!s) return '';

	// Keyword matching overrides
	if (s.includes('school') || s.includes('university') || s.includes('prof')) return 'EDUCATION';
	if (s.includes('farm')) return 'AGRICULTURE';
	if (s.includes('maid') || s.includes('house')) return 'DOMESTIC';
	if (s.includes('r r')) return 'TRANSPORTATION';

	// Match categories
	for (const cat of occupationCategories) {
		for (const ex of cat.examples) {
			if (s.includes(ex)) {
				return cat.label.toUpperCase();
			}
		}
	}

	// Try to find the closest category using Jaro-Winkler
	let maxScore = -1;
	let closestLabel = '';
	for (const cat of occupationCategories) {
		// Compare with label
		let score = jaroWinkler(s, cat.label);
		if (score > maxScore) {
			maxScore = score;
			closestLabel = cat.label.toUpperCase();
		}
		// Compare with examples
		for (const ex of cat.examples) {
			score = jaroWinkler(s, ex);
			if (score > maxScore) {
				maxScore = score;
				closestLabel = cat.label.toUpperCase();
			}
		}
	}

	return closestLabel;
}

const nicknames = {
	"WM": "WILLIAM", "BILL": "WILLIAM", "BILLY": "WILLIAM", "WILL": "WILLIAM", "WILLY": "WILLIAM", "WILLIE": "WILLIAM",
	"ROBT": "ROBERT", "ROB": "ROBERT", "BOB": "ROBERT", "BOBBY": "ROBERT", "ROBBIE": "ROBERT",
	"JAS": "JAMES", "JIM": "JAMES", "JIMMY": "JAMES", "JAMIE": "JAMES",
	"CHAS": "CHARLES", "CHARLIE": "CHARLES", "CHUCK": "CHARLES", "CARL": "CHARLES",
	"THOS": "THOMAS", "TOM": "THOMAS", "TOMMY": "THOMAS",
	"JNO": "JOHN", "JON": "JOHN", "JACK": "JOHN", "JACKIE": "JOHN", "JONNY": "JOHN", "JOHNNY": "JOHN",
	"DAN": "DANIEL", "DANNY": "DANIEL",
	"ED": "EDWARD", "EDDIE": "EDWARD", "NED": "EDWARD", "TED": "EDWARD", "TEDDY": "EDWARD",
	"GEO": "GEORGE",
	"JOS": "JOSEPH", "JOE": "JOSEPH", "JOEY": "JOSEPH",
	"SAM": "SAMUEL", "SAMMY": "SAMUEL",
	"ALEX": "ALEXANDER", "ALECK": "ALEXANDER", "ALEC": "ALEXANDER", "SANDY": "ALEXANDER",
	"PAT": "PATRICK", "PADDY": "PATRICK",
	"MATT": "MATTHEW", "MAT": "MATTHEW",
	"MIKE": "MICHAEL", "MICK": "MICHAEL", "MICKEY": "MICHAEL", "MICH": "MICHAEL",
	"DAVE": "DAVID", "DAVEY": "DAVID", "DAVY": "DAVID",
	"CHRIS": "CHRISTOPHER", "KIT": "CHRISTOPHER",
	"RICH": "RICHARD", "RICK": "RICHARD", "DICK": "RICHARD", "RICHD": "RICHARD", "DICKY": "RICHARD",
	"HARRY": "HENRY", "HAL": "HENRY", "HEN": "HENRY",
	"BEN": "BENJAMIN", "BENNY": "BENJAMIN", "BENJ": "BENJAMIN",
	"FRED": "FREDERICK", "FREDDY": "FREDERICK", "FREDK": "FREDERICK",
	"FRANK": "FRANCIS", "FRAN": "FRANCIS", "FRAS": "FRANCIS",
	"ANDY": "ANDREW",
	"TONY": "ANTHONY", "ANT": "ANTHONY",
	"ART": "ARTHUR", "ARTIE": "ARTHUR",
	"AL": "ALBERT", "ALB": "ALBERT",
	"ALF": "ALFRED", "ALFIE": "ALFRED",
	"WALT": "WALTER", "WALLY": "WALTER",
	"PETE": "PETER",
	"STEVE": "STEPHEN", "STEPH": "STEPHEN",
	"NICK": "NICHOLAS", "NICKY": "NICHOLAS",
	"NAT": "NATHANIEL", "NATE": "NATHANIEL", "NATHL": "NATHANIEL",
	"ABE": "ABRAHAM",
	"IKE": "ISAAC",
	"LI": "ELIJAH", "LIJE": "ELIJAH",
	"MANNY": "EMANUEL", "MANUEL": "EMANUEL",
	"HARV": "HARVEY",
	"LEW": "LEWIS",
	"MOSE": "MOSES",
	"SOL": "SOLOMON",
	"TOBY": "TOBIAS",
	"JERRY": "JEREMIAH", "JER": "JEREMIAH",
	"ZEKE": "EZEKIEL",
	"NEIL": "CORNELIUS", "CORN": "CORNELIUS",
	"BART": "BARTHOLOMEW",
	"ARCH": "ARCHIBALD", "ARCHIE": "ARCHIBALD",
	"GUS": "AUGUSTUS",
	"AMB": "AMBROSE",
	"ZACH": "ZACHARIAH", "ZACK": "ZACHARIAH",
	"LIZ": "ELIZABETH", "LIZZIE": "ELIZABETH", "LIZZY": "ELIZABETH", "BETH": "ELIZABETH", "BETTY": "ELIZABETH", "BETTE": "ELIZABETH", "BESS": "ELIZABETH", "BESSIE": "ELIZABETH", "ELIZA": "ELIZABETH", "ELIZ": "ELIZABETH", "LIBBY": "ELIZABETH",
	"MOLLY": "MARY", "POLLY": "MARY", "MAE": "MARY", "MAMIE": "MARY",
	"MAG": "MARGARET", "MAGGIE": "MARGARET", "MEG": "MARGARET", "PEGGY": "MARGARET", "MARG": "MARGARET", "MARGT": "MARGARET", "RITA": "MARGARET",
	"KATE": "CATHERINE", "KATIE": "CATHERINE", "KITTY": "CATHERINE", "KATH": "CATHERINE",
	"SARA": "SARAH", "SALLY": "SARAH", "SAL": "SARAH",
	"SUE": "SUSAN", "SUSIE": "SUSAN", "SUSY": "SUSAN", "SUSA": "SUSANNAH",
	"ANNIE": "ANN", "ANNA": "ANN", "NAN": "ANN", "NANNY": "ANN",
	"HANNA": "HANNAH",
	"MART": "MARTHA", "MATTIE": "MARTHA",
	"BECCA": "REBECCA", "BECKY": "REBECCA",
	"CARRIE": "CAROLINE", "CAROL": "CAROLINE",
	"NELL": "ELEANOR", "NELLIE": "ELEANOR", "NORA": "ELEANOR",
	"FANNY": "FRANCES",
	"HATTIE": "HARRIET",
	"LOU": "LOUISA", "LULA": "LOUISA",
	"TILLY": "MATILDA", "TILLIE": "MATILDA",
	"GINNY": "VIRGINIA",
	"VINA": "LAVINIA", "VINEY": "LAVINIA",
	"PRISSY": "PRISCILLA", "CILLA": "PRISCILLA",
	"DELIA": "DELILAH", "LILA": "DELILAH",
	"LUCY": "LUCINDA",
	"PHILLIS": "PHYLLIS",
	"MINNIE": "MINERVA"
};

function normalizeFirstName(raw) {
	if (!raw) return '';

	// Remove all non-alphabetic characters except spaces, and convert to uppercase
	let cleaned = raw.toUpperCase().replace(/[^A-Z\s]/g, '');

	// Split into parts (e.g. "ROBT J" -> ["ROBT", "J"])
	let parts = cleaned.split(/\s+/);

	// Map each part if it's in the nickname dictionary
	let mappedParts = parts.map(p => {
		if (nicknames[p]) {
			return nicknames[p];
		}
		return p;
	});

	// Return the uppercase string
	return mappedParts.join(' ').trim();
}

// Post-processing Actions
actionSelect.addEventListener('change', async (e) => {
	const action = e.target.value;
	if (!action) return;

	if (action === 'expand_assertions') {
		if (!confirm('Are you sure you want to expand assertions? This will compute the deductive closure of the assertions table.')) {
			actionSelect.value = '';
			return;
		}
		await expandAssertions();
	} else if (action === 'create_narratives') {
		if (!confirm('Are you sure you want to create narratives?')) {
			actionSelect.value = '';
			return;
		}
		await ContenderNarratives();
	} else if (action === 'normalize_mentions') {
		if (!confirm('Are you sure you want to normalize all mentions fields?')) {
			actionSelect.value = '';
			return;
		}
		await normalizeMentions();
	}

	actionSelect.value = '';
});

async function normalizeMentions() {
	if (typeof actionSelect !== 'undefined') actionSelect.disabled = true;
	if (typeof progressSection !== 'undefined') progressSection.classList.remove('hidden');
	log('Starting mentions normalization...');
	const startTime = Date.now();

	try {
		// 1. Fetch all mentions
		log('Fetching mentions from database...');
		let allMentions = [];
		let offset = 0;
		const limit = 1000;
		while (true) {
			const res = await fetch(`${POSTGREST_URL}/mentions?limit=${limit}&offset=${offset}&order=mention_id.asc`, { headers: API_HEADERS });
			if (!res.ok) throw new Error('Failed to fetch mentions');
			const data = await res.json();
			if (data.length === 0) break;
			allMentions = allMentions.concat(data);
			if (typeof updateProgress !== 'undefined') {
				updateProgress(allMentions.length, allMentions.length + (data.length === limit ? limit : 0), startTime, 'mentions loaded');
			}
			if (data.length < limit) break;
			offset += limit;
		}
		log(`Loaded ${allMentions.length} mentions.`);

		// 2. Compute normalizations and identify changes
		const updates = [];
		for (const m of allMentions) {
			const normFirstName = normalizeFirstName(m.first_name);
			const soundexLastName = soundex(m.last_name);
			const nysiisLastName = simpleNysiis(m.last_name);
			const normRace = simpleRaceNorm(m.race);
			const normOcc = normalizeOccupation(m.occupation);

			const needsUpdate = 
				normFirstName !== (m.norm_first_name || '') ||
				soundexLastName !== (m.soundex_last_name || '') ||
				nysiisLastName !== (m.nysiis_last_name || '') ||
				normRace !== (m.norm_race || '') ||
				normOcc !== (m.norm_occupation || '');

			if (needsUpdate) {
				updates.push({
					mention_id: m.mention_id,
					norm_first_name: normFirstName,
					soundex_last_name: soundexLastName,
					nysiis_last_name: nysiisLastName,
					norm_race: normRace,
					norm_occupation: normOcc
				});
			}
		}

		log(`Found ${updates.length} mentions requiring normalization updates.`);

		// 3. Save updates in batches of 500 using bulk POST with merge-duplicates resolution
		const CHUNK_SIZE = 500;
		for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
			const chunk = updates.slice(i, i + CHUNK_SIZE);
			const res = await fetch(`${POSTGREST_URL}/mentions`, {
				method: 'POST',
				headers: { ...API_HEADERS, 'Prefer': 'resolution=merge-duplicates' },
				body: JSON.stringify(chunk)
			});
			if (!res.ok) {
				throw new Error(`Failed to save bulk normalization updates: ${res.status} ${await res.text()}`);
			}

			if (typeof updateProgress !== 'undefined') {
				updateProgress(i + chunk.length, updates.length, startTime, 'mentions normalized');
			}
		}

		log('Mentions normalization complete.');
		if (typeof updateProgress !== 'undefined') {
			updateProgress(100, 100, startTime, 'normalization complete');
		}

	} catch (err) {
		log(`Normalization failed: ${err.message}`, true);
	} finally {
		if (typeof actionSelect !== 'undefined') actionSelect.disabled = false;
	}
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSources);
