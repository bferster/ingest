---
name: SlaveScheduleFormat
description: Format instructions for SlaveScheduleFormat
---


**SLAVE SCHEDULE FORMAT**

	This file is a transcription of the US slave schedules for 1850 and 1860. 
	It is a table with 10 columns. 
	Each row represents an enslaved person or an enslaver, as noted in the status field.	
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Ingested field names and descriptions:**
	
	- line - A unique identifier for the row
	- full_name - The full name of the person (names may be blank).
	- first_name - The first name of the person.
	- middle_name - The middle name of the person.
	- last_name - The last name of the person.  
	- age - The age of the person in 1870
	- birth_year - The year the person was born. May be inaccurate +/- 5 years
	- gender - The sex of the person. Can be F for female or M for male
	- race - The race of the person. B, W, M, I, C or Y
	- status - The name of the enslaver of the person : if this value is "Y" it means that this row is an enslaver.
	
**Example rows to ingest**


	|line | full_name | age |birth_year |gender |race | owner |
	|-----|-----------|-----|-----------|-------|-----|-------|
	|  1  | John Taylor |   |           |       |     | Y     | 
	|  2  |   	       | 36 | 1814      | M     | B   |       |
	|  3  |            | 25 | 1825      | M     | M   |       |
	|  4  |            | 16 | 1834      | M     | B   |       |
	|  5  |            | 14 | 1836      | M     | B   |       |
	|  6  |            | 7  | 1843      | M     | B   |       |
	|  7  |            | 0  | 1850      | M     | B   |       |
	|  8  |            | 40 | 1810      | M     | B   |       |

**Translation instructions**

	- The source_year field is set to 1850 or 1860.
	- Source is set to county-SS-source_year (i.e ALB-SS-1860)
	- The original_data field is set to the entire row as a JSONB object.
	- The confidence field is set to 0.9.	
	- Apply the normalization as described in @Normalize.md.

**For each row in source**

	- Each row in source lists a person.
	= if the the status field is "Owner" use the **Add enslaver mention** procedure.
	= Otherwise use the **Add enslaved mention* procedure.
	
**Creating the mention_id**

	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-SS-1850-1, where  "ALB" is the county, "SS" is the source type, "1850" is the year and "1" is the line number from the line field in the row. 

**Add enslaver mention**

	- age, race, gender, and birth_year fields are ignored.
	- head is set to true.
	- race is set to "W".
	- norm_race is set to "W"
	- Set the legal_status field is set to NULL.
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
