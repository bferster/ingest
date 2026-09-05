const POSTGREST_URL = '/api';
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
let isIngestAllMode = false;

class MentionIdGenerator {
	constructor() {
		this.usedIds = {};
	}
	generate(prefix, line, isSlaveSchedule = false) {
		let cleanLine = String(line || '').trim();
		if (!cleanLine) {
			cleanLine = 'unknown';
		}
		const baseId = `${prefix}-${cleanLine}`;
		if (isSlaveSchedule) {
			return baseId;
		}
		if (this.usedIds[baseId] === undefined) {
			this.usedIds[baseId] = 0;
			return baseId;
		} else {
			this.usedIds[baseId]++;
			return `${baseId}.${this.usedIds[baseId]}`;
		}
	}
}

function getCountyPrefix(countyCode) {
	if (!countyCode) return 'AUG';
	return countyCode;
}

function getMentionPrefix(format, county, sourceYear, row) {
	const cPrefix = getCountyPrefix(county);
	if (format.includes('Census')) {
		let year = sourceYear || '1870';
		if (format.includes('1900')) year = '1900';
		else if (format.includes('1880')) year = '1880';
		else if (format.includes('1870')) year = '1870';
		else if (format.includes('1860')) year = '1860';
		else if (format.includes('1850')) year = '1850';
		return `${cPrefix}-CN-${year}`;
	} else if (format.includes('FindAGrave')) {
		return `${cPrefix}-FG`;
	} else if (format.includes('Church')) {
		return `${cPrefix}-CH`;
	} else if (format.includes('FreeBlackRegister')) {
		return `${cPrefix}-FBR`;
	} else if (format.includes('FreedmansList')) {
		return `${cPrefix}-FL`;
	} else if (format.includes('SlaveSchedule')) {
		return `${cPrefix}-SS-${sourceYear}`;
	} else if (format.includes('SlaveBirth')) {
		return `${cPrefix}-SB`;
	} else if (format.includes('CohabFamily')) {
		return `${cPrefix}-CF`;
	} else if (format.includes('CohabChild') || format.includes('Cohab')) {
		return `${cPrefix}-CC`;
	} else if (format.includes('Death')) {
		return `${cPrefix}-DE`;
	} else if (format.includes('VitalRecord')) {
		return `${cPrefix}-VR`;
	}
	return `${cPrefix}-GEN`;
}

let idGenerator = new MentionIdGenerator();
let householdMap = new Map();
let familyMap = new Map();
let mentionRowMap = new Map();
let sourceSelectListenerAdded = false;

