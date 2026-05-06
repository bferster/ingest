const POSTGREST_URL = 'http://localhost:3000';
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
const expandBtn = document.getElementById('expand-btn');

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

	const useLimit = limitCheckbox.checked;
	const totalRows = useLimit ? Math.min(50, currentCsvData.length) : currentCsvData.length;
	let processedRows = 0;

	log(`Starting ingestion of ${totalRows} rows${useLimit ? ' (Limited to 50)' : ''}...`);
	const startTime = Date.now();

	// Fast deduplication: Fetch existing mentions for this source once at the start
	const dbSource = await getDatabaseSource(selectedSource);
	log('Checking for existing records to avoid duplicates...');
	let existingHashes = new Set();
	try {
		const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(dbSource)}&select=original_data`, { headers: API_HEADERS });
		if (res.ok) {
			const existing = await res.json();
			existing.forEach(m => {
				existingHashes.add(JSON.stringify(m.original_data));
			});
			log(`Found ${existingHashes.size} existing records in database.`);
		}
	} catch (err) {
		log('Could not fetch existing records for deduplication, proceeding without fast check.', true);
	}

	const BATCH_SIZE = 100;
	let batch = [];

	for (let i = 0; i < totalRows; i++) {
		if (stopIngestion) {
			log(`Ingestion stopped by user at row ${i}.`);
			break;
		}

		const row = currentCsvData[i];
		const originalDataStr = JSON.stringify(row);

		if (existingHashes.has(originalDataStr)) {
			processedRows++;
			if (processedRows % 10 === 0 || processedRows === totalRows) {
				updateProgress(processedRows, totalRows, startTime);
			}
			continue;
		}

		try {
			const mention = await prepareMention(row);
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
	processBtn.disabled = false;
	stopBtn.disabled = true;
});

async function insertBatch(batch) {
	if (batch.length === 0) return;
	const postRes = await fetch(`${POSTGREST_URL}/mentions`, {
		method: 'POST',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation'
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
	return foundKey ? obj[foundKey] : undefined;
}

async function prepareMention(row) {
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

	// 4. Construct Mention Object
	const mention = {
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
		legal_status: '' // Default
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

	if (!selectedSource.format.includes('Census')) {
		log('Skipping Census post-hoc processing for non-census format.');
		return;
	}

	// Group by source_year and dwelling/family (Census logic)
	log(`Found ${mentions.length} mentions to check for household/family IDs.`);

	// Group mention IDs by their combined target IDs to minimize requests
	const updateGroups = {}; // "hId|fId" -> [mention_id]

	mentions.forEach(m => {
		if (!m.source_year || !m.original_data) return;
		const hId = m.original_data.dwelling ? `HC${m.source_year}-${m.original_data.dwelling}` : null;
		const fId = m.original_data.family ? `FC${m.source_year}-${m.original_data.family}` : null;
		
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
					await fetch(`${POSTGREST_URL}/mentions?mention_id=in.(${idChunk.join(',')})`, {
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
		enslaversToCreate.push({
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

				parentsToCreate.push({
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
		return;
	}

	if (selectedSource.format.includes('VitalRecord')) {
		await processVitalRecordAssertions(mentions);
		return;
	}

	if (!selectedSource.format.includes('Census')) {
		log('Skipping Census post-hoc assertions for non-census format.');
		return;
	}

	// Sort by line number from original_data to maintain enumeration order
	mentions.sort((a, b) => {
		const lineA = parseInt(a.original_data?.line || 0);
		const lineB = parseInt(b.original_data?.line || 0);
		return lineA - lineB;
	});

	// Group by household_id
	const households = {};
	mentions.forEach(m => {
		if (!m.household_id) return;
		if (!households[m.household_id]) households[m.household_id] = [];
		households[m.household_id].push(m);
	});

	let matchedCount = 0;
	const totalHouseholds = Object.keys(households).length;
	const startTime = Date.now();
	const assertionsToCreate = [];

	log(`Matching relationships for ${totalHouseholds} households...`);

	for (const [hhId, members] of Object.entries(households)) {
		matchedCount++;
		if (matchedCount % 10 === 0 || matchedCount === totalHouseholds) {
			updateProgress(matchedCount, totalHouseholds, startTime, 'households matched');
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
				if (relation && relation !== "Self") {
					const relationMap = {
						"Wife": "isSpouseOf",
						"Son": "isChildOf",
						"Daughter": "isChildOf",
						"Brother": "isSiblingOf",
						"Sister": "isSiblingOf",
						"Father": "isFatherOf",
						"Mother": "isMotherOf",
						"Grandfather": "isGrandfatherOf",
						"Grandmother": "isGrandmotherOf",
						"Uncle": "isUncleOf",
						"Aunt": "isAuntOf",
						"Cousin": "isCousinOf",
						"Nephew": "isNephewOf",
						"Niece": "isNieceOf",
						"Son-in-law": "isSonInLawOf",
						"Daughter-in-law": "isDaughterInLawOf",
						"Brother-in-law": "isBrotherInLawOf",
						"Sister-in-law": "isSisterInLawOf",
						"Father-in-law": "isFatherInLawOf",
						"Mother-in-law": "isMotherInLawOf"
					};
					predicate = relationMap[relation] || null;
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

				// Rule 76: isMotherOf
				if (!predicate && next && self.gender === 'F') {
					const nextAge = parseInt(selectedSource.year) - (next.birth_year || 0);
					if (nextAge < 14) {
						predicate = 'isMotherOf';
					}
				}

				// Rule 77: isSiblingOf
				if (!predicate && next) {
					const ageDiff = Math.abs((self.birth_year || 0) - (next.birth_year || 0));
					if (ageDiff <= 20) {
						predicate = 'isSiblingOf';
					}
				}
			}

			if (predicate) {
				assertionsToCreate.push({
					subject_id: head.mention_id,
					predicate: predicate,
					county: selectedSource.county || '',
					object_id: self.mention_id,
					who: who,
					start_year: parseInt(selectedSource.year),
					confidence: confidence
				});
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

	// Group enslaved mention IDs by their enslaver_id for bulk patching
	const enslaverGroups = {}; // enslaver_id -> [mention_id]
	const assertionsToCreate = [];

	for (const m of enslaved) {
		const enslaverName = getRowValue(m.original_data, 'enslaver_full_name');
		const enslaverId = enslaverMap.get(enslaverName);

		if (enslaverId) {
			if (!enslaverGroups[enslaverId]) enslaverGroups[enslaverId] = [];
			enslaverGroups[enslaverId].push(m.mention_id);

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
					await fetch(`${POSTGREST_URL}/mentions?mention_id=in.(${idChunk.join(',')})`, {
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
		}
		if (father) {
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
		}

		if (currentBatch.length >= 100) {
			assertionBatches.push([...currentBatch]);
			currentBatch.length = 0;
		}
	}
	if (currentBatch.length > 0) assertionBatches.push(currentBatch);

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

// Basic Stubs for Normalization Algorithms
function simpleNysiis(str) {
	if (!str) return '';
	return str.substring(0, 4).toUpperCase(); // extremely simplified stub
}

function simpleRaceNorm(str) {
	if (!str) return '';
	const s = str.trim().toLowerCase();
	if (s === 'w' || s.startsWith('cauc') || s === 'white') return 'W';
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

	return s.toUpperCase();
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

// Expand Assertions Implementation
expandBtn.addEventListener('click', async () => {
	if (!confirm('Are you sure you want to expand assertions? This will compute the deductive closure of the assertions table.')) {
		return;
	}

	expandBtn.disabled = true;
	log('Starting assertion expansion...');
	const startTime = Date.now();

	try {
		// 1. Fetch all assertions
		log('Fetching assertions from database...');
		let allAssertions = [];
		let offset = 0;
		const limit = 1000;
		while (true) {
			const res = await fetch(`${POSTGREST_URL}/assertions?limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
			if (!res.ok) throw new Error('Failed to fetch assertions');
			const data = await res.json();
			if (data.length === 0) break;
			allAssertions = allAssertions.concat(data);
			if (data.length < limit) break;
			offset += limit;
		}
		log(`Loaded ${allAssertions.length} assertions.`);

		// Helpers for checking existing
		const getAssertionKey = (a) => `${a.subject_id}|${a.predicate}|${a.object_id || a.object_string}`;
		const existingKeys = new Set(allAssertions.map(getAssertionKey));

		const passAMappings = {
			isSonOf: 'isChildOf', isDaughterOf: 'isChildOf',
			isGrandFatherOf: 'isGrandParentOf', isGrandMotherOf: 'isGrandParentOf',
			isUncleOf: 'isPiblingOf', isAuntOf: 'isPiblingOf',
			isNephewOf: 'isNiblingOf', isNieceOf: 'isNiblingOf',
			isStepMotherOf: 'isStepParentOf', isStepFatherOf: 'isStepParentOf',
			isStepSonOf: 'isStepChildOf', isStepDaughterOf: 'isStepChildOf',
			isStepBrotherOf: 'isStepSiblingOf', isStepSisterOf: 'isStepSiblingOf'
			// isSonInLawOf: 'isChildInLawOf', isDaughterInLawOf: 'isChildInLawOf',
			// isGrandFatherInLawOf: 'isGrandParentInLawOf', isGrandMotherInLawOf: 'isGrandParentInLawOf',
			// isUncleInLawOf: 'isPiblingInLawOf', isAuntInLawOf: 'isPiblingInLawOf',
			// isNephewInLawOf: 'isNiblingInLawOf', isNieceInLawOf: 'isNiblingInLawOf'
		};

		const passBMappings = {
			isMotherOf: 'isParentOf', isFatherOf: 'isParentOf',
			isHusbandOf: 'isSpouseOf', isWifeOf: 'isSpouseOf',
			isGrandSonOf: 'isGrandChildOf', isGrandDaughterOf: 'isGrandChildOf',
			isBrotherOf: 'isSiblingOf', isSisterOf: 'isSiblingOf'
			// isFatherInLawOf: 'isParentInLawOf', isMotherInLawOf: 'isParentInLawOf',
			// isBrotherInLawOf: 'isSiblingInLawOf', isSisterInLawOf: 'isSiblingInLawOf',
			// isGrandSonInLawOf: 'isGrandChildInLawOf', isGrandDaughterInLawOf: 'isGrandChildInLawOf'
		};

		const passCMappings = {
			isParentOf: 'isChildOf',
			isChildOf: 'isParentOf',
			isSpouseOf: 'isSpouseOf',
			isSiblingOf: 'isSiblingOf',
			isGrandParentOf: 'isGrandChildOf',
			isGrandChildOf: 'isGrandParentOf',
			isPiblingOf: 'isNiblingOf',
			isNiblingOf: 'isPiblingOf',
			isCousinOf: 'isCousinOf',
			isStepParentOf: 'isStepChildOf',
			isStepChildOf: 'isStepParentOf',
			isStepSiblingOf: 'isStepSiblingOf',
			// isParentInLawOf: 'isChildInLawOf',
			// isChildInLawOf: 'isParentInLawOf',
			// isSiblingInLawOf: 'isSiblingInLawOf',
			// isGrandParentInLawOf: 'isGrandChildInLawOf',
			// isGrandChildInLawOf: 'isGrandParentInLawOf',
			// isPiblingInLawOf: 'isNiblingInLawOf',
			// isNiblingInLawOf: 'isPiblingInLawOf',
			// isCousinInLawOf: 'isCousinInLawOf',
			isFatherOf: 'isChildOf', isMotherOf: 'isChildOf',
			isHusbandOf: 'isWifeOf', isWifeOf: 'isHusbandOf',
			isBrotherOf: 'isSiblingOf', isSisterOf: 'isSiblingOf',
			isGrandSonOf: 'isGrandParentOf', isGrandDaughterOf: 'isGrandParentOf',
			isFatherInLawOf: 'isChildInLawOf', isMotherInLawOf: 'isChildInLawOf',
			isBrotherInLawOf: 'isSiblingInLawOf', isSisterInLawOf: 'isSiblingInLawOf'
		};

		// --- Pass A: Changed (In-place) ---
		log('Running Pass A (Predicate Replacement)...');
		const predicatesToReplace = Object.keys(passAMappings);
		let updatedCount = 0;
		for (const oldPred of predicatesToReplace) {
			const newPred = passAMappings[oldPred];
			try {
				const res = await fetch(`${POSTGREST_URL}/assertions?predicate=eq.${oldPred}`, {
					method: 'PATCH',
					headers: API_HEADERS,
					body: JSON.stringify({ predicate: newPred })
				});
				if (res.ok) {
					// Log progress based on how many actually existed locally
					const count = allAssertions.filter(a => a.predicate === oldPred).length;
					updatedCount += count;
					log(`Converted all ${oldPred} to ${newPred} in database.`);
				}
			} catch (err) {
				log(`Failed bulk patch for ${oldPred}: ${err.message}`, true);
			}
		}
		// Update local copy in one pass
		allAssertions.forEach(a => {
			if (passAMappings[a.predicate]) {
				a.predicate = passAMappings[a.predicate];
			}
		});
		log(`Pass A complete: Updated predicates for ${updatedCount} records.`);

		// --- Pass B: Identical (Additive) ---
		log('Running Pass B (Supertype Additions)...');
		const newFromB = [];
		allAssertions.forEach(a => {
			const superPred = passBMappings[a.predicate];
			if (superPred) {
				const derived = { ...a, predicate: superPred, who: 'derived' };
				delete derived.assertion_id;
				delete derived.created;
				if (!existingKeys.has(getAssertionKey(derived))) {
					newFromB.push(derived);
					existingKeys.add(getAssertionKey(derived));
				}
			}
		});
		if (newFromB.length > 0) {
			await insertAssertionBatch(newFromB);
			allAssertions = allAssertions.concat(newFromB);
		}
		log(`Pass B complete: ${newFromB.length} assertions added.`);

		// --- Pass C: Inverse (Additive) ---
		const runPassC = async (currentAssertions) => {
			const newInverses = [];
			currentAssertions.forEach(a => {
				if (!a.object_id) return;
				const invPred = passCMappings[a.predicate];
				if (invPred) {
					const derived = {
						subject_id: a.object_id,
						predicate: invPred,
						object_id: a.subject_id,
						county: a.county,
						start_year: a.start_year,
						end_year: a.end_year,
						confidence: a.confidence,
						who: 'derived'
					};
					if (!existingKeys.has(getAssertionKey(derived))) {
						newInverses.push(derived);
						existingKeys.add(getAssertionKey(derived));
					}
				}
			});
			if (newInverses.length > 0) {
				await insertAssertionBatch(newInverses);
				allAssertions = allAssertions.concat(newInverses);
			}
			return newInverses.length;
		};

		log('Running Pass C (Inverse Additions)...');
		const countC1 = await runPassC(allAssertions);
		log(`Pass C complete: ${countC1} assertions added.`);

		// --- Pass D: Transitive (Additive) ---
		log('Running Pass D (Transitive Rules)...');
		const newFromD = [];
		
		// Index for fast lookups
		const bySubject = {};
		allAssertions.forEach(a => {
			if (!bySubject[a.subject_id]) bySubject[a.subject_id] = [];
			bySubject[a.subject_id].push(a);
		});

		const addDerived = (derived) => {
			if (!existingKeys.has(getAssertionKey(derived))) {
				newFromD.push(derived);
				existingKeys.add(getAssertionKey(derived));
				// Also update lookup for subsequent D rules
				if (!bySubject[derived.subject_id]) bySubject[derived.subject_id] = [];
				bySubject[derived.subject_id].push(derived);
			}
		};

		// Utility to find relationships
		const getRel = (subjId, pred) => (bySubject[subjId] || []).filter(a => a.predicate === pred);

		// Apply rules in order
		const subjects = Object.keys(bySubject);
		for (let i = 0; i < subjects.length; i++) {
			const X = subjects[i];
			const Xrels = bySubject[X];

			// sibling_from_parent: X isChildOf P ∧ Y isChildOf P ∧ X ≠ Y → X isSiblingOf Y
			Xrels.filter(a => a.predicate === 'isChildOf' && a.object_id).forEach(aXP => {
				const P = aXP.object_id;
				// Find others who have P as parent (Y isChildOf P is same as P isParentOf Y)
				// Since we have inverses, we can just look for P isParentOf Y
				(bySubject[P] || []).filter(aPY => aPY.predicate === 'isParentOf' && aPY.object_id && aPY.object_id !== X).forEach(aPY => {
					addDerived({
						subject_id: X, predicate: 'isSiblingOf', object_id: aPY.object_id,
						county: aXP.county, start_year: aXP.start_year, end_year: aXP.end_year, confidence: Math.min(aXP.confidence, aPY.confidence), who: 'derived'
					});
				});
			});

			// grandparent_from_parent: X isParentOf Y ∧ Y isParentOf Z → X isGrandParentOf Z
			Xrels.filter(a => a.predicate === 'isParentOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYZ => aYZ.predicate === 'isParentOf' && aYZ.object_id).forEach(aYZ => {
					addDerived({
						subject_id: X, predicate: 'isGrandParentOf', object_id: aYZ.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYZ.confidence), who: 'derived'
					});
				});
			});

			// pibling_from_sibling: X isSiblingOf Y ∧ Y isParentOf Z → X isPiblingOf Z
			Xrels.filter(a => a.predicate === 'isSiblingOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYZ => aYZ.predicate === 'isParentOf' && aYZ.object_id).forEach(aYZ => {
					addDerived({
						subject_id: X, predicate: 'isPiblingOf', object_id: aYZ.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYZ.confidence), who: 'derived'
					});
				});
			});

			// cousin_from_pibling: X isPiblingOf Y ∧ X isParentOf Z → Z isCousinOf Y
			Xrels.filter(a => a.predicate === 'isPiblingOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				Xrels.filter(aXZ => aXZ.predicate === 'isParentOf' && aXZ.object_id).forEach(aXZ => {
					addDerived({
						subject_id: aXZ.object_id, predicate: 'isCousinOf', object_id: Y,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aXZ.confidence), who: 'derived'
					});
				});
			});

			// stepsibling_from_stepparent: X isChildOf P ∧ Y isStepChildOf P ∧ X ≠ Y → X isStepSiblingOf Y
			Xrels.filter(a => a.predicate === 'isChildOf' && a.object_id).forEach(aXP => {
				const P = aXP.object_id;
				(bySubject[P] || []).filter(aPY => aPY.predicate === 'isStepParentOf' && aPY.object_id && aPY.object_id !== X).forEach(aPY => {
					addDerived({
						subject_id: X, predicate: 'isStepSiblingOf', object_id: aPY.object_id,
						county: aXP.county, start_year: aXP.start_year, end_year: aXP.end_year, confidence: Math.min(aXP.confidence, aPY.confidence), who: 'derived'
					});
				});
			});

			/* 
			// In-law relationships
			// child_in_law_from_spouse: X isSpouseOf Y ∧ Y isChildOf P → X isChildInLawOf P
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYP => aYP.predicate === 'isChildOf' && aYP.object_id).forEach(aYP => {
					addDerived({
						subject_id: X, predicate: 'isChildInLawOf', object_id: aYP.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYP.confidence), who: 'derived'
					});
				});
			});

			// parent_in_law_from_spouse: X isSpouseOf Y ∧ Y isParentOf C → X isParentInLawOf C
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYC => aYC.predicate === 'isParentOf' && aYC.object_id).forEach(aYC => {
					addDerived({
						subject_id: X, predicate: 'isParentInLawOf', object_id: aYC.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYC.confidence), who: 'derived'
					});
				});
			});

			// sibling_in_law_from_spouse_sibling: X isSpouseOf Y ∧ Y isSiblingOf S → X isSiblingInLawOf S
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYS => aYS.predicate === 'isSiblingOf' && aYS.object_id).forEach(aYS => {
					addDerived({
						subject_id: X, predicate: 'isSiblingInLawOf', object_id: aYS.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYS.confidence), who: 'derived'
					});
				});
			});

			// sibling_in_law_from_sibling_spouse: X isSiblingOf Y ∧ Y isSpouseOf S → S isSiblingInLawOf X
			Xrels.filter(a => a.predicate === 'isSiblingOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYS => aYS.predicate === 'isSpouseOf' && aYS.object_id).forEach(aYS => {
					addDerived({
						subject_id: aYS.object_id, predicate: 'isSiblingInLawOf', object_id: X,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYS.confidence), who: 'derived'
					});
				});
			});

			// grandparent_in_law_from_spouse: X isSpouseOf Y ∧ Y isGrandChildOf G → X isGrandChildInLawOf G
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYG => aYG.predicate === 'isGrandChildOf' && aYG.object_id).forEach(aYG => {
					addDerived({
						subject_id: X, predicate: 'isGrandChildInLawOf', object_id: aYG.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYG.confidence), who: 'derived'
					});
				});
			});

			// grandchild_in_law_from_grandchild_spouse: X isGrandParentOf C ∧ C isSpouseOf S → S isGrandChildInLawOf X
			Xrels.filter(a => a.predicate === 'isGrandParentOf' && a.object_id).forEach(aXC => {
				const C = aXC.object_id;
				(bySubject[C] || []).filter(aCS => aCS.predicate === 'isSpouseOf' && aCS.object_id).forEach(aCS => {
					addDerived({
						subject_id: aCS.object_id, predicate: 'isGrandChildInLawOf', object_id: X,
						county: aXC.county, start_year: aXC.start_year, end_year: aXC.end_year, confidence: Math.min(aXC.confidence, aCS.confidence), who: 'derived'
					});
				});
			});

			// pibling_in_law_from_spouse: X isSpouseOf Y ∧ P isPiblingOf Y → P isPiblingInLawOf X
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				// P isPiblingOf Y means Y isNiblingOf P
				(bySubject[Y] || []).filter(aYP => aYP.predicate === 'isNiblingOf' && aYP.object_id).forEach(aYP => {
					addDerived({
						subject_id: aYP.object_id, predicate: 'isPiblingInLawOf', object_id: X,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYP.confidence), who: 'derived'
					});
				});
			});

			// pibling_in_law_from_pibling_spouse: P isPiblingOf Y ∧ P isSpouseOf S → S isPiblingInLawOf Y
			Xrels.filter(a => a.predicate === 'isPiblingOf' && a.object_id).forEach(aPY => {
				const Y = aPY.object_id;
				Xrels.filter(aPS => aPS.predicate === 'isSpouseOf' && aPS.object_id).forEach(aPS => {
					addDerived({
						subject_id: aPS.object_id, predicate: 'isPiblingInLawOf', object_id: Y,
						county: aPY.county, start_year: aPY.start_year, end_year: aPY.end_year, confidence: Math.min(aPY.confidence, aPS.confidence), who: 'derived'
					});
				});
			});

			// cousin_in_law_from_spouse: X isSpouseOf Y ∧ Y isCousinOf C → X isCousinInLawOf C
			Xrels.filter(a => a.predicate === 'isSpouseOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYC => aYC.predicate === 'isCousinOf' && aYC.object_id).forEach(aYC => {
					addDerived({
						subject_id: X, predicate: 'isCousinInLawOf', object_id: aYC.object_id,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYC.confidence), who: 'derived'
					});
				});
			});

			// cousin_in_law_from_cousin_spouse: X isCousinOf Y ∧ Y isSpouseOf S → S isCousinInLawOf X
			Xrels.filter(a => a.predicate === 'isCousinOf' && a.object_id).forEach(aXY => {
				const Y = aXY.object_id;
				(bySubject[Y] || []).filter(aYS => aYS.predicate === 'isSpouseOf' && aYS.object_id).forEach(aYS => {
					addDerived({
						subject_id: aYS.object_id, predicate: 'isCousinInLawOf', object_id: X,
						county: aXY.county, start_year: aXY.start_year, end_year: aXY.end_year, confidence: Math.min(aXY.confidence, aYS.confidence), who: 'derived'
					});
				});
			});
			*/
			
			if (i % 100 === 0) updateProgress(i, subjects.length, startTime, 'subjects processed for Pass D');
		}

		if (newFromD.length > 0) {
			await insertAssertionBatch(newFromD);
			allAssertions = allAssertions.concat(newFromD);
		}
		log(`Pass D complete: ${newFromD.length} assertions added.`);

		// --- Repeat Pass C ---
		log('Repeating Pass C (Final Inverse Additions)...');
		const countC2 = await runPassC(allAssertions);
		log(`Final Pass C complete: ${countC2} assertions added.`);

		log(`Assertion expansion complete. Total new assertions: ${newFromB.length + countC1 + newFromD.length + countC2}`);

	} catch (err) {
		log(`Expansion failed: ${err.message}`, true);
	} finally {
		expandBtn.disabled = false;
	}
});

async function insertAssertionBatch(batch) {
	if (batch.length === 0) return;
	const BATCH_SIZE = 100;
	for (let i = 0; i < batch.length; i += BATCH_SIZE) {
		const chunk = batch.slice(i, i + BATCH_SIZE);
		const res = await fetch(`${POSTGREST_URL}/assertions`, {
			method: 'POST',
			headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
			body: JSON.stringify(chunk)
		});
		if (!res.ok) {
			const err = await res.text();
			log(`Failed to insert assertion batch: ${err}`, true);
		}
	}
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSources);
