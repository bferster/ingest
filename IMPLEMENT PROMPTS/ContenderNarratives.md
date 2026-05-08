### PHASE TASK

	The overall goal is to implement steps of the development plan outlined in @veritePlan.md. This is a separate plain vanilla JavaScript web application that is used only by the system administrators. Use async/await throughout; no callback-style code.

	Place code in a phase module titled: contenderNarratives.js with separate functions for each pass and a top-level ContenderNarratives() orchestrator.

	This plan will be implemented in multiple phases. Implement only the phase below:

### PHASE TASK: CREATE CONTENDER NARRATIVES

	Build a contender list — a composite of possible candidates for personhood — from the mentions and assertions tables, convert each contender into a human-readable narrative sentence, vectorize that narrative later, using an LLM embedding model, and save the narrative text and embedding back onto the originating mention. The contender intermediate data is then discarded; only the narrative and narrative_vector fields persist on the mention.

	There will be many more contenders than actual people. Each mention becomes one contender. Contenders are not verified people; their vectors are used downstream to estimate the likelihood that two mentions refer to the same person, and to match user-provided narratives against the mention population.

	Pre-calculate a name_frequencies JSON object from the mentions when this phase starts,so it will know which names are "rare."

	THE FOUR STEPS are run in order

**Step 1: Build contender list from mentions**

	For each row in the mentions table, create one contender row. Contenders are intermediate working data — they live in an in-memory array, but they must be discarded at the end of Step 4.

		Each contender has the following fields. Not every field will be populated for every contender {
			year                    year the source data was from (e.g., census year)
			full_name               mention's full_name
			norm_name               norm_first_name + last_name
			nysiis_last_name        nysiis_last_name
			race                    'B' or 'W'
			gender                  'M' or 'F'
			birth_year              birth_year
			birth_year2             birth_year repeated (deliberate duplication to boost weight in vector)
			death_year              death_year
			norm_occupation         norm_occupation
			maiden_name             maiden_name
			locations               JSONB array of location names
			spouses                 JSONB array of spouses' norm_names
			parents                 JSONB array of parents' norm_names
			enslaver_names          JSONB array of enslavers' norm_names
			children                JSONB array of children's norm_names
			relatives               JSONB array of relatives' norm_names
			housemates              JSONB array of housemates' norm_names (max 5; see rule below)
			households              JSONB array of household_ids
			neighbors               JSONB array of neighbors' norm_names
			families                JSONB array of family_ids
			aliases                 JSONB array of name aliases
			}

	Rules when populating { 
		Multi-value fields are stored as JSONB arrays.
		Housemates: include a maximum of 5 names. Use the Fellegi-Sunter algorithm to select only relatively rare names from the candidate pool, so common names don't dominate the vector. Do not add family members (spouses, parents, children, relatives) to housemates — they belong in their own dedicated fields.
		Derived norm_names (for children, parents, relatives, housemates, neighbors). Made from norm_first_name + last_name.
		Unknown names: when a person is referenced but has no name in the source (e.g., enslaved persons listed only by age/sex on a slave schedule), set full_name and norm_name to "unnamed" and leave nysiis_last_name blank.
		}

**Step 2 — Augment contenders from assertions**

	For each contender, walk the rows in the assertions table where subject = mention_id and fill in any missing fields the assertions imply. Map predicates in assertion fields to contender fields as follows: 
		{
		Skip isSameAs assertions for this step.
		When an assertion's object is another mention_id (object_id IS NOT NULL), dereference it to get norm_first_name + last_last_name. 
		If adding a value would push housemates past 5, apply the Fellegi-Sunter rare-name selection across the combined candidate pool (Step 1 + Step 2 sources) and keep the 5 rarest.
		Deduplicate values within each array field after merging.
		}

**Step 3 — Compose narrative text**

	For each contender, format a human-readable sentence describing the person. Skip clauses for fields that have no value. 
	Use these two templates:

	For named individuals {
		"[Full Name] ([gender], [race], born [birth_year] [primary location]).
		Wife/Husband of [spouse full_name] (born [spouse birth_year]).
		Mother/Father is [parent norm_name].
		Children are [child1] (born [year]), [child2] (born [year]), ...
		Household with [housemate1], [housemate2], ...
		Occupation was [norm_occupation].
		Enslaver was [enslaver].
		Source: [source citation], [year]."

		Example: "Sarah Goings (female, Black, born 1855 Albemarle Co. VA). Wife of Thomas Goings (born 1850). Mother is Eliza Goings. Children are John (born 1873), Mary (born 1875). Household with Robert Smith, Hannah Smith. Occupation was laundress. Enslaver was Thomas Jackson. Source: US census, 1880."
		}

	For unnamed individuals: {
		"Unnamed [gender] ([race], born [birth_year]).
		Enslaved by [enslaver] in [location].
		Part of a household with [N] other [gender] enslaved.
		Source: [source citation], [year]."

		Example: "Unnamed female (Black, born 1845). Enslaved by General Thomas Smith in Albemarle Co. VA. Part of a household with 3 other enslaved females. Source: 1860 Slave Schedule."
		}

	Save the resulting narrative string to the mention's narrative field. This text remains on the mention permanently — it is useful for the researcher to read in sentence form, in addition to feeding the embedding model in the next step.

**Step 4 — Clean up**

	After Step 3 completes for all mentions, discard all contender intermediate data. The text for each contender /mention pair is added to the mention’s narrative field. Later on, that narrative will be vectorized and placed in the narrative_vector field.  Nothing else is preserved from this phase.


**FELLEGI-SUNTER ALGORITHM:**

	Create a function called buildNameFrequencies(dataset) {
		- It takes an array of person objects, such as a dataset of census records. 
		- It creates and returns two Map objects (firstNameFreq and lastNameFreq). 
		- It iterates through the dataset, normalizes the first_name and last_name (lowercase, trimmed), and counts their occurrences.
		}

	Create a function called getNameWeightModifier(name, freqMap) {
		- It takes a normalized name and its corresponding frequency map. It returns an value based on these rules {
			- Name missing/not in map: 0
			- Count <= 5 (Very Rare): 1
			- Count <= 20 (Uncommon): .5
			- Count between 21 and 100 (Average): 0
			- Count > 100 (Common): -5
			- Count > 500 (Extremely Common): -1
		}
	}

