---
name: 1860CensusFormat
description: Format instructions for 1860CensusFormat
---

**1860 CENSUS FORMAT**

	This file is a transcription of the US census for 1860 and is a table with 18 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - Line number on original census sheet.
		- district - The post office or enumeration district.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces. 
		- first_name - The given name.
		- middle_name - The middle name or initial.
		- last_name - The surname.
		- age - The age of the person in 1860.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- birth_place - State, territory, or country of birth.
		- page - Page number in census book.
		- head - "Y" if the person is the head of the household.
		- enumerator - The enumerator identifier.
		- enumerator_date - The date of enumeration.
		- ipums_id - The unique IPUMS identifier for the record. Can be blank.
		}

**Example rows**

| line | original_line | district | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | birth_place | page | head | enumerator | enumerator_date | ipums_id |
| ---- | ------------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ----------- | ---- | ---- | ---------- | --------------- | -------- |
| 1 | 1 | 1 | 1 | Thomas Smith | Thomas | | Smith | 55 | 1805 | M | W | VA | 77 | Y | - | 7.3 | 30B325B3-8736-4F20-9525-E30D9C9C1D62 |
| 2 | 2 | 1 | 1 | Lucy Smith | Lucy | | Smith | 55 | 1805 | F | W | VA | 77 | | - | 7.3 | C2FAE859-C342-454B-83DE-2259CD6739F9 |
| 3 | 3 | 1 | 1 | Mary Frances Smith | Mary | Frances | Smith | 23 | 1837 | F | W | VA | 77 | | - | 7.3 | AC5D66DB-DED6-4485-A4CC-E46C176FFCDF |
| 4 | 4 | 1 | 1 | Nancy Elen Smith | Nancy | Elen | Smith | 21 | 1839 | F | W | VA | 77 | | - | 7.3 | E267AFA2-121B-4103-BC39-1C3AC1C25C46 |
| 5 | 5 | 1 | 1 | Martha Cornelia Smith | Martha | Cornelia | Smith | 20 | 1840 | F | W | VA | 77 | | - | 7.3 | 7179CD5D-3CD1-451F-86A4-80A20D70EAF4 |
| 6 | 6 | 1 | 1 | Lucy Agnus Smith | Lucy | Agnus | Smith | 17 | 1843 | F | W | VA | 77 | | - | 7.3 | 70C848CA-92BC-4F68-88A8-F3918CE81073 |
| 7 | 7 | 1 | 2 | Benjamin Wilson | Benjamin | | Wilson | 25 | 1835 | M | W | VA | 77 | Y | - | 7.3 | A723D9FD-BF65-4942-AE93-C42792B56E50 |
| 8 | 8 | 1 | 3 | John Paris | John | | Paris | 40 | 1820 | M | W | VA | 77 | Y | - | 7.3 | 5CAFFDBD-50ED-4FDC-8253-DE3E96274CAF |
| 9 | 9 | 1 | 3 | Nancy C Paris | Nancy | C | Paris | 44 | 1816 | F | W | VA | 77 | | - | 7.3 | 012568C0-320B-42CB-80ED-9C38A3CFF501 |
| 10 | 10 | 1 | 3 | Hannah Paris | Hannah | | Paris | 75 | 1785 | F | W | VA | 77 | | - | 7.3 | EC48A942-0435-4321-AAEE-881E1931008A |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as FC1860-23.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head field to TRUE, else FALSE	
	- Apply the normalization as described in @Normalize.md
	- Add the following field to the data JSONB field:
		- enumerator
		- enumerator_date
		- i.e {"enumerator": "JL", "enumerator_date": "6.23"}

	- Add mention to mentions table

**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-CN-1860-23, where  "AUG" is the county, "CN" is the source type, "1860" is the year and "23" is the line number from the line field in the row.

**Assertions**
	- Do not create any assertions for this source



