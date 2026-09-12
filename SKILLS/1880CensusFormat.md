---
name: 1880CensusFormat
description: Format instructions for 1880CensusFormat
---

**1880 CENSUS FORMAT**

	This file is a transcription of the US census for 1880 and is a table with 23 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - The line number on the original census sheet.
		- district - The post office or enumeration district.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces.
		- first_name - The given name.
		- middle_name - The middle name or initials.
		- last_name - The surname.
		- age - The age of the person in 1880.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- relation - The relationship between the person and the head of household, whose relationship is labelled Self.
		- occupation - The work role of the person.
		- birth_place - State, territory, or country of birth.
		- fathers_birthplace - Father's state, territory, or country of birth.
		- marital_status - The marital status (e.g., M for married, S for single, W for widowed).
		- mothers_birthplace - Mother's state, territory, or country of birth.
		- person_num - The person number within the household/family.
		- sheet - Census sheet number.
		- head - "Y" if the person is the head of the household.
		- ipums_id - The unique IPUMS identifier for the record. Can be blank.
		}

**Example rows**

| line | original_line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | relation | occupation | birth_place | fathers_birthplace | marital_status | mothers_birthplace | person_num | sheet | head | ipums_id |
| ---- | ------------- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | -------- | ---------- | ----------- | ------------------ | -------------- | ------------------ | ---------- | ----- | ---- | -------- |
| 1 | 1 | BEV-11 | 1 | 1 | John Sullivan | John | | Sullivan | 38 | 1842 | M | W | Self | Constable | VA | Ireland | M | Ireland | 0 | 73 | Y | 2E9A5D62-1D5E-435A-B585-636DD5030333 |
| 2 | 2 | BEV-11 | 1 | 1 | S C Sullivan | S | C | Sullivan | 23 | 1857 | F | W | Wife | Keeps House | VA | Ireland | M | Ireland | 1 | 73 | | E5C888DB-5944-4E9E-BA91-27E92B022DE9 |
| 3 | 3 | BEV-11 | 1 | 1 | Sarah E Sullivan | Sarah | E | Sullivan | 10 | 1870 | F | W | Daughter | At School | VA | VA | S | VA | 2 | 73 | | 54178430-4067-41D8-94AC-3D00D2831C92 |
| 4 | 4 | BEV-11 | 1 | 1 | Thomas T Sullivan | Thomas | T | Sullivan | 8 | 1872 | M | W | Son | At School | VA | VA | S | VA | 3 | 73 | | 56105034-890F-40DA-8F9F-14CD0047C8F2 |
| 5 | 5 | BEV-11 | 1 | 1 | Joseph M Sullivan | Joseph | M | Sullivan | 6 | 1874 | M | W | Son | At Home | VA | VA | S | VA | 4 | 73 | | 35B336D1-39AF-43D9-BFB7-95FCD4375E2A |
| 6 | 6 | BEV-11 | 1 | 1 | Mary L Sullivan | Mary | L | Sullivan | 4 | 1876 | F | W | Daughter | At Home | VA | VA | S | VA | 5 | 73 | | 0D2994D5-D4BF-43D0-BCDF-43E80C69D60F |
| 7 | 7 | BEV-11 | 2 | 2 | A J Garber | A | J | Garber | 77 | 1803 | M | W | Self | At Home | VA | PA | M | PA | 0 | 73 | Y | 5880951B-DD2F-40ED-8BD7-4A5976C4F178 |
| 8 | 8 | BEV-11 | 2 | 2 | Mary J Garber | Mary | J | Garber | 68 | 1812 | F | W | Wife | Keeps House | PA | PA | M | PA | 1 | 73 | | 0215221E-1738-4581-BD2C-A91FF70A450C |
| 9 | 9 | BEV-11 | 2 | 2 | Martha A Baroldin | Martha | A | Baroldin | 36 | 1844 | F | W | Daughter | Keeps House | PA | VA | W | PA | 2 | 73 | | 719CF34C-DCFC-4EAA-B0E0-A5CC57029CDF |
| 10 | 10 | BEV-11 | 2 | 2 | Susan Bowls | Susan | | Bowls | 23 | 1857 | F | B | Other | Servant | VA | VA | S | VA | 3 | 73 | | 875BC028-FD5C-4EA8-9EF8-60A3577191BA |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The confidence field is set to 0.9.
	- Set household_id to null.
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as FC1880-67.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head  field to TRUE, else FALSE.	
	- Apply the normalization as described in @Normalize.md.
	- Add the following fields to the data JSONB field:
		- fathers_birthplace
		- mothers_birthplace
		- i.e {"fathers_birthplace": "VA", "mothers_birthplace": "VA"}
	- Add mention to mentions table

**Creating the mention_id**

	- The county for this source is "AUG".
	- The source type is "CN".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-CN-1880-23, where  "AUG" is the county, "CN" is the source type, "1880" is the year and "23" is the line number from the line field in the row. 

**Add family Assertions**

	- This occurs after all mentions have been added to the mentions table
	- For each mention with the same family_id {
		- Identify the head of household as the person with the head field value of TRUE.
		- find the other mentions with the same family_id
			- If the relation field is "Brother" then predicate is isSiblingOf
			- If the relation field is "Sister" then predicate is isSiblingOf
			- If the relation field is "Wife" then predicate is isSpouseOf
			- If the relation field is "Husband" then predicate is isSpouseOf
			- If the relation field is "Father" then predicate is isParentOf
			- If the relation field is "Mother" then predicate is isParentOf
			- If the relation field is "Stepfather" then predicate is isStepParentOf
			- If the relation field is "Stepmother" then predicate is isStepParentOf
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
			- If the relation field is not found above then skip it	
			}
		- Create assertion row data {
			subject: relation person's mention_id
			predicate: predicate identified from relation field above
			object: head_mention_id
			who: "1880Census" 
			start_year: 1880
			end_year: NULL	
			confidence: 0.9
			}
		- Add assertion to assertions table
	
** Add children assertions**

	- Identify the head: the mention with head = TRUE.
	- Identify the spouse: the mention in the same family_id with relation "Wife"
	  (or "Husband"). May be absent.

	- For each mention in the same family_id whose relation field is a child value {

		- Map relation to predicate:
			- "Son", "Daughter"                     -> isChildOf
			- "Stepson", "Stepdaughter"             -> isStepChildOf
			- "Adopted Son", "Adopted Daughter"     -> isAdoptedChildOf
			- any other unrecognized value          -> write nothing, log it

		- Create the assertion to the head {
			subject: child's mention_id
			predicate: mapped predicate
			object: head_mention_id
			who: "1880Census"
			start_year: 1880
			end_year: NULL
			confidence: 0.9
		}

	- If a spouse exists AND the predicate is isChildOf {
				- Compute gap = child birth_year - spouse birth_year (if both present)
				- Set confidence:
					- gap >= 15                 -> 0.7
					- gap 10 to 14              -> 0.5
					- gap < 10, or gap missing  -> 0.3
				- Create a second assertion {
					subject: child's mention_id
					predicate: isChildOf
					object: spouse_mention_id
					who: "1880Census-inferred"
					start_year: 1880
					end_year: NULL
					confidence: the value set above
				}
			}

		- If the predicate is isStepChildOf AND a spouse exists {
			- The head's spouse is likely the biological parent.
			- Create an assertion {
				subject: child's mention_id
				predicate: isChildOf
				object: spouse_mention_id
				who: "1880Census-inferred"
				start_year: 1880
				end_year: NULL
				confidence: 0.6
			}
		}
	}