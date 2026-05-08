async function expandAssertions() {
	if (typeof actionSelect !== 'undefined') actionSelect.disabled = true;
	if (typeof progressSection !== 'undefined') progressSection.classList.remove('hidden');
	log('Starting assertion expansion...');
	const startTime = Date.now();

	try {
		// 1. Fetch all assertions
		log('Fetching assertions from database...');
		let allAssertions = [];
		let offset = 0;
		const limit = 1000;
		while (true) {
			const res = await fetch(`${POSTGREST_URL}/assertions?limit=${limit}&offset=${offset}&order=assertion_id.asc`, { headers: API_HEADERS });
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
		log(`Loaded ${allAssertions.length} assertions.`);

		// Helpers
		const getAssertionKey = (subj, pred, objId, objStr) => `${subj}|${pred}|${objId || objStr || 'null'}`;
		const existingKeys = new Set(allAssertions.map(a => getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string)));
		const newAssertionsToInsert = [];

		const addDerived = (a) => {
			const key = getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string);
			if (!existingKeys.has(key)) {
				newAssertionsToInsert.push(a);
				existingKeys.add(key);
				allAssertions.push(a);
			}
		};

		// --- PASS A: Ungendering and Canonicalization (in-place) ---
		log('Running Pass A (Ungendering and Canonicalization)...');
		const passAMappings = {
			isMotherOf: 'isParentOf', isFatherOf: 'isParentOf',
			isSonOf: 'isChildOf', isDaughterOf: 'isChildOf',
			isHusbandOf: 'isSpouseOf', isWifeOf: 'isSpouseOf',
			isBrotherOf: 'isSiblingOf', isSisterOf: 'isSiblingOf',
			isGrandFatherOf: 'isGrandParentOf', isGrandMotherOf: 'isGrandParentOf',
			isGrandSonOf: 'isGrandChildOf', isGrandDaughterOf: 'isGrandChildOf',
			isUncleOf: 'isPiblingOf', isAuntOf: 'isPiblingOf',
			isNephewOf: 'isNiblingOf', isNieceOf: 'isNiblingOf',
			isStepMotherOf: 'isStepParentOf', isStepFatherOf: 'isStepParentOf',
			isStepSonOf: 'isStepChildOf', isStepDaughterOf: 'isStepChildOf',
			isStepBrotherOf: 'isStepSiblingOf', isStepSisterOf: 'isStepSiblingOf',
			isFatherInLawOf: 'isParentInLawOf', isMotherInLawOf: 'isParentInLawOf',
			isSonInLawOf: 'isChildInLawOf', isDaughterInLawOf: 'isChildInLawOf',
			isBrotherInLawOf: 'isSiblingInLawOf', isSisterInLawOf: 'isSiblingInLawOf',
			isGrandFatherInLawOf: 'isGrandParentInLawOf', isGrandMotherInLawOf: 'isGrandParentInLawOf',
			isGrandSonInLawOf: 'isGrandChildInLawOf', isGrandDaughterInLawOf: 'isGrandChildInLawOf',
			isUncleInLawOf: 'isPiblingInLawOf', isAuntInLawOf: 'isPiblingInLawOf',
			isNephewInLawOf: 'isNiblingInLawOf', isNieceInLawOf: 'isNiblingInLawOf'
		};

		for (const [oldPred, newPred] of Object.entries(passAMappings)) {
			// Bulk patch in DB
			try {
				await fetch(`${POSTGREST_URL}/assertions?predicate=eq.${oldPred}`, {
					method: 'PATCH',
					headers: API_HEADERS,
					body: JSON.stringify({ predicate: newPred })
				});
			} catch (err) {
				log(`Failed Pass A bulk patch for ${oldPred}: ${err.message}`, true);
			}
			// Update local state
			allAssertions.forEach(a => {
				if (a.predicate === oldPred) {
					existingKeys.delete(getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string));
					a.predicate = newPred;
					existingKeys.add(getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string));
				}
			});
		}

		// Symmetric canonicalization
		const symmetricPreds = ['isSpouseOf', 'isSiblingOf', 'isCousinOf', 'isStepSiblingOf'];
		const swapUpdates = [];
		allAssertions.forEach(a => {
			if (symmetricPreds.includes(a.predicate) && a.object_id && a.subject_id > a.object_id) {
				swapUpdates.push({
					assertion_id: a.assertion_id,
					subject_id: a.object_id,
					object_id: a.subject_id
				});
				existingKeys.delete(getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string));
				const temp = a.subject_id;
				a.subject_id = a.object_id;
				a.object_id = temp;
				existingKeys.add(getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string));
			}
		});

		if (swapUpdates.length > 0) {
			log(`Applying ${swapUpdates.length} symmetric swaps...`);
			// PostgREST bulk UPSERT using POST with Prefer: resolution=merge-duplicates
			for (let i = 0; i < swapUpdates.length; i += 100) {
				const chunk = swapUpdates.slice(i, i + 100);
				await fetch(`${POSTGREST_URL}/assertions`, {
					method: 'POST',
					headers: { ...API_HEADERS, 'Prefer': 'resolution=merge-duplicates' },
					body: JSON.stringify(chunk)
				});
			}
		}

		// --- PASS B (Run 1): Inverse Assertions ---
		log('Running Pass B (Inverse assertions)...');
		const runPassB = () => {
			const passBMappings = {
				'isParentOf': 'isChildOf',
				'isChildOf': 'isParentOf',
				'isGrandParentOf': 'isGrandChildOf',
				'isGrandChildOf': 'isGrandParentOf',
				'isPiblingOf': 'isNiblingOf',
				'isNiblingOf': 'isPiblingOf',
				'isStepParentOf': 'isStepChildOf',
				'isStepChildOf': 'isStepParentOf'
			};
			const snapshot = [...allAssertions]; // Iterate over current state
			let added = 0;
			snapshot.forEach(a => {
				if (a.object_id && passBMappings[a.predicate]) {
					const invPred = passBMappings[a.predicate];
					const derived = {
						subject_id: a.object_id,
						predicate: invPred,
						object_id: a.subject_id,
						object_string: null,
						county: a.county,
						start_year: a.start_year,
						end_year: a.end_year,
						confidence: a.confidence,
						who: 'expanded'
					};
					const key = getAssertionKey(derived.subject_id, derived.predicate, derived.object_id, derived.object_string);
					if (!existingKeys.has(key)) {
						newAssertionsToInsert.push(derived);
						existingKeys.add(key);
						allAssertions.push(derived);
						added++;
					}
				}
			});
			return added;
		};
		const passB1Count = runPassB();
		log(`Pass B added ${passB1Count} assertions.`);

		// --- PASS C: Transitive (graph closure) ---
		log('Running Pass C (Transitive closures)...');
		const bySubject = {};
		const byObject = {};
		allAssertions.forEach(a => {
			if (!bySubject[a.subject_id]) bySubject[a.subject_id] = [];
			bySubject[a.subject_id].push(a);
			if (a.object_id) {
				if (!byObject[a.object_id]) byObject[a.object_id] = [];
				byObject[a.object_id].push(a);
			}
		});

		let passCCount = 0;
		// Rule 1: sibling_from_parent: X isChildOf P ∧ Y isChildOf P ∧ X ≠ Y → isSiblingOf(min(X,Y), max(X,Y))
		const parentToChildren = {};
		allAssertions.forEach(a => {
			if (a.predicate === 'isChildOf' && a.object_id) {
				if (!parentToChildren[a.object_id]) parentToChildren[a.object_id] = [];
				parentToChildren[a.object_id].push(a);
			}
		});

		for (const p in parentToChildren) {
			const children = parentToChildren[p];
			for (let i = 0; i < children.length; i++) {
				for (let j = i + 1; j < children.length; j++) {
					let X = children[i].subject_id;
					let Y = children[j].subject_id;
					if (X === Y) continue;

					// Symmetric canonical form (subject < object_id)
					let subj = X < Y ? X : Y;
					let obj = X < Y ? Y : X;

					const confidence = Math.min(children[i].confidence || 1, children[j].confidence || 1);

					const derived = {
						subject_id: subj,
						predicate: 'isSiblingOf',
						object_id: obj,
						object_string: null,
						county: children[i].county || children[j].county,
						start_year: Math.min(children[i].start_year || 9999, children[j].start_year || 9999),
						end_year: null,
						confidence: confidence,
						who: 'expanded'
					};
					if (derived.start_year === 9999) derived.start_year = null;

					const key = getAssertionKey(subj, 'isSiblingOf', obj, null);
					if (!existingKeys.has(key)) {
						newAssertionsToInsert.push(derived);
						existingKeys.add(key);
						allAssertions.push(derived);
						passCCount++;
					}
				}
			}
		}

		// Rule 2: grandparent_from_parent: X isParentOf Y ∧ Y isParentOf Z → X isGrandParentOf Z
		allAssertions.forEach(aXY => {
			if (aXY.predicate === 'isParentOf' && aXY.object_id) {
				const Y = aXY.object_id;
				const Ychildren = bySubject[Y] || [];
				Ychildren.forEach(aYZ => {
					if (aYZ.predicate === 'isParentOf' && aYZ.object_id) {
						const Z = aYZ.object_id;
						if (aXY.subject_id !== Z) {
							const confidence = Math.min(aXY.confidence || 1, aYZ.confidence || 1);
							const derived = {
								subject_id: aXY.subject_id,
								predicate: 'isGrandParentOf',
								object_id: Z,
								object_string: null,
								county: aXY.county || aYZ.county,
								start_year: Math.min(aXY.start_year || 9999, aYZ.start_year || 9999),
								end_year: null,
								confidence: confidence,
								who: 'expanded'
							};
							if (derived.start_year === 9999) derived.start_year = null;

							const key = getAssertionKey(derived.subject_id, derived.predicate, derived.object_id, derived.object_string);
							if (!existingKeys.has(key)) {
								newAssertionsToInsert.push(derived);
								existingKeys.add(key);
								allAssertions.push(derived);
								passCCount++;
							}
						}
					}
				});
			}
		});
		log(`Pass C added ${passCCount} assertions.`);

		// --- PASS B (Run 2): Inverse Assertions ---
		log('Running Pass B (second time)...');
		const passB2Count = runPassB();
		log(`Pass B (second run) added ${passB2Count} assertions.`);

		// Write all new derived assertions
		if (newAssertionsToInsert.length > 0) {
			log(`Writing ${newAssertionsToInsert.length} derived assertions to DB...`);
			for (let i = 0; i < newAssertionsToInsert.length; i += 100) {
				const chunk = newAssertionsToInsert.slice(i, i + 100);
				const writeRes = await fetch(`${POSTGREST_URL}/assertions`, {
					method: 'POST',
					headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
					body: JSON.stringify(chunk)
				});
				if (!writeRes.ok) {
					log(`Error writing derived assertions chunk: ${writeRes.status} ${await writeRes.text()}`, true);
				}
			}
		}

		// --- Final Action: Remove duplicate assertions ---
		log('Removing duplicate assertions...');
		const groups = {};
		allAssertions.forEach(a => {
			const key = getAssertionKey(a.subject_id, a.predicate, a.object_id, a.object_string);
			if (!groups[key]) groups[key] = [];
			groups[key].push(a);
		});

		const idsToDelete = [];
		for (const key in groups) {
			const group = groups[key];
			if (group.length > 1) {
				const nonExpanded = group.filter(a => a.who !== 'expanded');
				const expanded = group.filter(a => a.who === 'expanded');

				if (nonExpanded.length > 0 && expanded.length > 0) {
					// Keep non-expanded, delete expanded ones that have IDs
					idsToDelete.push(...expanded.filter(a => a.assertion_id).map(a => a.assertion_id));
				} else if (expanded.length > 1 && nonExpanded.length === 0) {
					// All are expanded. Keep one, delete the rest.
					const toDel = expanded.slice(1).filter(a => a.assertion_id).map(a => a.assertion_id);
					idsToDelete.push(...toDel);
				}
			}
		}

		if (idsToDelete.length > 0) {
			log(`Deleting ${idsToDelete.length} duplicate expanded assertions...`);
			for (let i = 0; i < idsToDelete.length; i += 100) {
				const chunk = idsToDelete.slice(i, i + 100);
				await fetch(`${POSTGREST_URL}/assertions?assertion_id=in.(${chunk.join(',')})`, {
					method: 'DELETE',
					headers: API_HEADERS
				});
			}
		}

		log('Assertion expansion complete.');
		if (typeof updateProgress !== 'undefined') {
			updateProgress(100, 100, startTime, 'expansion complete');
		}

	} catch (err) {
		log(`Expansion failed: ${err.message}`, true);
	} finally {
		if (typeof actionSelect !== 'undefined') actionSelect.disabled = false;
	}
}
