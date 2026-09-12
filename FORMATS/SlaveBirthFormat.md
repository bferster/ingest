---
name: SlaveBirthsFormat
description: Format instructions for SlaveBirthsFormat
---

**SlaveBirths FORMAT**

	This file contains the birth records of slaves.
	It is a table with 8 columns. 
	There may be omissions, duplications, and errors in this data.
	Some fields may be not be present in table.

**Field names and descriptions**
	
	The following columns represent information about the person in a row. 
	Some columns may be blank { 
		line - A unique identifier for the row
		birth_year - The year the person was born
		name - The child's name
		gender - The child's gender
		birth_place - The place the person was born
		owner_full_name - The full name of the person owning the child
		mother - The child's mother's name
		reported_by - The name of the person who reported the birth
	}

**Example rows**

	| line | birth_year | name | gender | birth_place | owner_full_name | mother | reported_by |
	| ---- | ---------- | ---- | ------ | ----------- | --------------- | ------ | ----------- |
	| 1 | 1853 | Nancy | F | near Poor House | William Young | | Owner |
	| 2 | 1853 | Alexander | M | Centreville | Augustus Staubus | Malinda | Owner |
	| 3 | 1853 | Cora | F | Churchville | Henry Sterrett | Fanny | Owner |
	| 4 | 1853 | Catherine | F | Near Dutch Church | William Cameron | | Owner |
	| 5 | 1853 | Julia | F | Mt. Sidney | George A. Bruce | Milley | Owner |
	| 6 | 1853 | Julia | F | Lewis Creek | Benjamin Reed | Fanny | Owner |
	| 7 | 1853 | | F | Long Meadow | John McCue | Maria | Owner |
	| 8 | 1853 | Robert | M | Waynesboro | Abraham Lynn | | Owner |
	| 9 | 1853 | Samuel | M | Back Creek | John Sale | | Owner |
	| 10 | 1853 | John Henry | M | near Middlebrook | Ellen Patterson | | Owner |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source_year field is set to the value of the birth_year column.
	- Set confidence to 0.95.
	- Create mention_id for each row: AUG-SB-1, where "AUG" is the county, "SB" is the source type, "1" is the line number from the line field in the row. 
	- Add only field specified. Do not infer any other fields.	
	- Add the following field to the data JSONB field:
		- reported_by
		- mother
		- owner_full_name
		- i.e. {"reported_by": "Owner", "mother": "Malinda", "owner_full_name": "Augustus Staubus"}

**Add enslaved child mention**

	- Set legal_status to "E".
	- Set race to "B" and norm_race to "B".
	- Set full_name and first_name from the name field.
	- Set birth_year, gender, and birth_place from the corresponding columns.
	- Add mention_id.
	- Apply normalization as described in @Normalize.md.
	- Add mention to mentions table.

**	Cleaning owner_full_name before split**

	- Strip a leading honorific into `title`.
		- Rev, Mrs, Miss, Capt, etc.
	- If the string contains " / ", treat everything from the first slash onward as an alternate-spelling annotation; and continue splitting only the text before the slash.
	- Split the cleaned string: first token → first_name, last token → last_name, remaining tokens → middle_name.
	- Add the following field to the data JSONB field:
		- title
		- i.e. {"title": "Rev"}

**Add mother mention**

	- If the mother field is not empty, add a mention for the mother:
		- Append .1 to the mention_id (e.g. AUG-SB-1.1).
		- Set full_name, first_name from the mother field.
		- Set gender to "F".
		- Set race to "B" and norm_race to "B".
		- Set legal_status to "E".
		- Apply normalization as described in @Normalize.md.
		- Add mention to mentions table.

**Add enslaver mention**

	- If owner_full_name is not empty, add a mention for the enslaver:
		- Append .2 to the mention_id (e.g. AUG-SB-1.2).
		- Set full_name from owner_full_name.
		- Set first_name, middle_name, and last_name from owner_full_name.
		- Set race to "W" and norm_race to "W".
		- Set legal_status to "H"
		- Apply normalization as described in @Normalize.md.
		- Add mention to mentions table.

**Add assertions**

	- This occurs after all mentions have been added to the mentions table.
	- If mother field is not empty:
		- Add assertion {
			subject: mother's mention_id
			predicate: "isParentOf"
			object: child's mention_id
			start_year: birth_year
			who: County+"-SB" i.e. "AUG-SB"
		}
	- If owner_full_name field is not empty:
		- Add assertion {
			subject: child's mention_id
			predicate: "wasEnslavedBy"
			object: enslaver's mention_id
			start_year: birth_year
			who: County+"-SB"
		}
	- If mother field is also present, add assertion {
			subject: mother's mention_id
			predicate: "wasEnslavedBy"
			object: enslaver's mention_id	
			start_year: birth_year
			who: County+"-SB"
		}
