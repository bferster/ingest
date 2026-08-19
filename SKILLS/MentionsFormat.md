---
name: Mentions Format
description: Format instructions for Mentions
---

	Sources, such as censuses, slave schedules, church records, etc., that had been saved as tables, are curated and ingested into the model. 
	No mention or assertion in the system exists without an unbroken chain back to the document it originally is referenced from. 
	The data loaded from these is not directly referenced in further steps, but is mediated through the MENTIONS table detailed below and applied to every source document.
	Each time a person is identified in a primary source, whether by name or some other description, a record of that person is added to the system as a mention. 
	A mention merely notes the identification of an individual in a primary source, with no claims about who it may actually be, or their relationship to any other person or organization. 
	
	Mentions are the atomic units that the Verité system is built upon. 
	They contain all the information available about that person, such as names, ages, gender, race, etc. 
	Some mentions may not even have any name associated with them at all. 
	This information is normalized, so we can later compare “apples with apples.” 

	Mentions provide the link between the raw data found in the various records and the ability to infer relationships between them. 
	The original records are never altered, simply copied verbatim into the MENTIONS table.
	Mentions are the atomic units of the entire Verité identity resolution system. 
	They connect people with evidence. 
	The original row data from the source in the ingest step is added, but only the mentions are the only references to the original source going forward.
	There is at least one mention for every row in a source: the person that is referenced in a census line, Freedman's Bureau entry, vital record, or church register and becomes exactly one mention. 
	If a row identifies more than one person, each person is added as their own mention entry in the table, and referenced by appending the id with a .1, .2, etc. 

**MENTIONS FORMAT**

	This file is a compilation of the mentions of people in the county records. 
	Each row represents a mention
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row {
		- mention_id - A unique identifier for the row
		- source - The identifier of the source of the mention
		- source_year - The year of the source
		- original_data - The original data of the mention
		- confidence - The confidence of the mention
		- full_name - The full name of the person
		- first_name - The first name of the person
		- middle_name - The middle name of the person
		- last_name - The last name of the person
		- birth_year - The birth year of the person
		- birth_place - The birth place of the person
		- death_year - The death year of the person
		- race - The race of the person
		- gender - The gender of the person
		- occupation - The occupation of the person
		- legal_status - The legal status of the person
		- norm_first_name - The normalized first name of the person
		- nysiis_last_name - The NYSIIS last name of the person
		- norm_race - The normalized race of the person
		- norm_occupation - The normalized occupation of the person
		- head - The head of the household
		- household_id - The household ID of the person
		- family_id - The family ID of the person
		- metaphone_last_name - The metaphone last name of the person
		- end_year - The end year of the assertion
		- who - The who of the assertion
		- confidence - The confidence of the assertion
		}

**Example rows**

| mention_id   | source | source_year | original_data                                                                                                                                                         | confidence | full_name       | first_name | middle_name | last_name | birth_year | birth_place | death_year | race | gender | occupation | legal_status | norm_first_name | nysiis_last_name | norm_race | norm_occupation | head | household_id | family_id | metaphone_last_name |
|--------------|--------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-----------------|------------|-------------|-----------|------------|-------------|------------|------|--------|------------|--------------|-----------------|------------------|-----------|-----------------|------|--------------|-----------|---------------------|
| AUG-CC-200   | AUG-CC | 1866        | {"age": "8", "line": "200", "family": "96", "birth_year": "1858", "first_name": "Ransom", "father_last_name": "Ceasar", "father_first_name": "Oliver"} | 0.95       | Ransom          | Ransom     |             |           | 1858       |             |            | B    |        |            |              | RANSOM          |                  | B         |                 | f    |              | FC1866-96 |                     |
| AUG-CC-201   | AUG-CC | 1866        | {"age": "25", "line": "201", "family": "99", "birth_year": "1841", "first_name": "Ann", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Ann             | Ann        |             |           | 1841       |             |            | B    |        |            |              | ANN             |                  | B         |                 | f    |              | FC1866-99 |                     |
| AUG-CC-202   | AUG-CC | 1866        | {"age": "27", "line": "202", "family": "99", "birth_year": "1839", "first_name": "Mary", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Mary            | Mary       |             |           | 1839       |             |            | B    |        |            |              | MARY            |                  | B         |                 | f    |              | FC1866-99 |                     |
| AUG-CC-203   | AUG-CC | 1866        | {"age": "5", "line": "203", "family": "99", "birth_year": "1861", "first_name": "Alice", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Alice           | Alice      |             |           | 1861       |             |            | B    |        |            |              | ALICE           |                  | B         |                 | f    |              | FC1866-99 |                     |
| AUG-CC-204   | AUG-CC | 1866        | {"age": "6", "line": "204", "family": "99", "birth_year": "1860", "first_name": "Betty", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Betty           | Betty      |             |           | 1860       |             |            | B    |        |            |              | ELIZABETH       |                  | B         |                 | f    |              | FC1866-99 |                     |
| AUG-SB-238.2 | AUG-SB | 1853        | {"line": "238", "name": "Wayt", "gender": "M", "mother": "Cynthia", "birth_year": "1855", "birth_place": "Waynesboro", "reported_by": "Owner", "owner_full_name": "William Chapman"} | 0.95       | William Chapman | William    |             | Chapman   |            |             |            | W    |        |            |              | WILLIAM         | CAPNAN           | W         |                 |      |              |           | XPMN:XPMN           |
| AUG-SB-239.1 | AUG-SB | 1853        | {"line": "239", "name": "", "gender": "M", "mother": "Ellen", "birth_year": "1855", "birth_place": "Middle River", "reported_by": "Owner", "owner_full_name": "John Givens"} | 0.95       | Ellen           | Ellen      |             | Ellen     |            |             |            | B    | F      |            | E            | ELLEN           | ELAN             | B         |                 |      |              |           | ALN:ALN             |
| AUG-CC-205   | AUG-CC | 1866        | {"age": "2", "line": "205", "family": "99", "birth_year": "1864", "first_name": "Eliza", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Eliza           | Eliza      |             |           | 1864       |             |            | B    |        |            |              | ELIZABETH       |                  | B         |                 | f    |              | FC1866-99 |                     |
| AUG-CC-206   | AUG-CC | 1866        | {"age": "17", "line": "206", "family": "99", "birth_year": "1849", "first_name": "Stephen", "father_last_name": "Butler", "father_first_name": "Shadrack"} | 0.95       | Stephen         | Stephen    |             |           | 1849       |             |            | B    |        |            |              | STEPHEN         |                  | B         |                 | f    |              | FC1866-99 |                     |