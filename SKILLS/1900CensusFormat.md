---
name: 1900CensusFormat
description: Format instructions for 1900CensusFormat
---

**1900 CENSUS FORMAT**

	This file is a transcription of the US census for 1900 and is a table with 25 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - The line number on the original census sheet.
		- district - The post office of the enumeration district.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces.
		- first_name - The given name.
		- middle_name - The middle name or initials.
		- last_name - The surname.
		- age - The age of the person.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- relation - The relationship between the person and the head of household.
		- birth_place - State or country of birth.
		- arrival_date - Year of immigration/arrival.
		- birth_date - Month and year of birth.
		- fathers_birthplace - Father's state or country of birth.
		- marital - Marital status.
		- mothers_birthplace - Mother's state or country of birth.
		- number_of_children - Number of children born to mother.
		- number_of_living_children - Number of living children.
		- sheet - Census sheet number.
		- years_married - Number of years married.
		- head - "Y" if the person is the head of the household.
		}

**Example rows**

| line | original_line | district | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | relation | birth_place | arrival_date | birth_date | fathers_birthplace | marital | mothers_birthplace | number_of_children | number_of_living_children | sheet | years_married | head |
| ---- | ------------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | -------- | ----------- | ------------ | ---------- | ------------------ | ------- | ------------------ | ------------------ | ------------------------- | ----- | ------------- | ---- |
| 1 | 1 | ORL-1-115 | 1 | Jno H Robison | Jno | H | Robison | 51 | | M | W | Head | IN | | 1849 | OH | M | OH | | | 1 | 29 | Y |
| 2 | 2 | ORL-1-115 | 1 | Elisha A Robison | Elisha | A | Robison | 47 | | F | W | Wife | IN | | 1853 | IN | M | OH | 14 | 12 | 1 | 29 | |
| 3 | 3 | ORL-1-115 | 1 | Jas H Robison | Jas | H | Robison | 29 | | M | W | Son | IN | | 1871 | IN | M | OH | | | 1 | 5 | |
| 4 | 4 | ORL-1-115 | 1 | Matte Robison | Matte | | Robison | 26 | | F | W | Daughter-in-law | IN | | 1874 | IN | M | IN | 2 | 0 | 1 | 5 | |
| 5 | 5 | ORL-1-115 | 1 | Wm C Robison | Wm | C | Robison | 28 | | M | W | Son | IN | | 1872 | IN | S | OH | | | 1 | | |
| 6 | 6 | ORL-1-115 | 1 | Winnie M Robison | Winnie | M | Robison | 26 | | F | W | Daughter | IN | | 1874 | IN | M | OH | 3 | 3 | 1 | 7 | |
| 7 | 7 | ORL-1-115 | 1 | Frank M Robison | Frank | M | Robison | 24 | | M | W | Son | IN | | 1876 | IN | S | OH | | | 1 | | |
| 8 | 8 | ORL-1-115 | 1 | Maggie E Robison | Maggie | E | Robison | 23 | | F | W | Daughter | IN | | 1877 | IN | M | OH | 1 | 0 | 1 | 3 | |
| 9 | 9 | ORL-1-115 | 1 | Glenn M Robison | Glenn | M | Robison | 21 | | M | W | Son | IN | | 1879 | IN | S | OH | | | 1 | | |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The original_data field is set to the file's entire row as a JSONB object
	- The confidence field is set to 0.9.
	- Set household_id to null.
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as 1900-67.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head field to TRUE.	
	- Apply the normalization as described in @Normalize.md.
	- Add mention to mentions table

**Creating the mention_id**

	- The county for this source is "ORF".
	- The source type is "CN".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ORF-CN-1900-23, where  "ORF" is the county, "CN" is the source type, "1900" is the year and "23" is the line number from the line field in the row. 
	- If there is already an identical mention_id within this source append a number to it to differentiate it, like this for the first one: ORF-CN-1900-23.1, ORF-CN-1900-23.2 for the second, etc.

**Assertions**

	- This occurs after all mentions have been added to the mentions table
	- For each mention with the same family_id {
		- Identify the head of household as the person with the head field value of TRUE.
		- find the other mentions in the household with the same household_id and find predicate ignoring case {
			- If the relation field is "Wife" then predicate is isSpouseOf
			- If the relation field is "Son" then predicate is isChildOf
			- If the relation field is "Daughter" then predicate is isChildOf
			- If the relation field is "Brother" then predicate is isSiblingOf
			- If the relation field is "Sister" then predicate is isSiblingOf
			- If the relation field is "Father" then predicate is isParentOf
			- If the relation field is "Mother" then predicate is isParentOf
			- If the relation field is "Grandfather" then predicate is isGrandParentOf
			- If the relation field is "Grandmother" then predicate is isGrandParentOf
			- If the relation field is "Uncle" then predicate is isPiblingOf
			- If the relation field is "Aunt" then predicate is isPiblingOf
			- If the relation field is "Cousin" then predicate is isCousinOf
			- If the relation field is "Nephew" then predicate is isNiblingOf
			- If the relation field is "Niece" then predicate is isNiblingOf
			- If the relation field is "Son-in-law" then predicate is isChildInLawOf
			- If the relation field is "Daughter-in-law" then predicate is isChildInLawOf
			- If the relation field is "Brother-in-law" then predicate is isSiblingInLawOf
			- If the relation field is "Sister-in-law" then predicate is isSiblingInLawOf
			- If the relation field is "Father-in-law" then predicate is isParentInLawOf
			- If the relation field is "Mother-in-law" then predicate is isParentInLawOf
			- If the relation field is "Grandfather-in-law" then predicate is isGrandParentInLawOf
			- If the relation field is "Grandmother-in-law" then predicate is isGrandParentInLawOf
			- If the relation field is "Uncle-in-law" then predicate is isPiblingInLawOf
			- If the relation field is "Aunt-in-law" then predicate is isPiblingInLawOf
			- If the relation field is "Cousin-in-law" then predicate is isCousinInLawOf
			- If the relation field is "Nephew-in-law" then predicate is isNiblingInLawOf
			- If the relation field is "Niece-in-law" then predicate is isNiblingInLawOf	
			}
		- Create assertion row data {
			subject: relation person's mention_id
			predicate: predicate identified from relation field above
			object: head_mention_id
			who: "1900Census" 
			start_year: 1900
			end_year: ""	
			confidence: 0.9
			}
		- Add assertion to assertions table
	}
