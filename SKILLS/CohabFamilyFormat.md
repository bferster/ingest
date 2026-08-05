---
name: CohabChildFormat
description: Format instructions for CohabChildFormat
---
`
**Child Cohabitation Format**

	This file contains records of children of formerly enslaved people and their parents.
	It is a table with 16 columns. 
	There may be omissions, duplications, and errors in this data.
	Some fields may be not be present in table.

**Field names and descriptions**
	
	The following columns represent information about the person in a row. 
	Some columns may be blank { 
		line - A unique identifier for the row
		family - Family number
		residence - The residence of the family	
		husband_first_name - The husband's first name
		husband_middle_name - The husband's middle name
		husband_last_name - The husband's last name
		wife_first_name - The wife's first name
		wife_middle_name - The wife's middle name
		wife_last_name - The wife's last name
		husband_birth_year - The year the husband was born
		wife_birth_year - The year the wife was born
		husband_birth_place - The place the husband was born
		wife_birth_place - The place the wife was born
		husband_occupation - The occupation of the husband
		number_of_children - The number of children	
		original_remarks - Any remarks from the original source
		}

**Example rows**
| line | family | residence | husband_first_name | husband_middle_name | husband_last_name | wife_first_name | wife_middle_name | wife_last_name | husband_birth_year | wife_birth_year | husband_birthplace | wife_birthplace | husband_occupation | number_of_children | original_remarks |
|------|--------|-----------|--------------------|---------------------|-------------------|-----------------|------------------|----------------|--------------------|-----------------|--------------------|-----------------|--------------------|--------------------|------------------|
| 1    | 2      |           | Henry              |                     | Taylor            | Jennie          |                  | Erdew          |                    |                 |                    |                 |                    |                    |                  |  
| 2    | 175    | Staunton  | Cato               |                     | Boyd              | Nanneral        |                  | Crawford       | 1826               | 1843            | Augusta Co., VA    | Augusta Co., VA | Laborer            | 4                  |                  |  
| 3    | 13     |           | Ausellers          |                     | Gibson            | Eliza           |                  | How            | 1827               | 1823            | Rockingham Co., VA | Fauquier Co., VA | Farmer & Laborer  | 2	                 | 2 girls, Nancy ag 5, Magaureh ag 3 |
| 4    | 15     |           | Joshua             |                     | Brojan            | Sarah           |                  | Spencer        | 1821               |                 | Rockingham Co., VA | Shenandoah Co., VA | Farmer & Laborer | 2                 | 2 girls, Elizabeth E. 23, Ann Eliza | 
| 5    | 16     |           | Stephen            |                     |                   | Geneffar        |                  |                | 1810               |                 | Nelson Co., VA     | Nelson Co., VA     | Farmer & Laborer | 6                 | Boy              |  


**Translation instructions**

	- The source_year field is set to 1866.
	- Set legal_status to NULL.
	- The original_data field is set to the entire row as a JSONB object.
	- Set confidence to 0.95.
	- Create mention_id for each row: ALB-CF-1, where "ALB" is the county, "CF" is the source type, "1" is the line number from the line field in the row. 
	- Set race to "B" and norm_race to "B".
	- Add only field specified. Do not infer any other fields.	

**Add husband mention**

	- Set full_name and first_name middle_name last_name from the husband name fields.
	- Set gender to "M".
	- Set birth_year from the husband_birth_year column.
	- Set birth_place from the husband_birth_place column.
	- Set occupation from the husband_occupation column.	
	- Add mention_id.
	- Apply normalization as described in @Normalize.md.
	- Add mention to mentions table.

**Add wife mention**

	- Set full_name and first_name middle_name last_name from the wife name fields.
	- Set gender to "F".
	- Append .1 to the mention_id (e.g. ALB-CF-1.1).
	- Set birth_year from the wife_birth_year column.
	- Set birth_place from the wife_birth_place column.	
	- Add mention_id.
	- Apply normalization as described in @Normalize.md.
	- Add mention to mentions table.

**Add assertion**

	- This occurs after all mentions have been added to the mentions table.
	- Add assertion {
		subject: husband's mention_id
		predicate: "isSpouseOf"
		object: wife's mention_id	
		start_year: 1866
		who: County+"-CF" i.e. "AUG-CF"
	}