const countySelect = document.getElementById('county-select');
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
		const res = await fetch(`${POSTGREST_URL}/assertions?who=eq.${who}&select=subject_id,predicate,object_id&limit=${limit}&offset=${offset}&order=assertion_id.asc`, { headers: API_HEADERS });
		if (!res.ok) {
			log(`Warning: Failed to fetch existing assertions for ${who} at offset ${offset}`, true);
			break;
		}
		const data = await res.json();
		if (data.length === 0) break;
		data.forEach(a => {
			const obj = a.object_id || 'null';
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

function mapRace(str) {
	if (!str) return null;
	let r = String(str).trim().toUpperCase();
	if (r.startsWith('N') || r.startsWith('B')) return 'B'; // Negro, Black
	if (r.startsWith('M')) return 'M'; // Mulatto
	if (r.startsWith('W') || r.startsWith('C')) return 'W'; // White, Cauc
	if (r.startsWith('I')) return 'I'; // Indian
	if (r.startsWith('Y')) return 'Y'; // Yellow

	r = r.charAt(0);
	if (['B', 'M', 'W', 'C', 'I', 'Y'].includes(r)) return r;
	return null;
}

function mapGender(str) {
	if (!str) return null;
	let g = String(str).trim().toUpperCase().charAt(0);
	if (g === 'M' || g === 'F') return g;
	return null;
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
	const selectedCounty = countySelect ? countySelect.value : null;

	sourcesData.forEach((source, index) => {
		if ((source.title || source.display_name) && source.county && (!selectedCounty || source.county === selectedCounty)) {
			const option = document.createElement('option');
			option.value = index;
			option.textContent = source.title || source.display_name;
			sourceSelect.appendChild(option);
		}
	});

	if (!sourceSelectListenerAdded) {
		sourceSelect.addEventListener('change', () => {
			if (sourceSelect.value !== "") {
				isIngestAllMode = false;
				if (processBtn) processBtn.textContent = 'Agree & Process File';
				loadSourcePreview();
			} else {
				previewSection.classList.add('hidden');
				progressSection.classList.add('hidden');
			}
		});

		if (countySelect) {
			countySelect.addEventListener('change', () => {
				isIngestAllMode = false;
				if (processBtn) processBtn.textContent = 'Agree & Process File';
				populateSourceDropdown();
				previewSection.classList.add('hidden');
				progressSection.classList.add('hidden');
			});
		}

		if (actionSelect) {
			actionSelect.addEventListener('change', async () => {
				const val = actionSelect.value;
				if (!val) return;
				if (val === 'expand_assertions') {
					if (!confirm('Are you sure you want to expand assertions? This will compute the deductive closure of the assertions table.')) {
						actionSelect.value = '';
						return;
					}
					if (typeof expandAssertions === 'function') await expandAssertions();
				} else if (val === 'create_narratives') {
					if (!confirm('Are you sure you want to create narratives?')) {
						actionSelect.value = '';
						return;
					}
					if (typeof ContenderNarratives === 'function') await ContenderNarratives();
				} else if (val === 'ingest_crosswalk') {
					const selectedCounty = countySelect ? countySelect.value : 'AUG';
					if (!confirm(`Are you sure you want to ingest crosswalk assertions for county ${selectedCounty}?`)) {
						actionSelect.value = '';
						return;
					}
					if (typeof ingestCrosswalkAssertions === 'function') await ingestCrosswalkAssertions(selectedCounty);
				} else if (val === 'ingest_all') {
					isIngestAllMode = true;
					const selectedCounty = countySelect ? countySelect.value : null;
					const countySources = sourcesData.filter(source => (source.title || source.display_name) && source.county && (!selectedCounty || source.county === selectedCounty));
					const validSource = countySources.find(s => s.url && s.url.trim().startsWith('http')) || countySources[0];
					if (validSource) {
						const globalIndex = sourcesData.indexOf(validSource);
						if (globalIndex !== -1 && sourceSelect) {
							sourceSelect.value = globalIndex;
							await loadSourcePreview();
						}
					}
					if (processBtn) processBtn.textContent = 'Agree & Process All Sources';
					log(`"Ingest all sources" mode staged for county ${selectedCounty || 'selected'}. Sample data loaded. Set your row limit options and click "Agree & Process All Sources" to start batch ingestion.`);
				}
				actionSelect.value = '';
			});
		}

		sourceSelectListenerAdded = true;
	}
}

// 2. Load Preview
async function loadSourcePreview() {
	const selectedIndex = sourceSelect.value;
	if (selectedIndex === "") return;

	selectedSource = sourcesData[selectedIndex];
	const url = selectedSource.url;
	const sourceLabel = selectedSource.title ? `${selectedSource.title} (${selectedSource.display_name})` : selectedSource.display_name;

	if (!url || !url.trim().startsWith('http')) {
		log(`Source "${sourceLabel}" does not have a valid URL configured (${url || 'empty'}).`);
		previewSection.classList.add('hidden');
		processBtn.disabled = true;
		return;
	}

	log(`Loading data for "${sourceLabel}" from URL: ${url}`);
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

			currentConfidence = await getConfidenceForSource(selectedSource);
			log(`Set confidence ${currentConfidence} for ${selectedSource.display_name}.`);
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

	try {
		if (isIngestAllMode) {
			await ingestAllSources();
		} else {
			await ingestSingleSource(selectedSource, currentCsvData, limitCheckbox.checked);
		}
		log(`Ingestion batch complete.`);
	} catch (globalErr) {
		log(`Fatal Ingestion Error: ${globalErr.message}`, true);
	} finally {
		processBtn.disabled = false;
		stopBtn.disabled = true;
		isIngestAllMode = false; // Reset mode after completion
		processBtn.textContent = 'Agree & Process File';
	}
});

function deduplicateBatchByMentionId(batch) {
	if (!batch || batch.length === 0) return batch;
	const map = new Map();
	let dropped = 0;
	batch.forEach(item => {
		if (item && item.mention_id) {
			if (map.has(item.mention_id)) dropped++;
			map.set(item.mention_id, item);
		}
	});
	if (dropped > 0) {
		log(`Warning: dropped ${dropped} row(s) in batch due to duplicate mention_id.`, true);
	}
	return Array.from(map.values());
}

function normalizeObjectKeys(batch) {
	if (!batch || batch.length === 0) return batch;
	const allKeys = new Set();
	batch.forEach(obj => {
		if (obj && typeof obj === 'object') {
			Object.keys(obj).forEach(k => allKeys.add(k));
		}
	});

	return batch.map(obj => {
		if (!obj || typeof obj !== 'object') return obj;
		const cleanObj = {};
		allKeys.forEach(key => {
			const val = obj[key];
			cleanObj[key] = (val === undefined) ? null : val;
		});
		return cleanObj;
	});
}

async function insertBatch(batch) {
	if (batch.length === 0) return;
	const uniqueBatch = deduplicateBatchByMentionId(batch);
	const batchWithoutOriginalData = uniqueBatch.map(item => {
		if (!item || typeof item !== 'object') return item;
		const clean = { ...item };
		delete clean.original_data;
		return clean;
	});
	const cleanBatch = normalizeObjectKeys(batchWithoutOriginalData);
	const postRes = await fetch(`${POSTGREST_URL}/mentions`, {
		method: 'POST',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation,resolution=merge-duplicates'
		},
		body: JSON.stringify(cleanBatch)
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

function parseValidYear(val) {
	if (val === null || val === undefined) return null;
	const s = String(val).trim();
	if (!s) return null;
	// Look for a realistic 4-digit year between 1500 and 2099
	const match = s.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
	if (match) {
		return parseInt(match[1]);
	}
	const num = parseInt(s);
	if (!isNaN(num) && num >= 1500 && num <= 2099) {
		return num;
	}
	return null;
}

async function prepareMention(row, rowIndex = -1) {
	// 1. Extract name fields using robust getRowValue
	let firstName = getRowValue(row, 'first_name') || getRowValue(row, 'given_name') || getRowValue(row, 'name') || '';
	let middleName = getRowValue(row, 'middle_name') || '';
	let lastName = getRowValue(row, 'last_name') || getRowValue(row, 'surname') || '';
	let fullName = getRowValue(row, 'full_name') || '';

	if (!fullName && (firstName || lastName)) {
		fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
	} else if (fullName && (!firstName && !lastName)) {
		const parsed = parseGeneralName(fullName);
		firstName = parsed.first;
		middleName = parsed.middle;
		lastName = parsed.last;
	}

	// 2. Extract birth_year and age using robust getRowValue
	let rawBirthYear = getRowValue(row, 'birth_year') || getRowValue(row, 'birthyear') || getRowValue(row, 'year_of_birth');
	let rawAge = getRowValue(row, 'age');

	let computedBirthYear = parseValidYear(rawBirthYear);

	if (computedBirthYear === null && rawAge !== null && rawAge !== undefined && String(rawAge).trim() !== '') {
		const age = parseInt(String(rawAge).trim());
		if (!isNaN(age) && age >= 0 && age <= 125) {
			const refYear = (selectedSource && selectedSource.year) ? (parseValidYear(selectedSource.year) || 1866) : 1866;
			computedBirthYear = refYear - age;
		}
	}
	if (isNaN(computedBirthYear)) computedBirthYear = null;

	const rawBirthPlace = getRowValue(row, 'birth_place') || getRowValue(row, 'birthplace') || getRowValue(row, 'place_of_birth') || getRowValue(row, 'birth_location') || getRowValue(row, 'born_in') || getRowValue(row, 'bplace');
	const birthPlace = (rawBirthPlace !== null && rawBirthPlace !== undefined && String(rawBirthPlace).trim() !== '') ? String(rawBirthPlace).trim() : null;

	const rawDeathYear = getRowValue(row, 'death_year');
	let deathYear = parseValidYear(rawDeathYear);
	if (deathYear === null) {
		const rawEventDate = getRowValue(row, 'event_date') || getRowValue(row, 'date');
		deathYear = parseValidYear(rawEventDate);
	}

	const rawDistrict = getRowValue(row, 'district') || getRowValue(row, 'District') || getRowValue(row, 'event_place');
	const district = (rawDistrict !== null && rawDistrict !== undefined && String(rawDistrict).trim() !== '') ? String(rawDistrict).trim() : null;

	const nysiisLastName = simpleNysiis(lastName);
	const normFirstName = normalizeFirstName(firstName);
	const rawOccupation = (getRowValue(row, 'occupation') || '').trim();
	const normOccupation = normalizeOccupation(rawOccupation);
	const rawRace = getRowValue(row, 'race');
	const normRace = simpleRaceNorm(rawRace || '');
	const rawGender = getRowValue(row, 'gender') || getRowValue(row, 'sex');

	const format = selectedSource.format || '';
	const county = selectedSource.county || 'AUG';
	const prefix = getMentionPrefix(format, county, selectedSource.year, row);
	const isSlaveSchedule = format.includes('SlaveSchedule');
	let line = getRowValue(row, 'line');
	if (!line || String(line).trim() === '') {
		line = rowIndex >= 0 ? (rowIndex + 1) : '';
	}
	const mId = idGenerator.generate(prefix, line, isSlaveSchedule);

	// 4. Construct Mention Object
	const defaultSourceYear = (selectedSource && selectedSource.year) ? (parseValidYear(selectedSource.year) || 1850) : 1850;
	const mention = {
		mention_id: mId,
		verid: null,
		source: prefix,
		source_year: defaultSourceYear,
		confidence: currentConfidence,
		full_name: fullName,
		first_name: firstName,
		middle_name: middleName,
		last_name: lastName,
		birth_year: computedBirthYear,
		birth_place: birthPlace,
		death_year: deathYear,
		race: mapRace(rawRace),
		gender: mapGender(rawGender),
		occupation: rawOccupation,
		district: district,
		norm_first_name: normFirstName,
		nysiis_last_name: nysiisLastName,
		metaphone_last_name: doubleMetaphone(lastName),
		norm_race: normRace ? normRace.substring(0, 1) : null,
		norm_occupation: normOccupation,
		head: String(getRowValue(row, 'head') || '').toUpperCase() === 'Y' || String(getRowValue(row, 'head') || '').toLowerCase() === 'TRUE',
		legal_status: '', // Default
		household_id: rowIndex >= 0 ? (householdMap.get(rowIndex) || null) : null,
		family_id: rowIndex >= 0 ? (familyMap.get(rowIndex) || null) : null
	};

	if (format.includes('Census') && typeof Crosswalk === 'function') {
		Crosswalk(county, defaultSourceYear, mention, row, rowIndex);
	}

	await applyFormatSpecificRules(mention, row);

	// Sanitize year fields to guarantee valid smallint values
	mention.source_year = parseValidYear(mention.source_year) || defaultSourceYear;
	mention.birth_year = parseValidYear(mention.birth_year);
	mention.death_year = parseValidYear(mention.death_year);

	if (mention.last_name && String(mention.last_name).trim() !== '') {
		const cleanLast = String(mention.last_name).trim();
		mention.nysiis_last_name = simpleNysiis(cleanLast);
		mention.metaphone_last_name = doubleMetaphone(cleanLast);
	} else {
		mention.nysiis_last_name = null;
		mention.metaphone_last_name = null;
	}

	if (mention && mention.mention_id) {
		mentionRowMap.set(mention.mention_id, row);
	}

	return mention;
}

async function getDatabaseSource(source) {
	const format = source.format || '';
	const county = getCountyPrefix(source.county || 'AUG');
	if (format.includes('SlaveSchedule')) return `${county}_SS-${source.year}`;
	if (format.includes('SlaveBirth')) return `${county}_SB`;
	if (format.includes('CohabFamily')) return `${county}_CF`;
	if (format.includes('CohabChild') || format.includes('Cohab')) return `${county}_CC`;
	if (format.includes('FreeBlackRegister')) return `${county}_FBR`;
	if (format.includes('FindAGrave')) return `${county}_FindAGrave`;
	if (format.includes('FreedmansList')) return `${county}_FL-1865`;
	if (format.includes('Death')) return `${county}_DeathRecords`;
	if (format.includes('VitalRecord')) return `${county}_VR`;
	return source.display_name;
}

async function applyFormatSpecificRules(mention, row) {
	const format = selectedSource.format || '';

	// Census Formats (1850, 1860, 1870, 1880, 1900)
	if (format.includes('Census')) {
		mention.legal_status = 'F';
		if (format.includes('1880') || format.includes('1900') || (selectedSource && (String(selectedSource.year) === '1880' || String(selectedSource.year) === '1900'))) {
			mention.household_id = null;
		}

		const enumerator = getRowValue(row, 'enumerator') || '';
		const enumDate = getRowValue(row, 'enumerator_date') || getRowValue(row, 'enumerator_data') || getRowValue(row, 'enumeratordate') || getRowValue(row, 'enumeratordata') || '';
		if (enumerator || enumDate) {
			mention.enumeration = `${enumerator}:${enumDate}`;
		}
	}

	// FreeBlackRegister
	if (format.includes('FreeBlackRegister')) {
		mention.legal_status = 'F';
		mention.confidence = 0.85;

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
				row.height = inches;
			}
		} else if (row.Height) {
			const match = row.Height.match(/(\d+)\s*'\s*(\d+)\s*"?/);
			if (match) {
				const inches = parseInt(match[1]) * 12 + parseInt(match[2]);
				row.Height = inches;
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
		mention.race = 'B';
		mention.norm_race = 'B';
		const recordYear = getRowValue(row, 'record_year');
		if (recordYear) {
			const yr = parseInt(recordYear);
			if (!isNaN(yr)) mention.source_year = yr;
		}
	}

	// DeathRecords / VitalRecord
	if (format.includes('Death') || format.includes('VitalRecord')) {
		mention.confidence = 0.9;
		const rYear = getRowValue(row, 'record_year') || getRowValue(row, 'death_year') || getRowValue(row, 'event_date') || getRowValue(row, 'date') || getRowValue(row, 'birth_year');
		const validYear = parseValidYear(rYear);
		if (validYear) {
			mention.source_year = validYear;
		}
		const freeOrEnslaved = (getRowValue(row, 'free_or_enslaved') || '').trim().toLowerCase();
		if (freeOrEnslaved === 'enslaved' || freeOrEnslaved === 'slave') {
			mention.legal_status = 'E';
		} else if (freeOrEnslaved === 'free') {
			mention.legal_status = 'F';
		}
	}

	// Church
	if (format.includes('Church')) {
		mention.confidence = 0.85;
		mention.legal_status = 'E';
		mention.race = 'B';
		mention.norm_race = 'B';
	}

	// SlaveSchedule
	if (format.includes('SlaveSchedule')) {
		mention.confidence = 0.9;

		const enumerator = getRowValue(row, 'enumerator') || '';
		const enumDate = getRowValue(row, 'enumerator_date') || getRowValue(row, 'enumerator_data') || getRowValue(row, 'enumeratordate') || getRowValue(row, 'enumeratordata') || '';
		if (enumerator || enumDate) {
			mention.enumeration = `${enumerator}:${enumDate}`;
		}

		const statusVal = String(getRowValue(row, 'status') || getRowValue(row, 'owner') || '').trim();
		const isOwner = statusVal.toUpperCase() === 'Y' || statusVal.toLowerCase() === 'owner' || statusVal.toLowerCase() === 'enslaver';
		if (isOwner) {
			mention.legal_status = null;
			mention.head = true;
			mention.birth_year = null;
			mention.birth_place = null;
			mention.death_year = null;
			mention.gender = null;
			mention.race = 'W'; // Set enslaver's race to "W"
			mention.norm_race = 'W';
			mention.occupation = null;
			mention.norm_occupation = null;
		} else {
			mention.legal_status = 'E';
			mention.head = null;
			mention.race = 'B';
			mention.norm_race = 'B';
		}
	}

	// SlaveBirth
	if (format.includes('SlaveBirth')) {
		mention.confidence = 0.95;
		mention.legal_status = 'E';
		mention.race = 'B';
		mention.norm_race = 'B';
		const nameVal = getRowValue(row, 'name') || getRowValue(row, 'full_name');
		if (nameVal) {
			const cleanName = String(nameVal).replace(/[.,]/g, '').trim();
			mention.full_name = cleanName;
			mention.first_name = cleanName;
			mention.middle_name = '';
			mention.last_name = '';
			mention.norm_first_name = normalizeFirstName(cleanName);
		}
	}

	// CohabChild
	if (format.includes('CohabChild')) {
		mention.confidence = 0.95;
		mention.legal_status = null;
		mention.race = 'B';
		mention.norm_race = 'B';
		mention.source_year = 1866;

		const byVal = getRowValue(row, 'birth_year');
		if (byVal) {
			const parsedBy = parseInt(byVal);
			if (!isNaN(parsedBy)) mention.birth_year = parsedBy;
		} else {
			const ageVal = getRowValue(row, 'age');
			if (ageVal) {
				const parsedAge = parseInt(ageVal);
				if (!isNaN(parsedAge)) mention.birth_year = 1866 - parsedAge;
			}
		}

		const fVal = getRowValue(row, 'family');
		if (fVal) {
			mention.family_id = `FC1866-${fVal}`;
		}
	}

	// CohabFamily
	if (format.includes('CohabFamily')) {
		mention.confidence = 0.95;
		mention.legal_status = null;
		mention.gender = 'M';
		mention.race = 'B';
		mention.norm_race = 'B';
		mention.source_year = 1866;

		const hFirst = getRowValue(row, 'husband_first_name');
		const hMiddle = getRowValue(row, 'husband_middle_name');
		const hLast = getRowValue(row, 'husband_last_name');
		if (hFirst || hLast) {
			mention.first_name = hFirst || '';
			mention.middle_name = hMiddle || '';
			mention.last_name = hLast || '';
			mention.full_name = [hFirst, hMiddle, hLast].filter(Boolean).join(' ').trim();
			mention.norm_first_name = normalizeFirstName(mention.first_name);
		}

		const hBy = getRowValue(row, 'husband_birth_year') || getRowValue(row, 'husband_birthyear');
		if (hBy) {
			const parsedBy = parseInt(hBy);
			if (!isNaN(parsedBy)) mention.birth_year = parsedBy;
		}

		const hBp = getRowValue(row, 'husband_birth_place') || getRowValue(row, 'husband_birthplace');
		if (hBp && String(hBp).trim() !== '') {
			mention.birth_place = String(hBp).trim();
		}

		const hOcc = getRowValue(row, 'husband_occupation');
		if (hOcc) {
			mention.occupation = hOcc.trim();
			mention.norm_occupation = normalizeOccupation(mention.occupation);
		}

		const fVal = getRowValue(row, 'family');
		if (fVal) {
			mention.family_id = `FC1866-${fVal}`;
		}
	}
}

async function processPostHocMentions() {
	log('Starting Post-Hoc Mentions processing...');

	const dbSource = await getDatabaseSource(selectedSource);
	const format = selectedSource.format || '';
	const county = selectedSource.county || 'ALB';
	const prefix = getMentionPrefix(format, county, selectedSource.year, null);

	if (selectedSource.format.includes('Census')) {
		log('Household and family IDs pre-populated during ingestion. Skipping post-hoc updates.');
		return;
	}

	// Deduplicate mentions before further processing for non-census sources
	await removeDuplicateMentions(prefix);

	let allMentions = [];
	let offset = 0;
	const limit = 10000;

	while (true) {
		const likePattern = prefix.endsWith('VR') ? `${prefix}*` : `${prefix}-*`;
		const res = await fetch(`${POSTGREST_URL}/mentions?mention_id=like.${likePattern}&select=mention_id,source,full_name,gender,source_year,legal_status&limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
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
		log('Slave Schedule format specifies no assertions. Skipping assertion creation.');
		return;
	}

	if (selectedSource.format.includes('Death')) {
		await processDeathRecordsPostHoc(mentions);
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

	if (selectedSource.format.includes('SlaveBirth')) {
		await processSlaveBirthPostHoc(mentions);
		return;
	}

	if (selectedSource.format.includes('CohabFamily')) {
		await processCohabFamilyPostHoc(mentions);
		return;
	}

	if (selectedSource.format.includes('CohabChild')) {
		await processCohabChildPostHoc(mentions);
		return;
	}

	log(`No post-hoc mention processing defined for format "${format}". Skipping.`);
}



async function processChurchEnslaverMentions(mentions) {
	log('Processing Enslaver Mentions for Church records...');

	const enslaversToCreate = [];
	const seenEnslavers = new Map(); // enslaver_full_name -> enslaver_mention_id

	mentions.forEach(m => {
		if (m.legal_status !== 'E') return;
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;
		const eName = getRowValue(row, 'enslaver_full_name');

		if (eName && eName.trim() !== '') {
			const eFirstName = getRowValue(row, 'enslaver_first_name');
			const eMiddleName = getRowValue(row, 'enslaver_middle_name');
			const eLastName = getRowValue(row, 'enslaver_last_name');

			const { first, middle, last } = parseGeneralName(eName);

			let enslaverMentionId;
			if (seenEnslavers.has(eName)) {
				enslaverMentionId = seenEnslavers.get(eName);
			} else {
				enslaverMentionId = `${m.mention_id}.1`;
				seenEnslavers.set(eName, enslaverMentionId);
				mentionRowMap.set(enslaverMentionId, row);

				const lastVal = eLastName || last;
				enslaversToCreate.push({
					mention_id: enslaverMentionId,
					source: m.source,
					source_year: parseInt(getRowValue(row, 'record_year') || m.source_year),
					confidence: 0.85,
					full_name: eName,
					first_name: eFirstName || first,
					middle_name: eMiddleName || middle,
					last_name: lastVal,
					legal_status: '',
					race: 'W',
					norm_race: 'W',
					birth_place: null,
					district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || m.district || null,
					norm_first_name: normalizeFirstName(eFirstName || first),
					nysiis_last_name: lastVal ? simpleNysiis(lastVal) : null,
					metaphone_last_name: lastVal ? doubleMetaphone(lastVal) : null
				});
			}
		}
	});

	if (enslaversToCreate.length > 0) {
		log(`Inserting ${enslaversToCreate.length} new enslaver mentions...`);
		await insertBatch(enslaversToCreate);
	} else {
		log('No enslaver mentions to create.');
	}
}

async function processSlaveBirthPostHoc(mentions) {
	log('Processing Mother and Enslaver Mentions for Slave Birth records...');

	const additionalMentions = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		const motherName = getRowValue(row, 'mother');
		const ownerName = getRowValue(row, 'owner_full_name');

		if (motherName && motherName.trim() !== '') {
			const cleanMother = motherName.replace(/[.,]/g, '').trim();
			const motherId = `${m.mention_id}.1`;
			mentionRowMap.set(motherId, row);
			additionalMentions.push({
				mention_id: motherId,
				source: m.source,
				source_year: m.source_year,
				confidence: 0.95,
				full_name: cleanMother,
				first_name: cleanMother,
				middle_name: '',
				last_name: '',
				birth_place: null,
				gender: 'F',
				race: 'B',
				norm_race: 'B',
				legal_status: 'E',
				district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || m.district || null,
				norm_first_name: normalizeFirstName(cleanMother),
				nysiis_last_name: null,
				metaphone_last_name: null
			});
		}

		if (ownerName && ownerName.trim() !== '') {
			const cleanOwner = ownerName.replace(/[.,]/g, '').trim();
			const { first, middle, last } = parseGeneralName(cleanOwner);
			const ownerId = `${m.mention_id}.2`;
			mentionRowMap.set(ownerId, row);
			additionalMentions.push({
				mention_id: ownerId,
				source: m.source,
				source_year: m.source_year,
				confidence: 0.95,
				full_name: cleanOwner,
				first_name: first,
				middle_name: middle,
				last_name: last,
				birth_place: null,
				race: 'W',
				norm_race: 'W',
				legal_status: null,
				district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || m.district || null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			});
		}
	});

	if (additionalMentions.length > 0) {
		log(`Inserting ${additionalMentions.length} new mother/enslaver mentions for Slave Births...`);
		await insertBatch(additionalMentions);
	} else {
		log('No additional mother or enslaver mentions to create for Slave Births.');
	}
}

async function processCohabChildPostHoc(mentions) {
	log('Processing Father Mentions for Cohabitation Child records...');

	const additionalMentions = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		const fFirst = getRowValue(row, 'father_first_name');
		const fLast = getRowValue(row, 'father_last_name');

		if ((fFirst && fFirst.trim()) || (fLast && fLast.trim())) {
			const cleanFirst = fFirst ? fFirst.replace(/[.,]/g, '').trim() : '';
			const cleanLast = fLast ? fLast.replace(/[.,]/g, '').trim() : '';
			const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ');

			const fbp = getRowValue(row, 'father_birth_place') || getRowValue(row, 'father_birthplace');
			const fatherBirthPlace = (fbp && String(fbp).trim() !== '') ? String(fbp).trim() : null;
			const fatherId = `${m.mention_id}.1`;
			mentionRowMap.set(fatherId, row);

			additionalMentions.push({
				mention_id: fatherId,
				source: m.source,
				source_year: 1866,
				confidence: 0.95,
				full_name: fullName,
				first_name: cleanFirst,
				last_name: cleanLast,
				birth_place: fatherBirthPlace,
				gender: 'M',
				race: 'B',
				norm_race: 'B',
				legal_status: null,
				district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || m.district || null,
				norm_first_name: normalizeFirstName(cleanFirst),
				nysiis_last_name: cleanLast ? simpleNysiis(cleanLast) : null,
				metaphone_last_name: cleanLast ? doubleMetaphone(cleanLast) : null
			});
		}
	});

	if (additionalMentions.length > 0) {
		log(`Inserting ${additionalMentions.length} new father mentions for Cohabitation Children...`);
		await insertBatch(additionalMentions);
	} else {
		log('No father mentions to create for Cohabitation Children.');
	}
}

async function processCohabFamilyPostHoc(mentions) {
	log('Processing Wife Mentions for Cohabitation Family records...');

	const wifeMentions = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		// Skip secondary mentions
		if (m.mention_id.includes('.')) return;

		const wFirst = getRowValue(row, 'wife_first_name');
		const wMiddle = getRowValue(row, 'wife_middle_name');
		const wLast = getRowValue(row, 'wife_last_name');

		if ((wFirst && wFirst.trim()) || (wLast && wLast.trim())) {
			const cleanFirst = wFirst ? wFirst.replace(/[.,]/g, '').trim() : '';
			const cleanMiddle = wMiddle ? wMiddle.replace(/[.,]/g, '').trim() : '';
			const cleanLast = wLast ? wLast.replace(/[.,]/g, '').trim() : '';
			const fullName = [cleanFirst, cleanMiddle, cleanLast].filter(Boolean).join(' ');

			const wBy = getRowValue(row, 'wife_birth_year') || getRowValue(row, 'wife_birthyear');
			let wifeBirthYear = null;
			if (wBy) {
				const parsed = parseInt(wBy);
				if (!isNaN(parsed)) wifeBirthYear = parsed;
			}

			const wBp = getRowValue(row, 'wife_birth_place') || getRowValue(row, 'wife_birthplace');
			const wifeBirthPlace = (wBp && String(wBp).trim() !== '') ? String(wBp).trim() : null;

			const wifeId = `${m.mention_id}.1`;
			mentionRowMap.set(wifeId, row);

			wifeMentions.push({
				mention_id: wifeId,
				source: m.source,
				source_year: 1866,
				confidence: 0.95,
				full_name: fullName,
				first_name: cleanFirst,
				middle_name: cleanMiddle,
				last_name: cleanLast,
				birth_year: wifeBirthYear,
				birth_place: wifeBirthPlace,
				gender: 'F',
				race: 'B',
				norm_race: 'B',
				legal_status: null,
				district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || m.district || null,
				norm_first_name: normalizeFirstName(cleanFirst),
				nysiis_last_name: cleanLast ? simpleNysiis(cleanLast) : null,
				metaphone_last_name: cleanLast ? doubleMetaphone(cleanLast) : null
			});
		}
	});

	if (wifeMentions.length > 0) {
		log(`Inserting ${wifeMentions.length} new wife mentions for Cohabitation Families...`);
		await insertBatch(wifeMentions);
	} else {
		log('No wife mentions to create for Cohabitation Families.');
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

async function processDeathRecordsPostHoc(mentions) {
	log(`Processing Parent, Spouse, and Enslaver Mentions for ${mentions.length} Death Records mentions...`);
	let processed = 0;
	const total = mentions.length;
	const startTime = Date.now();

	const additionalMentions = [];
	const format = selectedSource.format || '';
	const county = selectedSource.county || 'AUG';
	const prefix = getMentionPrefix(format, county, selectedSource.year, null);

	for (const personMention of mentions) {
		processed++;
		if (processed % 100 === 0 || processed === total) {
			updateProgress(processed, total, startTime, 'records scanned for relatives');
		}

		// Skip if this is already a secondary mention (e.g. has .1, .2, .3, .4 suffix)
		if (personMention.mention_id && personMention.mention_id.includes('.')) {
			continue;
		}

		const row = mentionRowMap.get(personMention.mention_id) || personMention.original_data;
		if (!row) continue;

		const line = getRowValue(row, 'line') || personMention.mention_id.split('-').pop() || '1';

		// 1. Parent 1 (.1)
		const parent1Str = String(getRowValue(row, 'parent1') || '').trim();
		if (parent1Str) {
			const { first, middle, last } = parseGeneralName(parent1Str, true);
			const parent1Id = `${prefix}-${line}.1`;
			mentionRowMap.set(parent1Id, row);
			additionalMentions.push({
				mention_id: parent1Id,
				source: prefix,
				source_year: personMention.source_year,
				confidence: 0.9,
				full_name: parent1Str,
				first_name: first,
				middle_name: middle,
				last_name: last,
				race: personMention.race,
				norm_race: personMention.norm_race,
				birth_place: null,
				gender: null,
				birth_year: null,
				death_year: null,
				district: null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			});
		}

		// 2. Parent 2 (.2)
		const parent2Str = String(getRowValue(row, 'parent2') || '').trim();
		if (parent2Str) {
			const { first, middle, last } = parseGeneralName(parent2Str, true);
			const parent2Id = `${prefix}-${line}.2`;
			mentionRowMap.set(parent2Id, row);
			additionalMentions.push({
				mention_id: parent2Id,
				source: prefix,
				source_year: personMention.source_year,
				confidence: 0.9,
				full_name: parent2Str,
				first_name: first,
				middle_name: middle,
				last_name: last,
				race: personMention.race,
				norm_race: personMention.norm_race,
				birth_place: null,
				gender: null,
				birth_year: null,
				death_year: null,
				district: null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			});
		}

		// 3. Spouse (.3)
		const spouseStr = String(getRowValue(row, 'spouse_name') || getRowValue(row, 'spouse') || '').trim();
		if (spouseStr) {
			const { first, middle, last } = parseGeneralName(spouseStr);
			const spouseId = `${prefix}-${line}.3`;
			mentionRowMap.set(spouseId, row);
			additionalMentions.push({
				mention_id: spouseId,
				source: prefix,
				source_year: personMention.source_year,
				confidence: 0.9,
				full_name: spouseStr,
				first_name: first,
				middle_name: middle,
				last_name: last,
				race: personMention.race,
				norm_race: personMention.norm_race,
				birth_place: null,
				gender: null,
				birth_year: null,
				death_year: null,
				district: null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			});
		}

		// 4. Owner / Enslaver (.4)
		const ownerStr = String(getRowValue(row, 'owner_name') || getRowValue(row, 'owner') || '').trim();
		if (ownerStr) {
			const { first, middle, last } = parseGeneralName(ownerStr);
			const ownerId = `${prefix}-${line}.4`;
			mentionRowMap.set(ownerId, row);
			additionalMentions.push({
				mention_id: ownerId,
				source: prefix,
				source_year: personMention.source_year,
				confidence: 0.9,
				full_name: ownerStr,
				first_name: first,
				middle_name: middle,
				last_name: last,
				race: 'W',
				norm_race: 'W',
				birth_place: null,
				gender: null,
				birth_year: null,
				death_year: null,
				district: null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			});
		}
	}

	if (additionalMentions.length === 0) {
		log('No parent, spouse, or owner mentions to create for Death Records.');
		return;
	}

	log(`Writing ${additionalMentions.length} additional mentions for Death Records...`);
	const BATCH_SIZE = 1000;
	const batches = [];
	for (let i = 0; i < additionalMentions.length; i += BATCH_SIZE) {
		batches.push(additionalMentions.slice(i, i + BATCH_SIZE));
	}

	let written = 0;
	const pStartTime = Date.now();
	const CONCURRENCY = 10;
	for (let i = 0; i < batches.length; i += CONCURRENCY) {
		const chunk = batches.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (batch) => {
			try {
				await insertBatch(batch);
				written += batch.length;
			} catch (err) {
				log(`Failed to write death record mention batch: ${err.message}`, true);
			}
			updateProgress(written, additionalMentions.length, pStartTime, 'death record mentions written');
		}));
	}
	log(`Successfully added ${written} additional mentions for Death Records.`);
}

async function processVitalRecordPostHoc(mentions) {
	log(`Processing Parent Mentions for ${mentions.length} Vital Records mentions...`);
	let processed = 0;
	const total = mentions.length;
	const startTime = Date.now();

	const parentsToCreate = [];
	const format = selectedSource.format || '';
	const county = selectedSource.county || 'AUG';
	const prefix = getMentionPrefix(format, county, selectedSource.year, null);

	for (const personMention of mentions) {
		processed++;
		if (processed % 100 === 0 || processed === total) {
			updateProgress(processed, total, startTime, 'records scanned for parents');
		}

		// Skip if this is already a parent mention (e.g. has .1 or .2 suffix)
		if (personMention.mention_id && personMention.mention_id.includes('.')) {
			continue;
		}

		const row = mentionRowMap.get(personMention.mention_id) || personMention.original_data;
		if (!row) continue;

		const parentsStr = String(getRowValue(row, 'parents') || getRowValue(row, 'Parents') || '').trim();
		if (!parentsStr) continue;

		const parentNames = parentsStr.split(',').map(p => p.trim()).filter(Boolean);
		if (parentNames.length === 0) continue;

		const line = getRowValue(row, 'line') || personMention.mention_id.split('-').pop() || '1';

		for (let pIdx = 0; pIdx < parentNames.length; pIdx++) {
			const pName = parentNames[pIdx];
			if (!pName) continue;

			const { first, middle, last } = parseGeneralName(pName, true);
			const parentId = `${prefix}-${line}.${pIdx + 1}`;
			mentionRowMap.set(parentId, row);

			const parentMention = {
				mention_id: parentId,
				source: prefix,
				source_year: personMention.source_year,
				confidence: 0.9,
				full_name: pName.trim(),
				first_name: first,
				middle_name: middle,
				last_name: last,
				birth_place: null,
				gender: null,
				birth_year: null,
				death_year: null,
				district: (getRowValue(row, 'district') ? String(getRowValue(row, 'district')).trim() : null) || personMention.district || null,
				norm_first_name: normalizeFirstName(first),
				nysiis_last_name: last ? simpleNysiis(last) : null,
				metaphone_last_name: last ? doubleMetaphone(last) : null
			};

			parentsToCreate.push(parentMention);
		}
	}

	if (parentsToCreate.length === 0) {
		log('No parent mentions to create for Vital Records.');
		return;
	}

	log(`Writing ${parentsToCreate.length} parent mentions for Vital Records...`);
	const BATCH_SIZE = 1000;
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
	log(`Successfully added ${parentsWritten} parent mentions.`);
}

async function processPostHocAssertions() {
	log('Starting Post-Hoc Assertions processing...');

	const dbSource = await getDatabaseSource(selectedSource);
	const format = selectedSource.format || '';
	const county = selectedSource.county || 'AUG';
	const prefix = getMentionPrefix(format, county, selectedSource.year, null);

	let allMentions = [];
	let offset = 0;
	const limit = 10000;

	while (true) {
		const likePattern = prefix.endsWith('VR') ? `${prefix}*` : `${prefix}-*`;
		const res = await fetch(`${POSTGREST_URL}/mentions?mention_id=like.${likePattern}&select=mention_id,full_name,gender,source_year,family_id,household_id,legal_status,head&limit=${limit}&offset=${offset}&order=mention_id.asc`, { headers: API_HEADERS });
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
		log('Slave Schedule assertions already processed in mentions phase.');
	} else if (selectedSource.format.includes('Death')) {
		await processDeathRecordsAssertions(mentions);
	} else if (selectedSource.format.includes('VitalRecord')) {
		await processVitalRecordAssertions(mentions);
	} else if (selectedSource.format.includes('Church')) {
		await processChurchAssertions(mentions);
	} else if (selectedSource.format.includes('SlaveBirth')) {
		await processSlaveBirthAssertions(mentions);
	} else if (selectedSource.format.includes('CohabFamily')) {
		await processCohabFamilyAssertions(mentions);
	} else if (selectedSource.format.includes('CohabChild')) {
		await processCohabChildAssertions(mentions);
	} else if (selectedSource.format.includes('Census')) {
		const yearNum = parseInt(selectedSource.year);
		if (yearNum === 1850 || yearNum === 1860 || yearNum === 1870) {
			log(`Skipping post-hoc assertions for ${selectedSource.year} Census.`);
			await removeDuplicateAssertions();
			return;
		}

		// Sort by line number from source row to maintain enumeration order
		mentions.sort((a, b) => {
			const rowA = mentionRowMap.get(a.mention_id) || a.original_data;
			const rowB = mentionRowMap.get(b.mention_id) || b.original_data;
			const lineA = parseInt(getRowValue(rowA, 'line') || 0);
			const lineB = parseInt(getRowValue(rowB, 'line') || 0);
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
		const whoTag = `${selectedSource.year}Census`;
		log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
		const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
		log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

		log(`Matching relationships for ${totalGroups} family/household groups...`);

		for (const [groupId, members] of Object.entries(groups)) {
			matchedCount++;
			if (matchedCount % 10 === 0 || matchedCount === totalGroups) {
				updateProgress(matchedCount, totalGroups, startTime, 'groups matched');
			}

			const head = members.find(m => {
				const row = mentionRowMap.get(m.mention_id) || m.original_data;
				return m.head === true || String(getRowValue(row, 'head') || '').toUpperCase() === 'Y' || String(getRowValue(row, 'head') || '').toLowerCase() === 'true';
			});
			if (!head) continue;

			for (let i = 0; i < members.length; i++) {
				const self = members[i];

				// Skip head for relation identification as per instruction 74
				if (self.mention_id === head.mention_id) continue;

				let predicate = null;
				let confidence = 0.5;
				let who = `${selectedSource.year}Census`;

				const isRelationBased = selectedSource.year == 1880 || selectedSource.year == 1900 || selectedSource.format.includes('1900');

				if (isRelationBased) {
					who = `${selectedSource.year}Census`;
					confidence = 0.9;
					// 1880/1900 Census Logic (Relation-based)
					const row = mentionRowMap.get(self.mention_id) || self.original_data;
					const relation = getRowValue(row, 'relation');
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
							"uncle": "isPiblingOf",
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
				}

				if (predicate) {
					let subjId = isRelationBased ? self.mention_id : head.mention_id;
					let objId = isRelationBased ? head.mention_id : self.mention_id;

					if (subjId && objId) {
						const aKey = `${subjId}|${predicate}|${objId}`;
						if (!existingAssertionKeys.has(aKey)) {
							assertionsToCreate.push({
								subject_id: subjId,
								predicate: predicate,
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
		const BATCH_SIZE = 1000;
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
					const written = await saveAssertionsBatch(batch);
					assertionsWritten += written;
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
		const res = await fetch(`${POSTGREST_URL}/assertions?select=assertion_id,subject_id,predicate,object_id,who,confidence&limit=${limit}&offset=${offset}&order=assertion_id.asc`, { headers: API_HEADERS });
		if (!res.ok) {
			const errText = await res.text();
			log(`Error fetching assertions for cleanup: ${errText}`, true);
			throw new Error('Failed to fetch assertions for cleanup');
		}
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
		// Key must account for object_id to be unique
		const objValue = a.object_id || 'null';
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
				return 0;
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

async function removeDuplicateMentions(prefix) {
	if (selectedSource && selectedSource.format && selectedSource.format.includes('Census')) {
		log('Skipping mention deduplication for Census sources (all rows are distinct individuals).');
		return;
	}
	log('Checking for duplicate mentions to remove...');
	let allMentions = [];
	let offset = 0;
	const limit = 10000;
	while (true) {
		const likePattern = prefix.endsWith('VR') ? `${prefix}*` : `${prefix}-*`;
		const res = await fetch(`${POSTGREST_URL}/mentions?mention_id=like.${likePattern}&select=mention_id,full_name,gender,race,birth_year,birth_place,occupation,legal_status,household_id,family_id,district,head,source,source_year&limit=${limit}&offset=${offset}&order=mention_id.asc`, { headers: API_HEADERS });
		if (!res.ok) throw new Error('Failed to fetch mentions for cleanup');
		const data = await res.json();
		if (data.length === 0) break;
		allMentions = allMentions.concat(data);
		if (data.length < limit) break;
		offset += limit;
	}

	const groups = {};
	allMentions.forEach(m => {
		const key = `${m.full_name || ''}|${m.gender || ''}|${m.race || ''}|${m.birth_year || ''}|${m.birth_place || ''}|${m.occupation || ''}|${m.household_id || ''}|${m.family_id || ''}|${m.source || ''}|${m.source_year || ''}`;
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
	if (!assertions || assertions.length === 0) return 0;
	const cleanAssertions = normalizeObjectKeys(assertions);
	const res = await fetch(`${POSTGREST_URL}/assertions`, {
		method: 'POST',
		headers: API_HEADERS,
		body: JSON.stringify(cleanAssertions)
	});
	if (res.ok) {
		return cleanAssertions.length;
	}

	// If batch failed and size > 1, recursively split into two smaller batches
	if (cleanAssertions.length > 1) {
		const mid = Math.floor(cleanAssertions.length / 2);
		const left = cleanAssertions.slice(0, mid);
		const right = cleanAssertions.slice(mid);
		const leftCount = await saveAssertionsBatch(left);
		const rightCount = await saveAssertionsBatch(right);
		return leftCount + rightCount;
	}

	// If a single assertion failed, log the specific error and skip it without crashing the batch
	const err = await res.text();
	const item = cleanAssertions[0];
	log(`Warning: Failed to save assertion (${item.subject_id} ${item.predicate} ${item.object_id}): ${err}`, true);
	return 0;
}



async function processVitalRecordAssertions(mentions) {
	log(`Creating Parent-Child assertions for ${mentions.length} Vital Records mentions...`);

	const whoTag = 'vitalRecords';
	log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

	// Group mentions by base mention ID (e.g. AUG-VR-1)
	const groups = new Map();

	mentions.forEach(m => {
		const mId = m.mention_id || '';
		const dotIdx = mId.lastIndexOf('.');
		let baseId = mId;
		let isParent = false;
		if (dotIdx !== -1) {
			baseId = mId.substring(0, dotIdx);
			isParent = true;
		}

		if (!groups.has(baseId)) {
			groups.set(baseId, { person: null, parents: [] });
		}
		const g = groups.get(baseId);
		if (isParent) {
			g.parents.push(m);
		} else {
			g.person = m;
		}
	});

	const assertionsToCreate = [];

	for (const [baseId, group] of groups.entries()) {
		const person = group.person;
		if (!person) continue;

		const row = mentionRowMap.get(person.mention_id) || person.original_data;
		const startYear = person.source_year || (row ? (getRowValue(row, 'record_year') || getRowValue(row, 'birth_year')) : null) || parseInt(selectedSource.year) || null;

		for (const parent of group.parents) {
			const aKey = `${parent.mention_id}|isParentOf|${person.mention_id}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: parent.mention_id,
					predicate: 'isParentOf',
					object_id: person.mention_id,
					who: whoTag,
					start_year: startYear ? parseInt(startYear) : null,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(aKey);
			}
		}
	}

	log(`Writing ${assertionsToCreate.length} Vital Records assertions...`);
	const BATCH_SIZE = 1000;
	const assertionBatches = [];
	for (let i = 0; i < assertionsToCreate.length; i += BATCH_SIZE) {
		assertionBatches.push(assertionsToCreate.slice(i, i + BATCH_SIZE));
	}

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
		}));
		updateProgress(count, assertionsToCreate.length, startTime, 'assertions written');
	}
	log(`Created ${count} parent-child assertions for Vital Records.`);
}

