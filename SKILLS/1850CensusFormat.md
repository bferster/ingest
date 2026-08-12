---
name: 1850CensusFormat
description: Format instructions for 1850CensusFormat
---

**1850 CENSUS FORMAT**

	This file is a transcription of the US census for 1850 and is a table with 14 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	It is the first census to list non-white people by name. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row. 	
	- Some fields may be blank {
		- line - A unique identifier for the row.
		- original_line - Line number from original census record.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces. 
		- first_name - The given name.
		- middle_name - The middle name or initial
		- last_name - The surname.
		- age - The age of the person in 1850.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- birth_place - Where the person was born.
		- head - "Y" if the person is the head of the household.
		}

**Example rows**

| line | original_line | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | birth_place | head |
| ---- | ------------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ----------- | ---- |
| 1    | 1             | 377      | 427    | Thomas Smith | Thomas  |             | Smith     | 45  | 1805       | M      | W    | VA          | Y    |
| 2    | 2             | 377      | 427    | Lucy Smith  | Lucy     |             | Smith     | 45  | 1805       | F      | W    | VA          |      |
| 3    | 3             | 377      | 427    | Mary Frances Smith | Mary | Frances  | Smith     | 13  | 1837       | F      | W    | VA          |      |
| 4    | 4             | 377      | 427    | Nancy Elen Smith | Nancy | Elen      | Smith     | 11  | 1839       | F      | W    | VA          |      |
| 5    | 5             | 377      | 427    | Martha Cornelia Smith | Martha | Cornelia | Smith| 10  | 1840       | F      | W    | VA          |      |
| 6    | 6             | 377      | 427    | Lucy Agnus Smith | Lucy | Agnus       | Smith    | 7   | 1843       | F      | W    | VA          |      |
| 7    | 7             | 378      | 428    | Benjamin Wilson | Benjamin |          | Wilson   | 15  | 1835       | M      | W    | VA          | Y    |
| 8    | 8             | 379      | 429    | John Paris  | John      |             | Paris    | 30  | 1820       | M      | W    | VA          | Y    |
| 9    | 9             | 379      | 429    | Nancy C Paris | Nancy   | C           | Paris    | 34  | 1816       | F      | W    | VA          |      |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- Apply the normalization as described in @Normalize.md
	- Add mention to mentions table

**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-CN-1850-23, where  "ALB" is the county, "CN" is the source type, "1850" is the year and "23" is the line number from the line field in the row.

**Assertions**

	- Do not create any assertions for this source

