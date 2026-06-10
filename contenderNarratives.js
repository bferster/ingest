function toTitleCase(str) {
	if (!str) return '';
	return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// FELLEGI-SUNTER ALGORITHM helpers
function buildNameFrequencies(dataset) {
	const firstNameFreq = new Map();
	const lastNameFreq = new Map();

	for (const person of dataset) {
		if (person.first_name) {
			const fn = person.first_name.toLowerCase().trim();
			firstNameFreq.set(fn, (firstNameFreq.get(fn) || 0) + 1);
		}
		if (person.last_name) {
			const ln = person.last_name.toLowerCase().trim();
			lastNameFreq.set(ln, (lastNameFreq.get(ln) || 0) + 1);
		}
	}
	return { firstNameFreq, lastNameFreq };
}

function getNameWeightModifier(name, freqMap) {
	if (!name) return 0;
	const n = name.toLowerCase().trim();
	if (!freqMap.has(n)) return 0;

	const count = freqMap.get(n);
	if (count <= 5) return 1;
	if (count <= 20) return 0.5;
	if (count <= 100) return 0;
	if (count > 500) return -1;
	if (count > 100) return -5;
	return 0;
}

async function ContenderNarratives() {
	if (typeof actionSelect !== 'undefined') actionSelect.disabled = true;
	if (typeof progressSection !== 'undefined') progressSection.classList.remove('hidden');
	log('Starting Contender Narratives creation...');
	const startTime = Date.now();

	try {
		// --- Prepare: Fetch Mentions and Assertions ---
		log('Fetching mentions from database...');
		let allMentions = [];
		let offset = 0;
		const limit = 2000;
		while (true) {
			const res = await fetch(`${POSTGREST_URL}/mentions?select=mention_id,source_year,full_name,first_name,norm_first_name,last_name,nysiis_last_name,race,gender,birth_year,death_year,occupation,norm_occupation,maiden_name,household_id,family_id,source,county&limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
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

		const { firstNameFreq, lastNameFreq } = buildNameFrequencies(allMentions);
		const mentionMap = new Map();
		allMentions.forEach(m => mentionMap.set(m.mention_id, m));

		log('Fetching assertions from database...');
		let allAssertions = [];
		offset = 0;
		while (true) {
			const res = await fetch(`${POSTGREST_URL}/assertions?select=subject_id,predicate,object_id,object_string,county,start_year,end_year,confidence&limit=${limit}&offset=${offset}`, { headers: API_HEADERS });
			if (!res.ok) throw new Error('Failed to fetch assertions');
			const data = await res.json();
			if (data.length === 0) break;
			allAssertions = allAssertions.concat(data);
			if (typeof updateProgress !== 'undefined') {
				updateProgress(allAssertions.length, allAssertions.length + (data.length === limit ? limit : 0), startTime, 'assertions loaded');
			}
			if (data.length < limit) break;
			offset += limit;
		}
		const assertionsBySubject = {};
		const addAssertion = (id, a) => {
			if (!id) return;
			if (!assertionsBySubject[id]) assertionsBySubject[id] = [];
			assertionsBySubject[id].push(a);
		};

		allAssertions.forEach(a => {
			addAssertion(a.subject_id, a);

			// For many predicates, we want the object to also see the relationship
			if (a.object_id) {
				const invMap = {
					'isSpouseOf': 'isSpouseOf',
					'isSiblingOf': 'isSiblingOf',
					'isCousinOf': 'isCousinOf',
					'isStepSiblingOf': 'isStepSiblingOf',
					'isSiblingInLawOf': 'isSiblingInLawOf',
					'isParentOf': 'isChildOf',
					'isChildOf': 'isParentOf',
					'isGrandParentOf': 'isGrandChildOf',
					'isGrandChildOf': 'isGrandParentOf',
					'isPiblingOf': 'isNiblingOf',
					'isNiblingOf': 'isPiblingOf',
					'isStepParentOf': 'isStepChildOf',
					'isStepChildOf': 'isStepParentOf',
					// Add more as needed
				};
				const invPred = invMap[a.predicate];
				if (invPred) {
					// Add a "virtual" inverse assertion for the object
					addAssertion(a.object_id, {
						...a,
						subject_id: a.object_id,
						object_id: a.subject_id,
						predicate: invPred
					});
				}
			}
		});

		// --- Step 1: Build contender list from mentions ---
		log('Step 1: Building contenders...');
		// Pre-group mentions by household_id for O(N) lookup complexity
		const mentionsByHousehold = new Map();
		for (const m of allMentions) {
			if (m.household_id) {
				if (!mentionsByHousehold.has(m.household_id)) {
					mentionsByHousehold.set(m.household_id, []);
				}
				mentionsByHousehold.get(m.household_id).push(m);
			}
		}

		const contenders = [];
		for (let i = 0; i < allMentions.length; i++) {
			const m = allMentions[i];

			const getNormName = (mention) => {
				if (!mention.first_name && !mention.last_name) return "unnamed";
				const fn = mention.norm_first_name || '';
				const ln = mention.last_name || '';
				return `${fn} ${ln}`.toUpperCase().trim();
			};

			let fn = m.first_name;
			let ln = m.last_name;
			let fullName = m.full_name;
			let normName = getNormName(m);
			let nysiis = m.nysiis_last_name || '';

			if (!fn && !ln && (!fullName || fullName.trim().toLowerCase() === 'unnamed')) {
				fullName = "unnamed";
				normName = "unnamed";
				nysiis = "";
			} else if (!fullName) {
				fullName = normName;
			}

			const contender = {
				mention_id: m.mention_id,
				year: m.source_year || '',
				full_name: fullName,
				norm_name: normName,
				nysiis_last_name: nysiis,
				race: m.race === 'B' || m.race === 'W' ? m.race : '',
				gender: m.gender === 'M' || m.gender === 'F' ? m.gender : '',
				birth_year: m.birth_year || '',
				birth_year2: m.birth_year || '',
				death_year: m.death_year || '',
				norm_occupation: m.norm_occupation || '',
				maiden_name: m.maiden_name || '',
				locations: [],
				spouses: [],
				parents: [],
				enslaver_names: [],
				children: [],
				relatives: [],
				housemates: [],
				households: m.household_id ? [m.household_id] : [],
				neighbors: [],
				families: m.family_id ? [m.family_id] : [],
				aliases: [],
				source_citation: m.source || ''
			};

			if (m.household_id && mentionsByHousehold.has(m.household_id)) {
				const householdMembers = mentionsByHousehold.get(m.household_id);
				for (const member of householdMembers) {
					if (member.mention_id !== m.mention_id) {
						contender.housemates.push(getNormName(member));
					}
				}
			}

			contenders.push(contender);
		}

		const scoreName = (name) => {
			if (!name || name === 'unnamed') return 0;
			const parts = name.split(/\s+/);
			const fn = parts[0];
			const ln = parts.slice(1).join(' ');
			return getNameWeightModifier(fn, firstNameFreq) + getNameWeightModifier(ln, lastNameFreq);
		};

		const rareNameFilter = (namesArray) => {
			if (namesArray.length <= 5) return namesArray;
			const scored = namesArray.map(name => ({ name, score: scoreName(name) }));
			scored.sort((a, b) => b.score - a.score);
			return scored.slice(0, 5).map(item => item.name);
		};


		log('Step 2: Augmenting contenders from assertions...');

		const uniqueMerge = (arr, val) => {
			if (!val) return;
			const v = val.toUpperCase().trim();
			if (!arr.includes(v)) arr.push(v);
		};

		for (let i = 0; i < contenders.length; i++) {
			const contender = contenders[i];
			const assertions = assertionsBySubject[contender.mention_id] || [];

			for (const a of assertions) {
				if (a.predicate === 'isSameAs') continue;

				let objectName = a.object_string;
				if (a.object_id && mentionMap.has(a.object_id)) {
					const objMention = mentionMap.get(a.object_id);
					const fn = objMention.norm_first_name || '';
					const ln = objMention.last_name || '';
					objectName = `${fn} ${ln}`.trim();
				}

				if (!objectName) continue;

				switch (a.predicate) {
					case 'isSpouseOf': uniqueMerge(contender.spouses, objectName); break;
					case 'isParentOf': uniqueMerge(contender.children, objectName); break;
					case 'isChildOf': uniqueMerge(contender.parents, objectName); break;
					case 'wasEnslavedBy': uniqueMerge(contender.enslaver_names, objectName); break;
					case 'isLocatedAt': uniqueMerge(contender.locations, objectName); break;
					case 'hasNameVariant': uniqueMerge(contender.aliases, objectName); break;
					case 'isSiblingOf':
					case 'isCousinOf':
					case 'isGrandParentOf':
					case 'isGrandChildOf':
					case 'isPiblingOf':
					case 'isNiblingOf':
					case 'isStepParentOf':
					case 'isStepChildOf':
					case 'isStepSiblingOf':
					case 'isParentInLawOf':
					case 'isChildInLawOf':
					case 'isSiblingInLawOf':
					case 'isGrandParentInLawOf':
					case 'isGrandChildInLawOf':
					case 'isPiblingInLawOf':
					case 'isNiblingInLawOf':
						uniqueMerge(contender.relatives, objectName);
						break;
				}
			}

			// Remove family members from housemates
			const familyNames = new Set([...contender.spouses, ...contender.parents, ...contender.children, ...contender.relatives]);
			contender.housemates = contender.housemates.filter(name => !familyNames.has(name));

			// Apply Fellegi-Sunter to housemates
			contender.housemates = rareNameFilter(contender.housemates);
		}

		// --- Step 3: Compose narrative text ---
		log('Step 3: Composing narratives...');
		const updates = [];
		for (let i = 0; i < contenders.length; i++) {
			const c = contenders[i];
			
			let fullName = c.full_name || '';
			if (!fullName || fullName.toLowerCase() === 'unnamed') {
				fullName = 'Unnamed';
			} else {
				fullName = toTitleCase(fullName);
			}

			let parenthetical = [];
			let g = c.gender ? c.gender.toUpperCase() : '';
			let r = c.race ? c.race.toUpperCase() : '';
			let gr = '';
			if (g && r) gr = `${g} / ${r}`;
			else if (g) gr = g;
			else if (r) gr = r;
			
			if (gr) {
				parenthetical.push(gr);
			}

			let birthInfo = '';
			if (c.birth_year) {
				birthInfo = `born ${c.birth_year}`;
				let loc = c.locations.length > 0 ? c.locations[0] : (mentionMap.get(c.mention_id).county || '');
				if (loc) {
					birthInfo += ` in ${toTitleCase(loc)}`;
				}
			} else {
				let loc = c.locations.length > 0 ? c.locations[0] : (mentionMap.get(c.mention_id).county || '');
				if (loc) {
					birthInfo = `in ${toTitleCase(loc)}`;
				}
			}

			if (birthInfo) {
				parenthetical.push(birthInfo);
			}

			let narrative = `${fullName}`;
			if (parenthetical.length > 0) {
				narrative += ` (${parenthetical.join(' ')})`;
			}
			narrative += '.';

			let parts = [];
			
			// Spouse of: [spouse full_name].
			if (c.spouses.length > 0) {
				const spousesTitle = c.spouses.map(s => toTitleCase(s)).join(', ');
				parts.push(`Spouse of: ${spousesTitle}.`);
			}
			
			// Parents are: [parent norm_name].
			if (c.parents.length > 0) {
				const parentsTitle = c.parents.map(p => toTitleCase(p)).join(', ');
				parts.push(`Parents are: ${parentsTitle}.`);
			}
			
			// Children: [child1], [child2], ...
			if (c.children.length > 0) {
				const childrenTitle = c.children.map(ch => toTitleCase(ch)).join(', ');
				parts.push(`Children: ${childrenTitle}.`);
			}
			
			// In house with: [housemate1], [housemate2], ...
			if (c.housemates.length > 0) {
				const housematesTitle = c.housemates.map(h => toTitleCase(h)).join(', ');
				parts.push(`In house with: ${housematesTitle}.`);
			}
			
			// Occupation was: [norm_occupation].
			if (c.norm_occupation) {
				parts.push(`Occupation was: ${toTitleCase(c.norm_occupation)}.`);
			}
			
			// Enslaved by: [enslaver].
			if (c.enslaver_names.length > 0) {
				const enslaversTitle = c.enslaver_names.map(e => toTitleCase(e)).join(', ');
				parts.push(`Enslaved by: ${enslaversTitle}.`);
			}

			if (parts.length > 0) {
				narrative += ' ' + parts.join(' ');
			}

			narrative = narrative.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();

			updates.push({
				mention_id: c.mention_id,
				narrative: narrative
			});
		}

		log('Step 4: Saving narratives to mentions...');
		// Process updates in batches of 500 using bulk POST with merge-duplicates resolution
		const CHUNK_SIZE = 500;
		for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
			const chunk = updates.slice(i, i + CHUNK_SIZE);
			const res = await fetch(`${POSTGREST_URL}/mentions`, {
				method: 'POST',
				headers: { ...API_HEADERS, 'Prefer': 'resolution=merge-duplicates' },
				body: JSON.stringify(chunk)
			});
			if (!res.ok) {
				throw new Error(`Failed to save bulk narratives: ${res.status} ${await res.text()}`);
			}

			if (typeof updateProgress !== 'undefined') {
				updateProgress(i + chunk.length, updates.length, startTime, 'narratives saved');
			}
		}

		log('Contender Narratives generation complete.');
		if (typeof updateProgress !== 'undefined') {
			updateProgress(100, 100, startTime, 'narratives complete');
		}

	} catch (err) {
		log(`Contender Narratives failed: ${err.message}`, true);
	} finally {
		if (typeof actionSelect !== 'undefined') actionSelect.disabled = false;
	}
}
