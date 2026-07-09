const fetch = require('node-fetch');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

const POSTGREST_URL = 'http://127.0.0.1:3000';
const API_HEADERS = { 'Content-Type': 'application/json' };

// Mock log
function log(msg, isError) {
    if (isError) console.error('[ERROR]', msg);
    else console.log('[LOG]', msg);
}

// Helpers from app.js
function getRowValue(obj, key) {
	if (!obj) return undefined;
	const normalize = (s) => s.toLowerCase().trim().replace(/[-_]/g, '');
	const target = normalize(key);
	const foundKey = Object.keys(obj).find(k => normalize(k) === target);
	return foundKey ? obj[foundKey] : null;
}

function normalizeFirstName(name) {
	return String(name || '').toUpperCase().trim();
}

function simpleNysiis(name) {
	return String(name || '').toUpperCase().trim();
}

function soundex(name) {
    return '';
}

function mapRace(race) {
    return race || '';
}

function mapGender(gender) {
    return gender || '';
}

function simpleRaceNorm(race) {
    return race || '';
}

function normalizeOccupation(occ) {
    return occ || '';
}

class MentionIdGenerator {
	constructor() {
		this.usedIds = {};
	}
	generate(prefix, line) {
		let cleanLine = String(line || '').trim();
		if (!cleanLine) {
			cleanLine = 'unknown';
		}
		const baseId = `${prefix}-${cleanLine}`;
		if (this.usedIds[baseId] === undefined) {
			this.usedIds[baseId] = 0;
			return baseId;
		} else {
			this.usedIds[baseId]++;
			return `${baseId}.${this.usedIds[baseId]}`;
		}
	}
}

function getMentionPrefix(format, county, sourceYear, row) {
	if (format.includes('SlaveSchedule')) {
		return `${county}-SS-${sourceYear}`;
	}
	return `${county}-MISC`;
}

// Global mocks
let selectedSource = {
    display_name: 'ALB-SS-1850',
    year: 1850,
    format: 'SlaveScheduleFormat.md',
    county: 'ALB'
};
let currentConfidence = 0.9;
let idGenerator = new MentionIdGenerator();
let householdMap = new Map();
let familyMap = new Map();

function applyFormatSpecificRules(mention, row) {
	const format = selectedSource.format || '';

	// SlaveSchedule
	if (format.includes('SlaveSchedule')) {
		const isOwner = String(row.owner || row.Owner || row.status || row.Status || '').trim().toUpperCase() === 'Y' || String(row.status || row.Status || '').trim().toLowerCase() === 'owner';
		if (isOwner) {
			mention.legal_status = null;
			mention.head = true;
			mention.birth_year = null;
			mention.death_year = null;
			mention.race = 'W'; // Set enslaver's race to "W"
			mention.norm_race = 'W';
			mention.gender = null;
		} else {
			mention.legal_status = 'E';
			mention.head = null;
			mention.race = 'B';
			mention.norm_race = 'B';
		}
	}
}

async function prepareMention(row, rowIndex = -1) {
	const firstName = row.first_name || row.FirstName || row.GivenName || '';
	const middleName = row.middle_name || row.MiddleName || '';
	const lastName = row.last_name || row.LastName || row.Surname || '';
	const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

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
	const prefix = getMentionPrefix(format, county, selectedSource.year, row);
	const line = getRowValue(row, 'line') || '';
	const mId = idGenerator.generate(prefix, line);

	const mention = {
		mention_id: mId,
		source: prefix,
		source_year: parseInt(selectedSource.year),
		original_data: row,
		confidence: currentConfidence,
		full_name: fullName,
		first_name: firstName,
		middle_name: middleName,
		last_name: lastName,
		birth_year: computedBirthYear,
		death_year: isNaN(deathYear) ? null : deathYear,
		race: mapRace(row.race || row.Race),
		gender: mapGender(row.gender || row.Gender || row.Sex),
		occupation: rawOccupation,
		norm_first_name: normFirstName,
		nysiis_last_name: nysiisLastName,
		soundex_last_name: soundex(lastName),
		norm_race: normRace ? normRace.substring(0, 1) : null,
		norm_occupation: normOccupation,
		head: String(row.head || row.Head || '').toUpperCase() === 'Y' || String(row.head || row.Head || '').toLowerCase() === 'true',
		legal_status: '', // Default
		household_id: rowIndex >= 0 ? (householdMap.get(rowIndex) || null) : null,
		family_id: rowIndex >= 0 ? (familyMap.get(rowIndex) || null) : null
	};

	applyFormatSpecificRules(mention, row);
	return mention;
}

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

