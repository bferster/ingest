---
name: DeathRecordsFormat
description: Format instructions for DeathRecordsFormat
---

**DEATH RECORDS FORMAT**

	This file is a transcription of death records.	
	It is a table with 18 columns. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row {
		- line - A unique identifier for the row
		- full_name - The combination of the first_name, middle_name, and the last_name separated by spaces
		- first_name - The person's given name
		- middle_name - The person's middle name or initial
		- last_name - The person's surname
		- gender - The sex of the person. Can be F for female or M for male
		- birth_year - The year the person was born
		- death_year - The year the person died
		- race - The race of the person
		- occupation - The occupation or profession of the person
		- spouse_name - The name of the person's spouse or consort
		- parent1 - The first parent mentioned in the record
		- parent2 - The second parent mentioned in the record
		- free_or_enslaved - The legal status of the person (free or enslaved)
		- owner_name - The name of the enslaver or owner
		- event_type - The cause of death or type of event
		- event_place - The location where the event occurred
		- event_date - The date the event occurred
		}

**Example rows**

| line | full_name | first_name | middle_name | last_name | gender | birth_year | death_year | race | occupation | spouse_name | parent1 | parent2 | free_or_enslaved | owner_name | event_type | event_place | event_date |
| ---- | --------- | ---------- | ----------- | --------- | ------ | ---------- | ---------- | ---- | ---------- | ----------- | ------- | ------- | ---------------- | ---------- | ---------- | ----------- | ---------- |
| 1 | Mary Lorene Stuart Archart | Mary | Lorene | Archart | F | 1864 | 1864 | W | | | Phil Archart | Lucinda Archart | | | Croup | Augusta | 25 November 1864 |
| 2 | Mary Arion | Mary | | Arion | F | 1805 | 1864 | W | | John Arion | Betsy Garter | Abr Garter | | | Cancer | Augusta | October 1864 |
| 3 | Sarah Ann Alexander | Sarah | Ann | Alexander | F | 1824 | 1864 | W | | Wm B Alexander | Moses Manuell | Mary Manuell | | | Affiction of Heart | Augusta | 5 May 1864 |
| 4 | Abrm Archart | Abrm | | Archart | M | 1828 | 1864 | W | Soldier | Elizabeth Archart | Phil Archart | Reb Archart | | | Wounded Spotted O H | Augusta | 6 May 1864 |
| 5 | Henry Berry | Henry | | Berry | M | 1781 | 1864 | W | Farmer | Cather Berry | | | | | Old Age | Augusta | May 1864 |
| 6 | Harrisen T Bolen | Harrisen | T | Bolen | M | 1823 | 1864 | W | Soldier | Reb Boulen | | | | | Wounded | Augusta | September 1864 |
| 7 | Anna Bloper | Anna | | Bloper | F | 1864 | 1864 | W | | | Joseph Bloper | Odia Bloper | | | Pneumonia | Augusta | March 1864 |
| 8 | Mary M Bowman | Mary | M | Bowman | F | 1837 | 1864 | W | | | King | Wm King | | | Fever | Augusta | 23 December 1864 |
| 9 | Sarah Ellen Brannaman | Sarah | Ellen | Brannaman | F | 1858 | 1864 | W | | | Saml Brannaman | Elizth Brannaman | | | Diptheria | Augusta | November 1864 |
| 10 | Rufus Morgan Brown | Rufus | Morgan | Brown | M | 1844 | 1864 | W | | | Elizth Brown | Jeremiah Brown | | | Killed In Battle | Churchville | 2 May 1864 |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.
	- The source_year field is set to the year in the death_year field.
	- person's name populate the full_name, first_name, middle_name, and last_name fields.
	- The confidence field is set to 0.9.
	- Apply the normalization as described in @Normalize.md
	- Create mention_id as decribed below
	- Add mention to mentions table

**Creating the mention_id and source**

	- The source is created as follows: for example: ALB-DE-1, where  "ALB" is the county, "DE" is the prefix

**Add person mention**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-DE-1, where  "ALB" is the county, "DE" is the prefix and "1" is the line number from the line field in the row. 
	- for each row of this source {
		- Most of the fields in file match the same as the mentions' fields.
		- Add mention to mentions table.
	}

**Add parent / spouse mentions**

	- This occurs after all row mentions have been added to the mentions table
	- for each mention added after ingestion of this source {

		- get parent1 value
		- if parent1 != null then {
			- normalize parent's name and add those fields
			- ignore all other fields except race
			- create first new parent mention
				- set new parent mention_id with new mention_id with format: for example: ALB-DE-1.1, where  "ALB" is the county, "DE" is the prefix and "1.1" is the index for first parent.
			- Add mention to mentions table.
			}

		- get parent2 value
		- if parent2 != null then {
			- normalize parent's name and add those fields
			- ignore all other fields except race
			- create second new parent mention
				- set new parent mention_id with new mention_id with format: for example: ALB-DE-1.2, where  "ALB" is the county, "DE" is the prefix and "1.2" is the index for second parent.
			- Add mention to mentions table.
			}

		- get spouse_name value
		- if spouse_name != null then {
			- normalize spouse's name and add those fields
			- ignore all other fields except race
			- create spouse mention
				- set new spouse mention_id with new mention_id with format: for example: ALB-DE-1.3, where  "ALB" is the county, "DE" is the prefix and "1.3" is the index for spouse.
			- Add mention to mentions table.
			}

**Add enslaver mentions**

	- This occurs after all parent mentions have been added to the mentions table
	- for each mention added after ingestion of this source {
		- get owner_name value
		- if owner_name != null then {
			- normalize owner's name and add those fields
			- ignore all other fields
			- set race to W
			- set legal_status to "H"
			- create owner mention
				- set new owner mention_id with new mention_id with format: for example: ALB-DE-1.4, where  "ALB" is the county, "DE" is the prefix and "1.4" is the index for owner.
			- Add mention to mentions table.
			}
	
**Add parent assertions**

	- This occurs after all mentions have been added to the mentions table.
	- if new parent mentions are added, add a new assertion for each: {
			subject: parent's mention_id
			predicate: "isParentOf"
			object: person's mention_id
			who:  "deathRecords"
			start_year: source_year
			end_year: ""
			confidence: 0.80
			}
		- Add assertion to assertions table.
	}

**Add spouse assertions**

	- This occurs after all mentions have been added to the mentions table.
	- if new spouse mentions are added, add a new assertion for each: {
			subject: spouse's mention_id
			predicate: "isSpouseOf"
			object: person's mention_id
			who: "deathRecords"
			start_year: source_year
			end_year: ""
			confidence: 0.80
			}
		- Add assertion to assertions table.


**Add enslaver assertions**

	- This occurs after all mentions have been added to the mentions table.
	- if there is an owner_name add a new assertion for each person: {
			all have {
				who: "deathRecords"
				start_year: source_year
				end_year: ""
				confidence: 0.80
				predicate: "wasEnslavedBy"
				}
			if person != null then {
				subject: person's mention_id
				object: owner's mention_id
				Add assertion to assertions table.
				}
			if parent1 != null then {
				subject: parent1's mention_id
				object: owner's mention_id
				Add assertion to assertions table.
				}
			if parent2 != null then {
				subject: parent2's mention_id
				object: owner's mention_id
				Add assertion to assertions table.
				}
			if spouse_name != null then {
				subject: spouse's mention_id
				object: owner's mention_id
				Add assertion to assertions table.
				}
		}


**Original source**

	Augusta is page 235-553
	Scrape with ALL