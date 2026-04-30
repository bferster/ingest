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

	for (let i = 0; i < totalRows; i++) {
		if (stopIngestion) {
			log(`Ingestion stopped by user at row ${i}.`);
			break;
		}

		const row = currentCsvData[i];
		try {
			await processRow(row);
		} catch (err) {
			log(`Failed inserting row ${i + 1}: ${err.message}`, true);
		}

		processedRows++;
		updateProgress(processedRows, totalRows);
	}

	log(`Finished row ingestion.`);

	// Post-hoc Mentions and Assertions
	if (!stopIngestion) {
		try {
			await processPostHocMentions();
			await processPostHocAssertions();
		} catch (err) {
			log(`Failed post-hoc processing: ${err.message}`, true);
		}
	} else {
		log('Skipping Post-Hoc processing because ingestion was stopped.');
	}

	log(`Ingestion batch complete.`);
});

stopBtn.addEventListener('click', () => {
	stopIngestion = true;
	stopBtn.disabled = true;
	log('Stop signal received. Stopping after current row completes...');
});

function updateProgress(processed, total) {
	const percentage = Math.round((processed / total) * 100);
	progressFill.style.width = `${percentage}%`;
	progressText.textContent = `${processed} / ${total} rows processed`;
}

// Sub-functions for processing
async function processRow(row) {
	// 1. Extract full_name and basic normalization
	const firstName = row.first_name || row.FirstName || row.GivenName || '';
	const middleName = row.middle_name || row.MiddleName || '';
	const lastName = row.last_name || row.LastName || row.Surname || '';
	const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

	// 2. Check for existing row to avoid deduplication
	// Construct original_data JSONB
	const originalData = JSON.stringify(row);

	// Note: Checking exact JSONB match in PostgREST is complex via query params,
	// so we fetch by full_name and check in memory.
	const getRes = await fetch(`${POSTGREST_URL}/mentions?full_name=eq.${encodeURIComponent(fullName)}`, { headers: API_HEADERS });
	if (getRes.ok) {
		const existingMentions = await getRes.json();
		const duplicate = existingMentions.find(m => JSON.stringify(m.original_data) === originalData);
		if (duplicate) {
			log(`Skipping duplicate for ${fullName}`);
			return;
		}
	}

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
		source: selectedSource.display_name,
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

	console.log(mention);
	const postRes = await fetch(`${POSTGREST_URL}/mentions`, {
		method: 'POST',
		headers: {
			...API_HEADERS,
			'Prefer': 'return=representation'
		},
		body: JSON.stringify(mention)
	});

	if (!postRes.ok) {
		const err = await postRes.text();
		throw new Error(err);
	}

	const insertedMention = await postRes.json();

	// 6. Stub for assertions processing
	await createAssertions(insertedMention[0] || insertedMention, row);
}

async function applyFormatSpecificRules(mention, row) {
	const format = selectedSource.format || '';

	// Census Formats (1870, 1880)
	if (format.includes('Census')) {
		mention.legal_status = 'F';
	}

	// FreeBlackRegister
	if (format.includes('FreeBlackRegister')) {
		mention.source = "ALB_FBR";
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
				console.log(`Converted height ${row.height} to ${inches} inches`);
			} else {
				console.log(`Failed to parse height format: ${row.height}`);
			}
		} else if (row.Height) {
			const match = row.Height.match(/(\d+)\s*'\s*(\d+)\s*"?/);
			if (match) {
				const inches = parseInt(match[1]) * 12 + parseInt(match[2]);
				mention.original_data.Height = inches;
				console.log(`Converted height ${row.Height} to ${inches} inches`);
			} else {
				console.log(`Failed to parse height format: ${row.Height}`);
			}
		}
	}

	// FindAGrave
	if (format.includes('FindAGrave')) {
		mention.source = "ALB_FindAGrave";
		mention.confidence = 0.8;
	}

	// FreedmansList
	if (format.includes('FreedmansList')) {
		mention.source = "ALB_FL-1865";
		if (row.record_year) {
			const yr = parseInt(row.record_year);
			if (!isNaN(yr)) mention.source_year = yr;
		}
	}

	// VitalRecord
	if (format.includes('VitalRecord')) {
		mention.source = "ALB_VR_1715";
		if (row.record_year) {
			const yr = parseInt(row.record_year);
			if (!isNaN(yr)) mention.source_year = yr;
		}
	}
}

async function createAssertions(mention, row) {
	// Assertions are created here based on the format .md files
	// Since we don't have the specific format files parsed, we stub this out.
	// E.g., check for explicit relationships and POST to /assertions
}

async function processPostHocMentions() {
	log('Starting Post-Hoc Mentions processing...');

	// Fetch mentions for the current source
	const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(selectedSource.display_name)}`, { headers: API_HEADERS });
	if (!res.ok) {
		throw new Error('Failed to fetch census mentions for post-hoc processing');
	}

	const mentions = await res.json();

	// Group by source_year and dwelling/family
	const updates = [];

	mentions.forEach(m => {
		if (!m.source_year) return;

		let needsUpdate = false;
		let updateObj = {};

		if (m.original_data && m.original_data.dwelling) {
			updateObj.household_id = `HC${m.source_year}-${m.original_data.dwelling}`;
			needsUpdate = true;
		}

		if (m.original_data && m.original_data.family) {
			updateObj.family_id = `FC${m.source_year}-${m.original_data.family}`;
			needsUpdate = true;
		}

		if (needsUpdate) {
			updates.push({
				mention_id: m.mention_id,
				...updateObj
			});
		}
	});

	log(`Found ${updates.length} mentions to update with household/family IDs.`);

	// Process updates
	for (const update of updates) {
		const { mention_id, ...data } = update;
		await fetch(`${POSTGREST_URL}/mentions?mention_id=eq.${mention_id}`, {
			method: 'PATCH',
			headers: API_HEADERS,
			body: JSON.stringify(data)
		});
	}
}

async function processPostHocAssertions() {
	log('Starting Post-Hoc Assertions processing...');

	// Fetch all mentions for this source, ordered by mention_id as a proxy for insertion order 
	// (though we'll sort by 'line' if available)
	const res = await fetch(`${POSTGREST_URL}/mentions?source=eq.${encodeURIComponent(selectedSource.display_name)}`, { headers: API_HEADERS });
	if (!res.ok) {
		throw new Error('Failed to fetch mentions for assertions');
	}

	const mentions = await res.json();

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

	let assertionCount = 0;

	for (const [hhId, members] of Object.entries(households)) {
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
				const assertion = {
					subject_id: head.mention_id,
					predicate: predicate,
					county: selectedSource.county || '',
					object_id: self.mention_id,
					who: who,
					start_year: parseInt(selectedSource.year),
					confidence: confidence
				};

				try {
					await saveAssertion(assertion);
					assertionCount++;
				} catch (err) {
					log(`Failed to create assertion: ${err.message}`, true);
				}
			}
		}
	}

	log(`Created ${assertionCount} household assertions.`);
}

async function saveAssertion(assertion) {
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
	if (!str) return 'B';
	const s = str.toLowerCase();
	if (s.startsWith('w') || s.startsWith('cauc')) return 'W';
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

// Initialize
document.addEventListener('DOMContentLoaded', loadSources);
