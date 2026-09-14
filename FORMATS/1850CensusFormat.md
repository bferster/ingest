---
name: 1850CensusFormat
description: Format instructions for 1850CensusFormat
---

**1850 CENSUS FORMAT**

	This file is a transcription of the US census for 1850 and is a table with 19 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - Line number from original census record.
		- district - The post office or enumeration district.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces. 
		- first_name - The given name.
		- middle_name - The middle name or initial.
		- last_name - The surname.
		- age - The age of the person in 1850.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- birth_place - Where the person was born.
		- head - "Y" if the person is the head of the household.
		- prop_value - The total value of real estate property owned.
		- enumerator - The enumerator identifier.
		- enumerator_date - The date of enumeration.
		- ipums_id - The unique IPUMS identifier for the record. Can be blank.
		}

**Example rows**

| line | original_line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | birth_place | head | prop_value | enumerator | enumerator_date | ipums_id |
| ---- | ------------- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ----------- | ---- | ---------- | ---------- | --------------- | -------- |
| 1 | 1 | 2 | 1 | 1 | James Foster | James | | Foster | 30 | 1820 | M | W | VA | Y | 0 | DP | 6.4 | 9571CC83-2A9A-4818-A827-D20D2FA8B934 |
| 2 | 2 | 2 | 1 | 1 | Mary Foster | Mary | | Foster | 18 | 1832 | F | W | VA | | 0 | DP | 6.4 | 957E68D4-8787-46E9-B1EC-A82F933AC736 |
| 3 | 3 | 2 | 2 | 2 | John Stover | John | | Stover | 46 | 1804 | M | W | VA | Y | 0 | DP | 6.4 | F7B8A1A5-BCCD-4E43-8D36-3EACC0B4B31A |
| 4 | 4 | 2 | 2 | 2 | Jacob Stover | Jacob | | Stover | 12 | 1838 | M | W | VA | | 0 | DP | 6.4 | 1932F4AE-93C2-43DB-977D-BAE72D4F9B6C |
| 5 | 5 | 2 | 2 | 2 | John W Stover | John | W | Stover | 10 | 1840 | M | W | VA | | 0 | DP | 6.4 | 0EFDC7D0-6AE3-474C-AC9C-F5CB666F20FB |
| 6 | 6 | 2 | 2 | 2 | Daniel Stover | Daniel | | Stover | 5 | 1845 | M | W | VA | | 0 | DP | 6.4 | 934CE711-DCE8-4FFF-AD66-2A344FA97A92 |
| 7 | 7 | 2 | 2 | 2 | Mary Stover | Mary | | Stover | 35 | 1815 | F | W | VA | | 0 | DP | 6.4 | 8ADF7846-06D0-4220-A95F-2693489BF9A6 |
| 8 | 8 | 2 | 2 | 2 | Margart Stover | Margart | | Stover | 15 | 1835 | F | W | VA | | 0 | DP | 6.4 | 6FE7FAC4-C1A2-4F2B-B25F-63BAD956CA1D |
| 9 | 9 | 2 | 2 | 2 | Sarah A Stover | Sarah | A | Stover | 14 | 1836 | F | W | VA | | 0 | DP | 6.4 | D85353CB-E9D9-4B78-BB3E-13F05F7A8CAA |
| 10 | 10 | 2 | 2 | 2 | Eda Stover | Eda | | Stover | 8 | 1842 | F | W | VA | | 0 | DP | 6.4 | 024C3AC3-8F0A-4A18-8AAA-BE7AAB896339 |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- Apply the normalization as described in @Normalize.md
	- If a new family is detected, i.e. the family number is different from the previous row {
		create a new id using the year and the family number, such as FC1850-23.
		set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head field to TRUE, else FALSE	
	- Add the following field to the data JSONB field:
		- prop_value
		- enumerator
		- enumerator_date
		- i.e {"prop_value": 6000, "enumerator": "JL", "enumerator_date": "6.23"}

	- Add mention to mentions table

**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-CN-1850-23, where  "AUG" is the county, "CN" is the source type, "1850" is the year and "23" is the line number from the line field in the row.
				
**Assertions**

	- Do not create any assertions for this source

