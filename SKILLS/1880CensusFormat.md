---
name: 1880CensusFormat
description: Format instructions for 1880CensusFormat
---

**1880 CENSUS FORMAT**

	This file is a transcription of the US census for 1880 and is a table with 19 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- district - The post office of the enumeration district.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces. If there are only two words, the first is
		- last_name and the second is the last_name. If there is only one word, it is only the last_name.
		- first_name - The given name.
		- middle_name - The middle name or initials.
		- last_name - The surname.
		- first_name - The given name.
		- age - The age of the person in 1870.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- marital - The marital status.
		- relation - The relationship between the person and the head of household, whose relationship is labelled Self. 
		- occupation - The work role of the person.
		- head - "Y" if the person is the head of the household.
		- district - The district of the person
		- enumeration - The enumerator and enumerator date/data formatted as enumerator:enumerator_date
		}

**Example rows**

| line | original_line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | relation | occupation | birth_place | fathers_birthplace | marital_status | mothers_birthplace | person_number | sheet | head |
| ---- | ------------- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | -------- | ---------- | ----------- | ------------------ | -------------- | ------------------ | ------------- | ----- | ---- |
| 1 | 1 | BEV-11 | 1 | 1 | John Sullivan | John | | Sullivan | 38 | 1842 | M | W | Self | Constable | VA | Ireland | M | Ireland | 0 | 73 | Y |
| 2 | 2 | BEV-11 | 1 | 1 | S C Sullivan | S | C | Sullivan | 23 | 1857 | F | W | Wife | Keeps House | VA | Ireland | M | Ireland | 1 | 73 | |
| 3 | 3 | BEV-11 | 1 | 1 | Sarah E Sullivan | Sarah | E | Sullivan | 10 | 1870 | F | W | Daughter | At School | VA | VA | S | VA | 2 | 73 | |
| 4 | 4 | BEV-11 | 1 | 1 | Thomas T Sullivan | Thomas | T | Sullivan | 8 | 1872 | M | W | Son | At School | VA | VA | S | VA | 3 | 73 | |
| 5 | 5 | BEV-11 | 1 | 1 | Joseph M Sullivan | Joseph | M | Sullivan | 6 | 1874 | M | W | Son | At Home | VA | VA | S | VA | 4 | 73 | |
| 6 | 6 | BEV-11 | 1 | 1 | Mary L Sullivan | Mary | L | Sullivan | 4 | 1876 | F | W | Daughter | At Home | VA | VA | S | VA | 5 | 73 | |
| 7 | 7 | BEV-11 | 2 | 2 | A J Garber | A | J | Garber | 77 | 1803 | M | W | Self | At Home | VA | PA | M | PA | 0 | 73 | Y |
| 8 | 8 | BEV-11 | 2 | 2 | Mary J Garber | Mary | J | Garber | 68 | 1812 | F | W | Wife | Keeps House | PA | PA | M | PA | 1 | 73 | |
| 9 | 9 | BEV-11 | 2 | 2 | Martha A Baroldin | Martha | A | Baroldin | 36 | 1844 | F | W | Daughter | Keeps House | PA | VA | W | PA | 2 | 73 | |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The confidence field is set to 0.9.
	- Set household_id to null.
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as 1880-67.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head  field to TRUE.	
	- Apply the normalization as described in @Normalize.md.
	- Add mention to mentions table

**Creating the mention_id**

	- The county for this source is "ALB".
	- The source type is "CN".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-CN-1880-23, where  "ALB" is the county, "CN" is the source type, "1880" is the year and "23" is the line number from the line field in the row. 
	- If there is already an identical mention_id within this source append a number to it to differentiate it, like this for the first one: ALB-CN-1880-23.1, ALB-CN-1880-23.2 for the second, etc.

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
			who: "1880Census" 
			start_year: 1880
			end_year: ""	
			confidence: 0.9
			}
		- Add assertion to assertions table
	}
