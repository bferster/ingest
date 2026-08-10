---
name: 1870CensusFormat
description: Format instructions for 1870CensusFormat
---

**1870 CENSUS FORMAT**

	This file is a transcription of the US census for 1870 and is a table with 17 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	It is the first census to list non-white people by name. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row. 	
	- Some fields may be blank {
		- line - A unique identifier for the row.
		- district - The post office of the enumeration district.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces. 
		- first_name - The given name.
		- middle_name - The middle name or initial
		- last_name - The surname.
		- age - The age of the person in 1870.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- occupation - The work role of the person.
		- birth_place - Where the person was born.
		- re_value - The value of the person’s real estate owned.
		- pe_value - The value of the person’s personal property owned.
		- marry_month - Month they were married, if in that year.
		- school - Y if they attended school
		- read - "Y" if they can read
		- write - "Y" if they can write 
		- condition - Whether deaf and dumb, blind, insane, or idiotic.
		- m21- Male citizen of the U.S. of 21 years or older.
		- vote - Right to vote is denied or abridged on other grounds than rebellion or other crime.
		- head - "Y" if the person is the head of the household.
		}

**Example rows**

	| line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | occupation | birth_place | page | re_value | pe_value | head |
	| ---- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ---------- | ----------- | ---- | -------- | -------- | ---- |
	| 1    |          |          |        | Thomas Smith | Thomas  |             | Smith     | 55  | 1805       | M      | W    |            | VA          | 77   |          |          |      |
	| 2    |          |          |        | Lucy Smith  | Lucy     |             | Smith     | 55  | 1805       | F      | W    |            | VA          | 77   |          |          |      |
	| 3    |          |          |        | Mary Frances Smith | Mary | Frances  | Smith     | 23  | 1837       | F      | W    |            | VA          | 77   |          |          |      |
	| 4    |          |          |        | Nancy Elen Smith | Nancy | Elen      | Smith     | 21  | 1839       | F      | W    |            | VA          | 77   |          |          |      |
	| 5    |          |          |        | Martha Cornelia Smith | Martha | Cornelia | Smith| 20  | 1840       | F      | W    |            | VA          | 77   |          |          |      |
	| 6    |          |          |        | Lucy Agnus Smith | Lucy | Agnus       | Smith    | 17  | 1843       | F      | W    |            | VA          | 77   |          |          |      |
	| 7    |          |          |        | Benjamin Wilson | Benjamin |          | Wilson   | 25  | 1835       | M      | W    |            | VA          | 77   |          |          |      |
	| 8    |          |          |        | John Paris  | John      |             | Paris    | 40  | 1820       | M      | W    |            | VA          | 77   |          |          |      |
	| 9    |          |          |        | Nancy C Pari | Nancy    | C           | Paris    | 44  | 1816       | F      | W    |            | VA          | 77   |          |          |      |
	| 10   |          |          |        | Hannah Paris | Hannah   |             | Paris    | 75  | 1785       | F      | W    |            | VA          | 77   |          |          |      |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- Apply the normalization as described in @Normalize.md
	- Add mention to mentions table

**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-CN-1860-23, where  "ALB" is the county, "CN" is the source type, "1860" is the year and "23" is the line number from the line field in the row.


**After-processing in Google Sheets**

	*Copy from Ed*

	There is a spreadsheet with more or less the same information as the Main2 sheet in Sheet 2 of this spreadsheet.
    
	It has some data in columns I want to add the Main sheet in the following columns {
		dwelling
        district
        family
		occupation
    	}
    
	For each row in the main sheet {
		if trimmed full_name, age, race, and gender fields match in both sheets {
			- copy the district value that matches into the matching row's district column in the Main sheet.
			- copy the dwelling value that matches into the matching row's dwelling column in the Main sheet.
			- copy the family value that matches into the matching row's family column in the Main sheet.
			- copy the occupation value that matches into the matching row's occupation column in the Main sheet.
			}
		}

	Don't delete any rows, but match only the first 5000 rows in the Main sheet.

	





	for each row {
		 if district column == "Fisherville-2" and the family column is not NULL,
		 then add 3317 to the value in the family column 
		 if district column == ""Fisherville-2" and the dwelling column is not NULL,
		 then add 2771 to the value in the dwelling column 

		 }


*1800 Family/Dwelling*

	familyNum = 1;
	For each row {
		if (head == "Y") {
			copy familyNum to family and dwelling columns
			continue copying until the next head is found
			increment familyNum
			}
		}