async function processDeathRecordsAssertions(mentions) {
	log(`Creating assertions for ${mentions.length} Death Records mentions...`);

	const whoTag = 'deathRecords';
	log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

	const assertionsToCreate = [];

	mentions.forEach(m => {
		// Only primary mentions generate assertions
		if (m.mention_id && m.mention_id.includes('.')) return;

		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		const startYear = m.source_year || (row ? (getRowValue(row, 'record_year') || getRowValue(row, 'death_year') || getRowValue(row, 'event_date') || getRowValue(row, 'birth_year')) : null) || (selectedSource ? selectedSource.year : null);
		const parsedYear = parseValidYear(startYear) || (selectedSource ? parseValidYear(selectedSource.year) : null) || null;

		const parent1Str = String(getRowValue(row, 'parent1') || '').trim();
		const parent2Str = String(getRowValue(row, 'parent2') || '').trim();
		const spouseStr = String(getRowValue(row, 'spouse_name') || getRowValue(row, 'spouse') || '').trim();
		const ownerStr = String(getRowValue(row, 'owner_name') || getRowValue(row, 'owner') || '').trim();

		const parent1Id = `${m.mention_id}.1`;
		const parent2Id = `${m.mention_id}.2`;
		const spouseId = `${m.mention_id}.3`;
		const ownerId = `${m.mention_id}.4`;

		// Parent 1 -> isParentOf -> person
		if (parent1Str) {
			const aKey = `${parent1Id}|isParentOf|${m.mention_id}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: parent1Id,
					predicate: 'isParentOf',
					object_id: m.mention_id,
					who: whoTag,
					start_year: parsedYear,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(aKey);
			}
		}

		// Parent 2 -> isParentOf -> person
		if (parent2Str) {
			const aKey = `${parent2Id}|isParentOf|${m.mention_id}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: parent2Id,
					predicate: 'isParentOf',
					object_id: m.mention_id,
					who: whoTag,
					start_year: parsedYear,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(aKey);
			}
		}

		// Spouse -> isSpouseOf -> person
		if (spouseStr) {
			const aKey = `${spouseId}|isSpouseOf|${m.mention_id}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: spouseId,
					predicate: 'isSpouseOf',
					object_id: m.mention_id,
					who: whoTag,
					start_year: parsedYear,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(aKey);
			}
		}

		// Owner -> wasEnslavedBy assertions
		if (ownerStr) {
			// Person wasEnslavedBy owner
			const pKey = `${m.mention_id}|wasEnslavedBy|${ownerId}`;
			if (!existingAssertionKeys.has(pKey)) {
				assertionsToCreate.push({
					subject_id: m.mention_id,
					predicate: 'wasEnslavedBy',
					object_id: ownerId,
					who: whoTag,
					start_year: parsedYear,
					end_year: null,
					confidence: 0.80
				});
				existingAssertionKeys.add(pKey);
			}

			// Parent 1 wasEnslavedBy owner
			if (parent1Str) {
				const p1Key = `${parent1Id}|wasEnslavedBy|${ownerId}`;
				if (!existingAssertionKeys.has(p1Key)) {
					assertionsToCreate.push({
						subject_id: parent1Id,
						predicate: 'wasEnslavedBy',
						object_id: ownerId,
						who: whoTag,
						start_year: parsedYear,
						end_year: null,
						confidence: 0.80
					});
					existingAssertionKeys.add(p1Key);
				}
			}

			// Parent 2 wasEnslavedBy owner
			if (parent2Str) {
				const p2Key = `${parent2Id}|wasEnslavedBy|${ownerId}`;
				if (!existingAssertionKeys.has(p2Key)) {
					assertionsToCreate.push({
						subject_id: parent2Id,
						predicate: 'wasEnslavedBy',
						object_id: ownerId,
						who: whoTag,
						start_year: parsedYear,
						end_year: null,
						confidence: 0.80
					});
					existingAssertionKeys.add(p2Key);
				}
			}

			// Spouse wasEnslavedBy owner
			if (spouseStr) {
				const sKey = `${spouseId}|wasEnslavedBy|${ownerId}`;
				if (!existingAssertionKeys.has(sKey)) {
					assertionsToCreate.push({
						subject_id: spouseId,
						predicate: 'wasEnslavedBy',
						object_id: ownerId,
						who: whoTag,
						start_year: parsedYear,
						end_year: null,
						confidence: 0.80
					});
					existingAssertionKeys.add(sKey);
				}
			}
		}
	});

	if (assertionsToCreate.length === 0) {
		log('No assertions to create for Death Records.');
		return;
	}

	log(`Writing ${assertionsToCreate.length} Death Records assertions...`);
	const BATCH_SIZE = 1000;
	const assertionBatches = [];
	for (let i = 0; i < assertionsToCreate.length; i += BATCH_SIZE) {
		assertionBatches.push(assertionsToCreate.slice(i, i + BATCH_SIZE));
	}

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
				log(`Failed to write Death Record assertion batch: ${err.message}`, true);
			}
		}));
		updateProgress(count, assertionsToCreate.length, startTime, 'assertions written');
	}
	log(`Created ${count} assertions for Death Records.`);
}

async function processChurchAssertions(mentions) {
	log('Creating wasEnslavedBy assertions for Church records...');

	const county = getCountyPrefix(selectedSource.county || 'AUG');
	const dbSource = `${county}-CH`;
	const enslaved = mentions.filter(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		return m.legal_status === 'E' && getRowValue(row, 'enslaver_full_name');
	});
	if (enslaved.length === 0) {
		log('No enslaved persons with enslavers found in these records.');
		return;
	}

	log(`Checking for existing ${dbSource} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(dbSource);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${dbSource}.`);

	const assertionsToCreate = [];
	// Mirrors the dedup in processChurchEnslaverMentions: repeated enslaver_full_name
	// values share a single enslaver mention (id'd off the first enslaved person seen).
	const seenEnslavers = new Map();

	for (const m of enslaved) {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		const enslaverName = getRowValue(row, 'enslaver_full_name');
		if (enslaverName && enslaverName.trim() !== '') {
			let objValue;
			if (seenEnslavers.has(enslaverName)) {
				objValue = seenEnslavers.get(enslaverName);
			} else {
				objValue = `${m.mention_id}.1`;
				seenEnslavers.set(enslaverName, objValue);
			}
			const aKey = `${m.mention_id}|wasEnslavedBy|${objValue}`;
			if (!existingAssertionKeys.has(aKey)) {
				assertionsToCreate.push({
					subject_id: m.mention_id,
					predicate: 'wasEnslavedBy',
					object_id: objValue,
					who: dbSource,
					start_year: parseInt(getRowValue(row, 'record_year') || selectedSource.year),
					end_year: null,
					confidence: 0.85
				});
				existingAssertionKeys.add(aKey);
			}
		}
	}

	log(`Writing ${assertionsToCreate.length} assertions...`);
	const BATCH_SIZE = 1000;
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

async function processSlaveBirthAssertions(mentions) {
	log('Creating assertions for Slave Birth records...');

	const county = getCountyPrefix(selectedSource.county || 'AUG');
	const whoTag = `${county}-SB`;

	log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

	const assertionsToCreate = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		// Primary mention is child (e.g. AUG-SB-1)
		if (m.mention_id.includes('.')) return;

		const motherName = getRowValue(row, 'mother');
		const ownerName = getRowValue(row, 'owner_full_name');
		const birthYear = m.birth_year || m.source_year;

		const childId = m.mention_id;
		const motherId = `${m.mention_id}.1`;
		const ownerId = `${m.mention_id}.2`;

		if (motherName && motherName.trim() !== '') {
			const mKey = `${motherId}|isParentOf|${childId}`;
			if (!existingAssertionKeys.has(mKey)) {
				assertionsToCreate.push({
					subject_id: motherId,
					predicate: 'isParentOf',
					object_id: childId,
					who: whoTag,
					start_year: birthYear,
					end_year: null,
					confidence: 0.95
				});
				existingAssertionKeys.add(mKey);
			}
		}

		if (ownerName && ownerName.trim() !== '') {
			const eKey = `${childId}|wasEnslavedBy|${ownerId}`;
			if (!existingAssertionKeys.has(eKey)) {
				assertionsToCreate.push({
					subject_id: childId,
					predicate: 'wasEnslavedBy',
					object_id: ownerId,
					who: whoTag,
					start_year: birthYear,
					end_year: null,
					confidence: 0.95
				});
				existingAssertionKeys.add(eKey);
			}

			if (motherName && motherName.trim() !== '') {
				const meKey = `${motherId}|wasEnslavedBy|${ownerId}`;
				if (!existingAssertionKeys.has(meKey)) {
					assertionsToCreate.push({
						subject_id: motherId,
						predicate: 'wasEnslavedBy',
						object_id: ownerId,
						who: whoTag,
						start_year: birthYear,
						end_year: null,
						confidence: 0.95
					});
					existingAssertionKeys.add(meKey);
				}
			}
		}
	});

	if (assertionsToCreate.length > 0) {
		log(`Writing ${assertionsToCreate.length} Slave Birth assertions...`);
		await saveAssertionsBatch(assertionsToCreate);
		log(`Created ${assertionsToCreate.length} assertions for Slave Births.`);
	} else {
		log('No new assertions to create for Slave Births.');
	}
}

async function processCohabChildAssertions(mentions) {
	log('Creating assertions for Cohabitation Child records...');

	const county = getCountyPrefix(selectedSource.county || 'AUG');
	const whoTag = `${county}-CC`;

	log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

	const assertionsToCreate = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		// Skip secondary mentions (father is .1)
		if (m.mention_id.includes('.')) return;

		const fFirst = getRowValue(row, 'father_first_name');
		const fLast = getRowValue(row, 'father_last_name');

		if ((fFirst && fFirst.trim()) || (fLast && fLast.trim())) {
			const childId = m.mention_id;
			const fatherId = `${m.mention_id}.1`;
			const fKey = `${fatherId}|isParentOf|${childId}`;

			if (!existingAssertionKeys.has(fKey)) {
				assertionsToCreate.push({
					subject_id: fatherId,
					predicate: 'isParentOf',
					object_id: childId,
					who: whoTag,
					start_year: 1866,
					end_year: null,
					confidence: 0.95
				});
				existingAssertionKeys.add(fKey);
			}
		}
	});

	if (assertionsToCreate.length > 0) {
		log(`Writing ${assertionsToCreate.length} Cohabitation Child assertions...`);
		await saveAssertionsBatch(assertionsToCreate);
		log(`Created ${assertionsToCreate.length} assertions for Cohabitation Children.`);
	} else {
		log('No new assertions to create for Cohabitation Children.');
	}
}

async function processCohabFamilyAssertions(mentions) {
	log('Creating isSpouseOf assertions for Cohabitation Family records...');

	const county = getCountyPrefix(selectedSource.county || 'AUG');
	const whoTag = `${county}-CF`;

	log(`Checking for existing ${whoTag} assertions to avoid duplicates...`);
	const existingAssertionKeys = await fetchExistingAssertionKeys(whoTag);
	log(`Found ${existingAssertionKeys.size} existing assertions for ${whoTag}.`);

	const assertionsToCreate = [];

	mentions.forEach(m => {
		const row = mentionRowMap.get(m.mention_id) || m.original_data;
		if (!row) return;

		// Skip secondary mentions (wife is .1)
		if (m.mention_id.includes('.')) return;

		const wFirst = getRowValue(row, 'wife_first_name');
		const wLast = getRowValue(row, 'wife_last_name');

		if ((wFirst && wFirst.trim()) || (wLast && wLast.trim())) {
			const husbandId = m.mention_id;
			const wifeId = `${m.mention_id}.1`;
			const sKey = `${husbandId}|isSpouseOf|${wifeId}`;

			if (!existingAssertionKeys.has(sKey)) {
				assertionsToCreate.push({
					subject_id: husbandId,
					predicate: 'isSpouseOf',
					object_id: wifeId,
					who: whoTag,
					start_year: 1866,
					end_year: null,
					confidence: 0.95
				});
				existingAssertionKeys.add(sKey);
			}
		}
	});

	if (assertionsToCreate.length > 0) {
		log(`Writing ${assertionsToCreate.length} Cohabitation Family assertions...`);
		await saveAssertionsBatch(assertionsToCreate);
		log(`Created ${assertionsToCreate.length} assertions for Cohabitation Families.`);
	} else {
		log('No new assertions to create for Cohabitation Families.');
	}
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


/*///////////////////////////////////////////////////////////////////////////////////////////////////////////////

 * doubleMetaphone.js
 *
 * Double Metaphone phonetic algorithm as standard JavaScript functions.
 * Original algorithm by Lawrence Philips (1990, improved 2000).
 *
 * doubleMetaphone(word)  → colon-separated string 'primary:secondary'
 * doubleMetaphoneMatchScore(word1, word2)  → 0.0 | 0.6 | 0.8 | 1.0
 *
 * Usage:
 *   doubleMetaphone('Smith');                        // => 'SM0:XMT'
 *   doubleMetaphoneMatchScore('Smith', 'Smyth');     // => 1.0
 */

/**
 * Returns a match-confidence score between two words based on their
 * Double Metaphone codes.
 * @param {string} word1
 * @param {string} word2
 * @returns {number} 1.0 | 0.8 | 0.6 | 0.0
 */

function doubleMetaphoneMatchScore(word1, word2) {
	const [p1, s1] = doubleMetaphone(word1).split(':');
	const [p2, s2] = doubleMetaphone(word2).split(':');
	if (p1 === p2) return 1.0;        // Both primaries match → highest confidence
	if (p1 === s2 || s1 === p2) return 0.8; // Primary matches other's secondary
	if (s1 === s2) return 0.6;        // Only secondaries match → weakest
	return 0.0;                        // No match
}

/**
 * Encodes a word using the Double Metaphone algorithm.
 * @param {string} word
 * @returns {string} 'primary:secondary' codes
 */

function doubleMetaphone(word) {
	if (!word || typeof word !== "string") return ":";

	// Keep original (for multi-word checks like 'san jose')
	const originalUpper = word.toUpperCase();

	// Uppercase and strip non-alpha characters
	let str = word.toUpperCase().replace(/[^A-Z]/g, "");
	if (str.length === 0) return ":";

	const length = str.length;
	let primary = "";
	let secondary = "";
	let index = 0;

	// Helper: safe character access (returns "" if out of range)
	const charAt = (i) => (i >= 0 && i < str.length ? str[i] : "");

	// Helper: check if a substring at position matches any of the given strings
	const contains = (start, len, ...values) => {
		const sub = str.substring(start, start + len);
		return values.includes(sub);
	};

	// Helper: is character a vowel? (guards against out-of-range empty string)
	const isVowel = (i) => {
		const ch = charAt(i);
		return ch !== "" && "AEIOU".includes(ch);
	};

	// Helper: is character a slavo-germanic indicator present in the word?
	const isSlavoGermanic = () =>
		str.includes("W") ||
		str.includes("K") ||
		str.includes("CZ") ||
		str.includes("WITZ");

	// Helper: add codes to primary and secondary
	const add = (p, s) => {
		primary += p;
		secondary += s !== undefined ? s : p;
	};

	// Handle leading silent letters and special cases
	// Note: PS is also a silent pair (psalm, psycho) but PF is NOT (pfister keeps PF)
	if (contains(0, 2, "AE", "GN", "KN", "PN", "WR", "PS")) {
		index++;
	}

	// Initial vowel maps to "A"
	if (charAt(0) === "A" || isVowel(0)) {
		add("A");
		index++;
	}

	const slavoGermanic = isSlavoGermanic();

	while (index < length) {
		const c = charAt(index);

		switch (c) {
			case "A":
			case "E":
			case "I":
			case "O":
			case "U":
			case "Y":
				// Vowels only coded at start (already handled above); others are skipped
				if (index === 0) add("A");
				index++;
				break;

			case "X":
				// Initial X → S primary, S secondary (Xavier-class words in English).
				// Non-initial X is handled later in this same case.
				if (index === 0) {
					add("S");
					index++;
					break;
				}
				// Non-initial X handled in the dedicated X case below
				if (
					!(index === length - 1 &&
						(contains(index - 3, 3, "IAU", "EAU") ||
							contains(index - 2, 2, "AU", "OU")))
				) {
					add("KS");
				}
				index += contains(index + 1, 1, "C", "X") ? 2 : 1;
				break;


			case "B":
				add("P");
				index += charAt(index + 1) === "B" ? 2 : 1;
				break;

			case "Ç":
				add("S");
				index++;
				break;

			case "C":
				// Germanic ACH rule: previous='A', next='H', no vowel 2 back, not followed by I/E (unless BACHER/MACHER)
				if (
					charAt(index - 1) === "A" &&
					charAt(index + 1) === "H" &&
					charAt(index + 2) !== "I" &&
					!isVowel(index - 2) &&
					(charAt(index + 2) !== "E" ||
						contains(index - 2, 6, "BACHER", "MACHER"))
				) {
					add("K");
					index += 2;
					break;
				}
				// Special case for Caesar
				if (index === 0 && contains(index, 6, "CAESAR")) {
					add("S");
					index += 2;
					break;
				}
				// Italian Chianti
				if (contains(index + 1, 3, "HIA")) {
					add("K");
					index += 2;
					break;
				}
				// CH rules
				if (contains(index, 2, "CH")) {
					// Michael
					if (index > 0 && charAt(index + 2) === "A" && charAt(index + 3) === "E") {
						add("K", "X");
						index += 2;
						break;
					}
					// Greek roots: chemistry, chorus
					if (
						index === 0 &&
						(contains(index + 1, 5, "HARAC", "HARIS") ||
							contains(index + 1, 3, "HOR", "HYM", "HIA", "HEM")) &&
						!contains(0, 5, "CHORE")
					) {
						add("K");
						index += 2;
						break;
					}
					// Germanic/Greek/KH sound
					if (
						contains(0, 4, "VAN ", "VON ") ||
						contains(0, 3, "SCH") ||
						contains(index - 2, 6, "ORCHES", "ARCHIT", "ORCHID") ||
						contains(index + 2, 1, "T", "S") ||
						((contains(index - 1, 1, "A", "O", "U", "E") || index === 0) &&
							/[ BFHLMNRVW]/.test(charAt(index + 2)))
					) {
						add("K");
					} else if (index === 0) {
						add("X");
					} else if (contains(0, 2, "MC")) {
						// McHugh etc.
						add("K");
					} else {
						add("X", "K");
					}
					index += 2;
					break;
				}
				// Czerny
				if (contains(index, 2, "CZ") && !contains(index - 2, 4, "WICZ")) {
					add("S", "X");
					index += 2;
					break;
				}
				// Focaccia (C followed by CIA)
				if (contains(index + 1, 3, "CIA")) {
					add("X", "X");
					index += 3;
					break;
				}
				// Double C, but not McClellan
				if (
					contains(index, 2, "CC") &&
					!(index === 1 && charAt(0) === "M")
				) {
					if (
						contains(index + 2, 1, "I", "E", "H") &&
						!contains(index + 2, 2, "HU")
					) {
						// Accident, Accede, Succeed → KS; Bacci, Bertucci (Italian) → X
						const sub = str.substring(index - 1, index + 4);
						if (
							(index === 1 && charAt(index - 1) === "A") ||
							sub === "UCCEE" ||
							sub === "UCCES"
						) {
							add("KS");
						} else {
							add("X");
						}
						index += 3;
						break;
					} else {
						// Pierce's rule
						add("K");
						index += 2;
						break;
					}
				}
				if (contains(index, 2, "CK", "CG", "CQ")) {
					add("K");
					index += 2;
					break;
				}
				// Italian: CIE / CIO → S primary, X secondary
				if (
					charAt(index + 1) === "I" &&
					(charAt(index + 2) === "E" || charAt(index + 2) === "O")
				) {
					add("S", "X");
					index += 2;
					break;
				}
				// CI / CE / CY → S (both codes)
				if (contains(index, 2, "CI", "CE", "CY")) {
					add("S");
					index += 2;
					break;
				}
				add("K");
				// Skip two extra characters in 'Mac Caffrey', 'Mac Gregor'
				if (contains(index + 1, 2, " C", " Q", " G")) {
					index += 3;
				} else if (
					contains(index + 1, 1, "K", "Q") &&
					!contains(index + 1, 2, "CE", "CI")
				) {
					// CK / CQ – the K and Q are silent
					index += 2;
				} else {
					index++;
				}
				break;


			case "D":
				if (contains(index, 2, "DG")) {
					if (contains(index + 2, 1, "I", "E", "Y")) {
						add("J");
						index += 3;
					} else {
						add("TK");
						index += 2;
					}
					break;
				}
				if (contains(index, 2, "DT", "DD")) {
					add("T");
					index += 2;
				} else {
					add("T");
					index++;
				}
				break;

			case "F":
				add("F");
				index += charAt(index + 1) === "F" ? 2 : 1;
				break;

			case "G":
				if (charAt(index + 1) === "H") {
					if (index > 0 && !isVowel(index - 1)) {
						add("K");
						index += 2;
						break;
					}
					if (index === 0) {
						if (charAt(index + 2) === "I") {
							add("J");
						} else {
							add("K");
						}
						index += 2;
						break;
					}
					if (
						(index > 1 && contains(index - 2, 1, "B", "H", "D")) ||
						(index > 2 && contains(index - 3, 1, "B", "H", "D")) ||
						(index > 3 && contains(index - 4, 1, "B", "H"))
					) {
						index += 2;
						break;
					}
					if (
						index > 2 &&
						charAt(index - 1) === "U" &&
						contains(index - 3, 1, "C", "G", "L", "R", "T")
					) {
						add("F");
						index += 2;
						break;
					}
					if (index > 0 && charAt(index - 1) !== "I") {
						add("K");
					}
					index += 2;
					break;
				}
				if (charAt(index + 1) === "N") {
					if (index === 1 && isVowel(0) && !slavoGermanic) {
						add("KN", "N");
					} else {
						if (
							!contains(index + 2, 2, "EY") &&
							charAt(index + 1) !== "Y" &&
							!slavoGermanic
						) {
							add("N", "KN");
						} else {
							add("KN");
						}
					}
					index += 2;
					break;
				}
				if (contains(index + 1, 2, "LI") && !slavoGermanic) {
					add("KL", "L");
					index += 2;
					break;
				}
				if (
					index === 0 &&
					(charAt(index + 1) === "Y" ||
						contains(index + 1, 2, "ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER"))
				) {
					add("K", "J");
					index += 2;
					break;
				}
				if (
					(contains(index + 1, 2, "ER") || charAt(index + 1) === "Y") &&
					!contains(0, 6, "DANGER", "RANGER", "MANGER") &&
					!contains(index - 1, 1, "E", "I") &&
					!contains(index - 1, 3, "RGY", "OGY")
				) {
					add("K", "J");
					index += 2;
					break;
				}
				if (contains(index + 1, 1, "E", "I", "Y") || contains(index - 1, 4, "AGGI", "OGGI")) {
					if (contains(0, 4, "VAN ", "VON ") || contains(0, 3, "SCH") || contains(index + 1, 2, "ET")) {
						add("K");
					} else {
						if (contains(index + 1, 4, "IER ")) {
							add("J");
						} else {
							add("J", "K");
						}
					}
					index += 2;
					break;
				}
				if (charAt(index + 1) === "G") {
					index += 2;
				} else {
					index++;
				}
				add("K");
				break;

			case "H":
				if (
					(index === 0 || isVowel(index - 1)) &&
					isVowel(index + 1)
				) {
					add("H");
					index += 2;
				} else {
					index++;
				}
				break;

			case "J":
				if (contains(index, 4, "JOSE") || originalUpper.startsWith("SAN ")) {
					if (
						(index === 0 && charAt(index + 4) === " ") ||
						str.length === 4 ||
						originalUpper.startsWith("SAN ")
					) {
						add("H");
					} else {
						add("J", "H");
					}
					index++;
					break;
				}
				if (index === 0 && !contains(index, 4, "JOSE")) {
					add("J", "A");
				} else {
					if (isVowel(index - 1) && !slavoGermanic && (charAt(index + 1) === "A" || charAt(index + 1) === "O")) {
						add("J", "H");
					} else {
						if (index === length - 1) {
							add("J", "");
						} else if (
							!contains(index + 1, 1, "L", "T", "K", "S", "N", "M", "B", "Z") &&
							!contains(index - 1, 1, "S", "K", "L")
						) {
							add("J");
						}
					}
				}
				index += charAt(index + 1) === "J" ? 2 : 1;
				break;

			case "K":
				add("K");
				index += charAt(index + 1) === "K" ? 2 : 1;
				break;

			case "L":
				if (charAt(index + 1) === "L") {
					if (
						(index === length - 3 &&
							contains(index - 1, 4, "ILLO", "ILLA", "ALLE")) ||
						((contains(length - 2, 2, "AS", "OS") ||
							contains(length - 1, 1, "A", "O")) &&
							contains(index - 1, 4, "ALLE"))
					) {
						add("L", "");
						index += 2;
						break;
					}
					index += 2;
				} else {
					index++;
				}
				add("L");
				break;

			case "M":
				if (
					(contains(index - 1, 3, "UMB") &&
						(index + 1 === length - 1 || contains(index + 2, 2, "ER"))) ||
					charAt(index + 1) === "M"
				) {
					index += 2;
				} else {
					index++;
				}
				add("M");
				break;

			case "N":
				add("N");
				index += charAt(index + 1) === "N" ? 2 : 1;
				break;

			case "Ñ":
				add("N");
				index++;
				break;

			case "P":
				if (charAt(index + 1) === "H") {
					add("F");
					index += 2;
				} else {
					add("P");
					index += contains(index + 1, 1, "P", "B") ? 2 : 1;
				}
				break;

			case "Q":
				add("K");
				index += charAt(index + 1) === "Q" ? 2 : 1;
				break;

			case "R":
				if (index === length - 1 && !slavoGermanic && contains(index - 2, 2, "IE") && !contains(index - 4, 2, "ME", "MA")) {
					add("", "R");
				} else {
					add("R");
				}
				index += charAt(index + 1) === "R" ? 2 : 1;
				break;

			case "S":
				if (contains(index - 1, 3, "ISL", "YSL")) {
					index++;
					break;
				}
				if (index === 0 && contains(index, 5, "SUGAR")) {
					add("X", "S");
					index++;
					break;
				}
				if (contains(index, 2, "SH")) {
					if (contains(index + 1, 4, "HEIM", "HOEK", "HOLM", "HOLZ")) {
						add("S");
					} else {
						add("X");
					}
					index += 2;
					break;
				}
				if (contains(index, 3, "SIO", "SIA")) {
					if (slavoGermanic) {
						add("S");
					} else {
						add("S", "X");
					}
					index += 3;
					break;
				}
				if (
					(index === 0 && contains(index + 1, 1, "M", "N", "L", "W")) ||
					contains(index + 1, 1, "Z")
				) {
					add("S", "X");
					index += contains(index + 1, 1, "Z") ? 2 : 1;
					break;
				}
				if (contains(index, 2, "SC")) {
					if (charAt(index + 2) === "H") {
						if (
							contains(index + 3, 2, "OO", "ER", "EN", "UY", "ED", "EM")
						) {
							add("SK");
						} else {
							if (index === 0 && !isVowel(3) && charAt(3) !== "W") {
								add("X", "S");
							} else {
								add("X");
							}
						}
						index += 3;
						break;
					}
					if (contains(index + 2, 1, "I", "E", "Y")) {
						add("S");
						index += 3;
						break;
					}
					add("SK");
					index += 3;
					break;
				}
				if (index === length - 1 && contains(index - 2, 2, "AI", "OI")) {
					add("", "S");
				} else {
					add("S");
				}
				index += contains(index + 1, 1, "S", "Z") ? 2 : 1;
				break;

			case "T":
				if (contains(index, 4, "TION")) {
					add("X");
					index += 3;
					break;
				}
				if (contains(index, 3, "TIA", "TCH")) {
					add("X");
					index += 3;
					break;
				}
				if (
					contains(index, 2, "TH") ||
					contains(index, 3, "TTH")
				) {
					if (
						contains(index + 2, 2, "OM", "AM") ||
						contains(0, 4, "VAN ", "VON ") ||
						contains(0, 3, "SCH")
					) {
						add("T");
					} else {
						add("0", "T");
					}
					index += 2;
					break;
				}
				add("T");
				index += contains(index + 1, 1, "T", "D") ? 2 : 1;
				break;

			case "V":
				add("F");
				index += charAt(index + 1) === "V" ? 2 : 1;
				break;

			case "W":
				if (contains(index, 2, "WR")) {
					add("R");
					index += 2;
					break;
				}
				if (index === 0 && (isVowel(index + 1) || contains(index, 2, "WH"))) {
					if (isVowel(index + 1)) {
						add("A", "F");
					} else {
						add("A");
					}
				}
				if (
					(index === length - 1 && isVowel(index - 1)) ||
					contains(index - 1, 5, "EWSKI", "EWSKY", "OWSKI", "OWSKY") ||
					contains(0, 3, "SCH")
				) {
					add("", "F");
					index++;
					break;
				}
				if (contains(index, 4, "WICZ", "WITZ")) {
					add("TS", "FX");
					index += 4;
					break;
				}
				index++;
				break;

			case "X":
				if (
					!(index === length - 1 &&
						(contains(index - 3, 3, "IAU", "EAU") ||
							contains(index - 2, 2, "AU", "OU")))
				) {
					add("KS");
				}
				index += contains(index + 1, 1, "C", "X") ? 2 : 1;
				break;

			case "Z":
				if (charAt(index + 1) === "H") {
					add("J");
					index += 2;
					break;
				}
				if (
					contains(index + 1, 2, "ZO", "ZI", "ZA") ||
					(slavoGermanic && index > 0 && charAt(index - 1) !== "T")
				) {
					add("S", "TS");
				} else {
					add("S");
				}
				index += charAt(index + 1) === "Z" ? 2 : 1;
				break;

			default:
				index++;
				break;
		}
	}

	secondary = secondary.trimEnd();

	const sec = secondary === primary ? primary : secondary;
	return `${primary}:${sec}`;
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
	"GEORGEANA": "GEORGEANNA", "GEORGIANA": "GEORGEANNA", "GEORGIANNA": "GEORGEANNA", "GEORGEANNE": "GEORGEANNA",
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
			const metaphoneLastName = doubleMetaphone(m.last_name);
			const nysiisLastName = simpleNysiis(m.last_name);
			const normRace = simpleRaceNorm(m.race);
			const normOcc = normalizeOccupation(m.occupation);

			const needsUpdate =
				normFirstName !== (m.norm_first_name || '') ||
				metaphoneLastName !== (m.metaphone_last_name || '') ||
				nysiisLastName !== (m.nysiis_last_name || '') ||
				normRace !== (m.norm_race || '') ||
				normOcc !== (m.norm_occupation || '');

			if (needsUpdate) {
				updates.push({
					...m,
					norm_first_name: normFirstName,
					metaphone_last_name: metaphoneLastName,
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

async function getConfidenceForSource(source) {
	let formatFileName = source.format;
	if (formatFileName && !formatFileName.includes('Format')) {
		formatFileName = formatFileName.replace('.md', 'Format.md');
	}
	if (!formatFileName) {
		formatFileName = source.display_name.replace(/\s+/g, '') + 'Format.md';
	}
	try {
		const mdRes = await fetch(`SKILLS/${formatFileName}?${new Date().getTime()}`);
		if (mdRes.ok) {
			const mdText = await mdRes.text();
			const match = mdText.match(/confidence field is set to\s*([0-9.]+)/i);
			if (match && match[1]) {
				return parseFloat(match[1]);
			}
		}
	} catch (e) {
		log(`Error reading format file: ${e.message}`, true);
	}
	return 1.0;
}

function parseCsv(url) {
	return new Promise((resolve, reject) => {
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
			complete: function (results) {
				resolve(results.data);
			},
			error: function (err) {
				reject(err);
			}
		});
	});
}

async function ingestSingleSource(source, csvData, useLimit) {
	selectedSource = source;
	currentCsvData = csvData;
	currentConfidence = await getConfidenceForSource(source);

	idGenerator = new MentionIdGenerator();
	householdMap.clear();
	familyMap.clear();
	mentionRowMap.clear();

	if (selectedSource.format.includes('Census')) {
		if (typeof initCrosswalk === 'function') {
			await initCrosswalk(selectedSource.county || 'AUG', selectedSource.year);
		}
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
	} else if (selectedSource.format.includes('SlaveSchedule')) {
		let currentHouseholdId = null;
		let householdCounter = 1;
		let currentEnslaver = null;
		for (let i = 0; i < currentCsvData.length; i++) {
			const row = currentCsvData[i];
			const statusVal = String(getRowValue(row, 'status') || getRowValue(row, 'owner') || '').trim();
			const isOwner = statusVal.toUpperCase() === 'Y' || statusVal.toLowerCase() === 'owner' || statusVal.toLowerCase() === 'enslaver';
			if (isOwner) {
				currentHouseholdId = `HS${selectedSource.year}-${householdCounter++}`;
				const fn = getRowValue(row, 'first_name') || getRowValue(row, 'FirstName') || '';
				const mn = getRowValue(row, 'middle_name') || getRowValue(row, 'MiddleName') || '';
				const ln = getRowValue(row, 'last_name') || getRowValue(row, 'LastName') || '';
				currentEnslaver = [fn, mn, ln].filter(Boolean).join(' ').trim() || getRowValue(row, 'full_name') || getRowValue(row, 'FullName') || '';
			}
			if (currentHouseholdId) {
				householdMap.set(i, currentHouseholdId);
				row.enslaver_full_name = currentEnslaver;
			}
		}
	}

	const totalRows = useLimit ? Math.min(50, currentCsvData.length) : currentCsvData.length;
	let processedRows = 0;

	log(`Ingesting ${totalRows} rows from ${source.display_name}...`);
	const startTime = Date.now();

	const BATCH_SIZE = 1000;
	let batch = [];

	for (let i = 0; i < totalRows; i++) {
		if (stopIngestion) {
			log(`Ingestion stopped by user at row ${i}.`);
			break;
		}

		const row = currentCsvData[i];
		let mention;
		try {
			mention = await prepareMention(row, i);
		} catch (err) {
			log(`Error preparing row ${i + 1}: ${err.message}`, true);
			continue;
		}

		batch.push(mention);

		if (batch.length >= BATCH_SIZE || i === totalRows - 1) {
			const batchSize = batch.length;
			try {
				await insertBatch(batch);
				processedRows += batchSize;
			} catch (err) {
				log(`Error inserting batch of ${batchSize} rows near row ${i + 1}: ${err.message}`, true);
			} finally {
				batch = [];
				updateProgress(processedRows, totalRows, startTime);
			}
		}
	}

	updateProgress(processedRows, totalRows, startTime);
	log(`Finished row ingestion for ${source.display_name}.`);

	if (!stopIngestion) {
		try {
			await processPostHocMentions();
			await processPostHocAssertions();
		} catch (err) {
			log(`Failed post-hoc processing for ${source.display_name}: ${err.message}`, true);
		}
	}
}

async function ingestAllSources(shouldClearData) {
	const selectedCounty = countySelect ? countySelect.value : 'AUG';
	const countyPrefix = getCountyPrefix(selectedCounty || 'AUG');

	if (shouldClearData === undefined) {
		shouldClearData = confirm(`Do you want to clear existing data for county ${selectedCounty} (mentions and assertions tables) before ingesting all sources?\n\nClick OK to clear data.\nClick Cancel to keep existing data.`);
	}

	if (typeof actionSelect !== 'undefined') actionSelect.disabled = true;
	if (typeof progressSection !== 'undefined') progressSection.classList.remove('hidden');
	stopIngestion = false;

	try {
		if (shouldClearData) {
			log(`Clearing assertions table for county ${selectedCounty}...`);
			const resAssert = await fetch(`${POSTGREST_URL}/assertions?subject_id=like.${countyPrefix}*`, {
				method: 'DELETE',
				headers: API_HEADERS
			});
			if (!resAssert.ok) throw new Error(`Failed to clear assertions table for county ${selectedCounty}`);

			log(`Clearing mentions table for county ${selectedCounty}...`);
			const resMention = await fetch(`${POSTGREST_URL}/mentions?mention_id=like.${countyPrefix}*`, {
				method: 'DELETE',
				headers: API_HEADERS
			});
			if (!resMention.ok) throw new Error(`Failed to clear mentions table for county ${selectedCounty}`);

			log(`Tables successfully cleared for county ${selectedCounty}.`);
		} else {
			log('Skipping clearing of existing data per user selection.');
		}

		const countySources = sourcesData.filter(source => (source.title || source.display_name) && source.county && (!selectedCounty || source.county === selectedCounty));

		log(`Found ${countySources.length} sources to ingest for county ${selectedCounty}.`);

		const useLimit = limitCheckbox ? limitCheckbox.checked : false;

		for (let idx = 0; idx < countySources.length; idx++) {
			if (stopIngestion) {
				log('Ingestion of all sources stopped by user.');
				break;
			}
			const source = countySources[idx];
			const sourceLabel = source.title ? `${source.title} (${source.display_name})` : source.display_name;
			log(`--------------------------------------------------`);
			log(`Ingesting source ${idx + 1} of ${countySources.length}: ${sourceLabel}`);

			if (!source.url || !source.url.trim().startsWith('http')) {
				log(`Skipping source ${sourceLabel}: No valid URL configured.`);
				continue;
			}

			try {
				const csvData = await parseCsv(source.url);
				await ingestSingleSource(source, csvData, useLimit);
			} catch (err) {
				log(`Failed to ingest source ${sourceLabel}: ${err.message}`, true);
			}
		}

		if (!stopIngestion) {
			log(`All sources ingested successfully.`);
		}
	} catch (err) {
		log(`Fatal error during ingest all: ${err.message}`, true);
	} finally {
		if (typeof actionSelect !== 'undefined') {
			actionSelect.disabled = false;
			actionSelect.value = '';
		}
	}
}





// Initialize
document.addEventListener('DOMContentLoaded', loadSources);
