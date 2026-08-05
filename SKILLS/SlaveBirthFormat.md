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
		comments - Any comments about the birth
	}

**Example rows**

| line | birth_year | name | gender | birth_place | owner_full_name | mother | reported_by |
|------|------------|------|--------|-------------|-----------------|--------|-------------| 
| 1	   | 1853	    | Nancy | F	| near Poor House | William Young |      | Owner       |
| 2	   | 1853	    | Alexander| M	| Centreville | Augustus Staubus | Malinda | Owner     |
| 3	   | 1853	    | Cora     | F	| Churchville | Henry Sterrett  | Fanny  | Owner       |
| 4	   | 1853	    | Catherine| F	| Near Dutch Church | William Cameron |  | Owner       |
| 5	   | 1853	    | Julia    | F  | Mt. Sidney  | George A. Bruce | Milley | Owner       |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source_year field is set to the value of the birth_year column.
	- The original_data field is set to the entire row as a JSONB object.
	- Set confidence to 0.95.
	- Create mention_id for each row: ALB-SB-1, where "ALB" is the county, "SB" is the source type, "1" is the line number from the line field in the row. 
	- Add only field specified. Do not infer any other fields.	

**Add enslaved child mention**

	- Set legal_status to "E".
	- Set race to "B" and norm_race to "B".
	- Set full_name and first_name from the name field.
	- Set birth_year, gender, and birth_place from the corresponding columns.
	- Add mention_id.
	- Apply normalization as described in @Normalize.md.
	- Add mention to mentions table.

**Add mother mention**

	- If the mother field in original_data is not empty, add a mention for the mother:
		- Append .1 to the mention_id (e.g. AUG-SB-1.1).
		- Set full_name, first_name from the mother field.
		- Set gender to "F".
		- Set race to "B" and norm_race to "B".
		- Set legal_status to "E".
		- Apply normalization as described in @Normalize.md.
		- Add mention to mentions table.

**Add enslaver mention**

	- If owner_full_name is not empty, add a mention for the enslaver:
		- Append .2 to the mention_id (e.g. ALB-SB-1.2).
		- Set full_name from owner_full_name.
		- Set first_name, middle_name, and last_name from owner_full_name.
		- Set race to "W" and norm_race to "W".
		- Set legal_status to NULL.
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
