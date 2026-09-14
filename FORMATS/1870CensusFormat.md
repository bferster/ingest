---
name: 1870CensusFormat
description: Format instructions for 1870CensusFormat
---

**1870 CENSUS FORMAT**

	This file is a transcription of the US census for 1870 and is a table with 18 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	It is the first census to list formerly-enslaved people by name. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - The line number on the original census sheet.
		- district - The post office or enumeration district.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces. 
		- first_name - The given name.
		- middle_name - The middle name or initial.
		- last_name - The surname.
		- age - The age of the person in 1870.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- occupation - The work role of the person.
		- birth_place - Where the person was born.
		- page - Census page number.
		- prop_value - The total value of real estate and personal property owned.
		- head - "Y" if the person is the head of the household.
		- ipums_id - The unique IPUMS identifier for the record. Can be blank.
		}

**Example rows**

| line | original_line | district | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | occupation | birth_place | page | prop_value | head | ipums_id |
| ---- | ------------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ---------- | ----------- | ---- | ---------- | ---- | -------- |
| 1 | 1 | DI-2 | 1 | Daniel Stover | Daniel | | Stover | 67 | 1803 | M | W | Carpenter | VA | 1 | 105 | Y | 24BF774B-B70A-4566-B77A-13FB5A887BAF |
| 2 | 2 | DI-2 | 1 | Amanda J Stover | Amanda | J | Stover | 28 | 1842 | F | W | No Occupation | VA | 1 | 0 | | DA7174AC-E3F6-4246-B40C-6CF46768066D |
| 3 | 3 | DI-2 | 1 | Virginia F Stover | Virginia | F | Stover | 22 | 1848 | F | W | No Occupation | VA | 1 | 0 | | 94DB9129-6B8A-4074-A7FE-277959D13826 |
| 4 | 4 | DI-2 | 1 | Martha A Stover | Martha | A | Stover | 14 | 1856 | F | W | Keeping House | VA | 1 | 0 | | 3391237B-57E0-46ED-9F77-E96A17D18F63 |
| 5 | 5 | DI-2 | 2 | Asberry M Hamrick | Asberry | M | Hamrick | 38 | 1832 | M | W | Farmer | VA | 1 | 0 | Y | EEF4F5CF-D8B2-44F0-BFAB-17572B11C9E9 |
| 6 | 6 | DI-2 | 2 | Magdalene Hamrick | Magdalene | | Hamrick | 29 | 1841 | F | W | | VA | 1 | 0 | | 1E1BFC22-9472-4A19-8D29-8475A61229FA |
| 7 | 7 | DI-2 | 2 | Redone B Hamrick | Redone | B | Hamrick | 2 | 1868 | M | W | | VA | 1 | 0 | | F75027F7-BD1C-4BFF-B408-622D61405A23 |
| 8 | 8 | DI-2 | 2 | Sarah F Hamrick | Sarah | F | Hamrick | 1 | 1869 | F | W | | VA | 1 | 0 | | D05E97C1-F3BB-4B7D-955B-CEA4E10339E5 |
| 9 | 9 | DI-2 | 3 | Joseph Fry | Joseph | | Fry | 65 | 1805 | M | W | Clock Maker | | 1 | 6000 | Y | 5B1108E3-795E-49D2-BD50-1F943806B5F1 |
| 10 | 10 | DI-2 | 4 | John H Wilbarger | John | H | Wilbarger | 27 | 1843 | M | W | Farm Laborer | VA | 1 | 0 | Y | 53F54368-8A60-4960-8AF9-06F33A1D9015 |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as FC1870-23.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head field to TRUE, else FALSE	
	- Apply the normalization as described in @Normalize.md
	- Add the following field to the data JSONB field:
		- prop_value
		- i.e {"prop_value": 6000}
	- Add mention to mentions table

**Creating the mention_id**

	- The county for this source is "AUG".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-CN-1870-23, where  "AUG" is the county, "CN" is the source type, "1870" is the year and "23" is the line number from the line field in the row. 
	- If there is already an identical mention_id within this source append a number to it to differentiate it, like this for the first one: AUG-CN-1870-23.1, AUG-CN-1870-23.2 for the second, etc.

**Assertions**
	- Do not create any assertions for this source
