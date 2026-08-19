---
name: VitalRecordsFormat
description: Format instructions for VitalRecordsFormat
---

**VITAL RECORDS FORMAT**

	This file is a transcription vital records, such as birth and death records.	
	It is a table with 10 columns. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row {
		- line - A unique identifier for the row
		- original_line - The original line number from the source
		- full_name - The combination of the first_name, the middle_name, and the last_name separated by spaces
		- first_name - The person's given name
		- middle_name - The person's middle name or initial
		- last_name - The person's surname
		- birth_year - The year the person was born
		- birth_place - The place the person was born
		- death_year - The year the person died
		- gender - The sex of the person. Can be F for female or M for male
		- parents - The parents mentioned in the record
		}

**Example rows**

	| line | original_line | full_name | first_name | middle_name | last_name | birth_year | death_year | gender | parents |
	|------|---------------|-----------|------------|-------------|-----------|------------|------------|--------|---------|
	| 1 | 1 | Wm S Hawpe | Wm | S | Hawpe | 1810 | 1877 | M | John Hawpe,Mary Hawpe |
	| 2 | 2 | Willam Newton Houff | Willam | Newton | Houff | 1853 | 1854 | M | Rebecca M Houff,Peter Houff |
	| 3 | 3 | Adam S. Hawpe | Adam | S | Hawpe | 1804 | 1880 | M | Mary Hawpe, Jno. Hawpe |
	| 4 | 4 | Jno T Hawpe | Jno | T | Hawpe | 1870 | 1877 | M | Jno T Hawpe,Ida C Hawpe |
	| 5 | 5 | Jas S Hawpe | Jas | S | Hawpe | 1836 | 1889 | M | Adam Hawpe,Margt. Hawpe |
	| 6 | 6 | Katie Hawpe | Katie | | Hawpe | 1887 | 1888 | F | Annie Hawpe,A H Hawpe |
	| 7 | 7 | Ida Cliffton Hawpe | Ida | Cliffton | Hawpe | 1855 | 1877 | F | Elizabeth Allen,Bart Allen |
	| 8 | 8 | Cloved L Houff | Cloved | L | Houff | 1870 | 1871 | M | Benjamin F Houff,Mary S Houff |
	| 9 | 9 | Lucy Ann Haupe | Lucy | Ann | Haupe | 1846 | 1858 | F | Adamm Haupe,Margaret Haupe |
	| 10 | 10 | Cicero Preston Haupe | Cicero | Preston | Haupe | 1889 | 1890 | M | Geo C Haupe,Mary E Haupe |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.
	- The source_year field is set to the year in the record_year field.
	- The original_data field is set to the entire row as a JSONB object.
	- person's name populate the full_name, first_name, middle_name, and last_name fields.
	- The confidence field is set to 0.9.
	- Apply the normalization as described in @Normalize.md
	- Create mention_id as decribed below
	- Add mention to mentions table

**Creating the mention_id and source**

	- The county for this source is "ALB".
	- The source is created as follows: for example: ALB-VR-1, where  "ALB" is the county, "VR" is the prefix
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-VR-1, where  "ALB" is the county, "VR" is the prefix and "1" is the line number from the line field in the row. 

**Add person mention**

	- Add the full_name, first_name, middle_name, and last_name fields.
	- Apply the normalization as described in @Normalize.md
	- Create mention_id as decribed above
	- Add mention to mentions table

**Add parent mentions**

	- This occurs after all row mentions have been added to the mentions table
	- for each mention added after ingestion of this source {
		- get parents value from original_data field
		- split parents by comma
		- set gender, birth_year, death_year fields to NULL
		- create first new parent mention
			- set new parent mention_id with new mention_id with format: for example: ALB-VR-1.1, where  "ALB" is the county, "VR" is the prefix and "1.1" is the index for first parent.
		- if parents == 2 then create second new parent mention
			- set new parent mention_id with new mention_id with format: for example: ALB-VR-1.2, where  "ALB" is the county, "VR" is the prefix and "1.2" is the index for second parent.
		- Apply the normalization as described in @Normalize.md.
		- Add mention to mentions table.
		}
		
**Add assertions**

	- This occurs after all parent mentions have been added to the mentions table.
	- if new parent mentions are added, add a new assertion for each: {
			subject: parent's mention_id
			predicate: "isParentOf"
			object: person's mention_id
			who: "vitalRecords"
			start_year: record_year
			end_year: ""
			confidence: 0.80
			}
		- Add assertion to assertions table.


**Sheets inport instructions**

	The relation column contains information about parents needs to be extracted, and places into the parent column.
	the parents column constain the parents: parent1, parent2

	For example:
		"Death Â June 1894Â 
		Pond Gap, Augusta, Virginia, United StatesÂ 
		Birth Â June 1888Â 
		Augusta, VaÂ 
		Age 6 years
		Parents Ada B Reese, Geo G Reese"

		Should convert to: "Ada B Reese, Geo G Reese"

	Unmerge cells for all merged cells

**Original source**

	https://www.familysearch.org/en/search/record/results?count=100&offset=2500&q.birthLikeDate.exact=on&q.birthLikeDate.from=1700&q.birthLikeDate.to=1900&q.birthLikePlace=Fauquier%2C%20Virginia%2C%20United%20States&q.birthLikePlace.exact=on&q.miscKeyword=augusta&q.recordCountry=United%20States&q.recordSubcountry=United%20States%2CVirginia&c.collectionId=on&f.collectionId=3940896

	https://www.familysearch.org/ark:/61903/3:1:3QHN-R3YR-MXT7?lang=en&i=234&personaUrl=%2Fark%3A%2F61903%2F1%3A1%3A6ZGZ-TN9H