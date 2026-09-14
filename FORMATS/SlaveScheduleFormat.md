---
name: SlaveScheduleFormat
description: Format instructions for SlaveScheduleFormat
---


**SLAVE SCHEDULE FORMAT**

	This file is a transcription of the US slave schedules for 1850 and 1860. 
	It is a table with 14 columns. 
	Each row represents an enslaved person or an enslaver, as noted in the status field.	
	There may be omissions, duplications, and errors in this data. 
	Some fields may not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row.
	Some columns may be blank {
		- line - A unique identifier for the row.
		- original_line - Line number from original census schedule.
		- district - The district of enumeration.
		- full_name - The full name of the person (names may be blank).
		- first_name - The first name of the person.
		- middle_name - The middle name of the person.
		- last_name - The last name of the person.
		- age - The age of the person.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- status - Role in schedule: "Owner" for the enslaver, "Slave" for the enslaved person.
		- enumerator - The enumerator mark or identifier.
		- enumerator_date - The date of enumeration.
	}

**Example rows**

	| line | original_line | district | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | status | enumerator | enumerator_date |
	| ---- | ------------- | -------- | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ------ | ---------- | --------------- |
	| 1 | 1 | 1 | Abraham Lavell | Abraham | | Lavell | | | | | Owner | - | 7.5 |
	| 2 | 2 | 1 | | | | | 54 | 1806 | F | | Slave | - | 7.5 |
	| 3 | 3 | 1 | | | | | 18 | 1842 | M | | Slave | - | 7.5 |
	| 4 | 4 | 1 | Jacob C Bosserman | Jacob | C | Bosserman | | | | | Owner | - | 7.5 |
	| 5 | 5 | 1 | | | | | 12 | 1848 | F | | Slave | - | 7.5 |
	| 6 | 6 | 1 | David S Young | David | S | Young | | | | | Owner | - | 7.5 |
	| 7 | 7 | 1 | | | | | 45 | 1815 | F | | Slave | - | 7.5 |
	| 8 | 8 | 1 | | | | | 8 | 1852 | F | | Slave | - | 7.5 |
	| 9 | 9 | 1 | | | | | 6 | 1854 | F | | Slave | - | 7.5 |

**Translation instructions**

	- source_year is set to 1850 or 1860.
	- Source is set to county-SS-source_year (i.e AUG-SS-1860)
	- The confidence field is set to 0.9.	
	- Apply the normalization as described in @Normalize.md.

**For each row in source**

	- Each row in source lists a person.
	- If the status field is "Owner" use the **Add enslaver mention** procedure.
	- Otherwise use the **Add enslaved mention** procedure.
	
**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-SS-1850-1, where  "AUG" is the county, "SS" is the source type, "1850" is the year and "1" is the line number from the line field in the row. 

	- Add the following fields to the data JSONB field:
		- enumerator
		- enumerator_date
		- i.e {"enumerator": "-", "enumerator_date": "7.5"}

**Add enslaver mention**

	- age, race, gender, and birth_year fields are ignored.
	- head is set to true.
	- race is set to "W".
	- norm_race is set to "W"
	- Set legal_status to "H"
	- The first_name, middle_name, and last_name fields are set, if there.
	- Create a household_id: "HS"+source_year+#, where # is the sequential number of the household mention, starting at 1. (i.e HS1850-4546)
	- Add mention to mentions table.
	- Set household_id in mention record and save in last_household_id variable
	
**Add enslaved mentions**

	- Set the legal_status field is set to "E".
	- head is set to NULL.
	- race is set to "B"
	- norm_race is set to "B"
	- Normalize race and gender according to @Normalize.md.
	- The first_name, middle_name, and last_name fields are set, if there.
	- Set age, race, gender, and birth_year fields.
	- Set household_id in mention record to last_household_id
	- Add mention to mentions table.