async function fetchExistingAssertionKeys(who) {
	return new Set();
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

function updateProgress() {}

// processSlaveScheduleAssertions modified to mock behavior
async function processSlaveScheduleAssertions(mentions) {
	log('Creating wasEnslavedBy assertions for Slave Schedule...');

	const enslaved = mentions.filter(m => m.legal_status === 'E');
	const enslavers = mentions.filter(m => m.head === true || m.is_enslaver === true);

	const enslaverMap = new Map(); // full_name -> mention_id
	enslavers.forEach(e => {
		enslaverMap.set(e.full_name, e.mention_id);
	});

	log('Checking for existing slaveSchedule assertions to avoid duplicates...');
	const existingAssertionKeys = await fetchExistingAssertionKeys('slaveSchedule');

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
					object_id: enslaverId,
					who: 'slaveSchedule',
					start_year: parseInt(selectedSource.year),
					end_year: null,
					confidence: 0.9
				});
				existingAssertionKeys.add(aKey);
			}
		}
	}

	log(`Writing ${assertionsToCreate.length} assertions...`);
	await saveAssertionsBatch(assertionsToCreate);
    log('Assertions written successfully!');
}

async function run() {
    log('Truncating tables for clean run...');
    await fetch(`${POSTGREST_URL}/assertions?assertion_id=not.is.null`, { method: 'DELETE' });
    await fetch(`${POSTGREST_URL}/mentions?mention_id=not.is.null`, { method: 'DELETE' });

    log('Fetching ALB-SS-1850 CSV...');
    const csvRes = await fetch('https://docs.google.com/spreadsheets/d/1Jf2zsFW_sh-QVmwhJUD8SNamu-kflhqPONJky04_zmg/export?format=csv');
    const csvText = await csvRes.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const currentCsvData = parsed.data;

    log('Mapping household IDs...');
    let currentHouseholdId = null;
    let householdCounter = 1;
    let currentEnslaver = null;
    for (let i = 0; i < currentCsvData.length; i++) {
        const row = currentCsvData[i];
        const isOwner = String(row.owner || row.Owner || row.status || row.Status || '').trim().toUpperCase() === 'Y' || String(row.status || row.Status || '').trim().toLowerCase() === 'owner';
        if (isOwner) {
            currentHouseholdId = `HS${selectedSource.year}-${householdCounter++}`;
            currentEnslaver = [row.first_name || row.FirstName || '', row.middle_name || row.MiddleName || '', row.last_name || row.LastName || ''].filter(Boolean).join(' ').trim() || row.full_name || row.FullName || '';
        }
        if (currentHouseholdId) {
            householdMap.set(i, currentHouseholdId);
            row.enslaver_full_name = currentEnslaver;
        }
    }

    const totalRows = Math.min(50, currentCsvData.length);
    log(`Ingesting first ${totalRows} rows...`);

    const batch = [];
    for (let i = 0; i < totalRows; i++) {
        const row = currentCsvData[i];
        const mention = await prepareMention(row, i);
        batch.push(mention);
    }
    await insertBatch(batch);
    log('Finished ingesting mentions.');

    log('Running post-hoc assertions...');
    await processSlaveScheduleAssertions(batch);
    log('Run completed successfully!');
}

run().catch(err => console.error(err));
