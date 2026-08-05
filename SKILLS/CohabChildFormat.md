---
name: CohabChildFormat
description: Format instructions for CohabChildFormat
---
`
**Child Cohabitation Format**

	This file contains records of children of enslaved people and father.
	It is a table with 7 columns. 
	There may be omissions, duplications, and errors in this data.
	Some fields may be not be present in table.

**Field names and descriptions**
	
	The following columns represent information about the person in a row. 
	Some columns may be blank { 
		line - A unique identifier for the row
		family - Family number
		first_name - The child's first name
		age - The child's age
		birth_year - The year the child was born
		father_first_name - The child's father's first name
		father_last_name - The child's father's last name
		}

**Example rows**

| line | family | first_name | age | birth_year | father_first_name | father_last_name |
|------|--------|------------|-----|------------|-------------------|------------------| 
| 1	   | 12     | Wm Henry   | 2   | 1864       | Henry             | Bird             |
| 2	   | 13     | Nancy      | 5   | 1861       | Ausellers         | Gibson           |
| 3	   | 13     | Magaureh   | 3   | 1863       | Ausellers         | Gibson           |
| 4	   | 15     | Elizabeth E | 23 | 1843       | Joshua            | Brofan           |


**Translation instructions**

	- The source_year field is set to 1866.
	- Set legal_status to NULL.
	`- The original_data field is set to the entire row as a JSONB object.
	- Set confidence to 0.95.
	- Create mention_id for each row: ALB-CC-1, where "ALB" is the county, "CC" is the source type, "1" is the line number from the line field in the row. 
	- Set race to "B" and norm_race to "B".
	- Add only field specified. Do not infer any other fields.	

**Add child mention**

	- Set full_name and first_name from the first_name field.
	- Set birth_year from the birth_year column (or computed from age).
	- Add mention_id.
	- Apply normalization as described in @Normalize.md.
	- Add mention to mentions table.

**Add father mention**

	- If the father_first_name and father_last_name fields in original_data are not empty, add a mention for the father:
		- Append .1 to the mention_id (e.g. AUG-CC-1.1).
		- Set full_name, first_name from the father_first_name and father_last_name fields.
		- Set gender to "M".
		- Apply normalization as described in @Normalize.md.
		- Add mention to mentions table.


**Add assertion**

	- This occurs after all mentions have been added to the mentions table.
	- If father_first_name and father_last_name fields in original_data are not empty:
		- Add assertion {
			subject: father's mention_id
			predicate: "isParentOf"
			object: child's mention_id
			start_year: 1866
			who: County+"-CC" i.e. "AUG-CC"
		}
