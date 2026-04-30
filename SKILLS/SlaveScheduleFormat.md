**SLAVE SCHEDULE FORMAT**

	This file is a transcription of the US slave schedules for 1850 and 1860. 
	It is a table with 10 columns. 
	Each row represents an enslaved person, their data and theue enslaver.
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the enslaved person	 in a row {
		- line - A unique identifier for the row
		- enslaver_full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces 
		- first_name - The enslaved's given name
		- middle_name - The enslaved's middle name or initial
		- last_name - The enslaved's surname
		- age - The age of the person in 1870
		- birth_year - The year the person was born. May be inaccurate +/- 5 years
		- gender - The sex of the person. Can be F for female or M for male
		- race - The race of the person. B, W, M, I, C or Y
		- location - The location of the person
		}

**Example rows**

| line | enslaver_full_name | first-name | middle-name | last-name | age | birth-year | gender | race | location |
|------|--------------------|------------|-------------|-----------|-----|------------|--------|------|----------|
| 1    | Henry Benson       | Henry      |             | Benson    | 15  | 1835       | F      | B    | CV       |
| 2    | Henry Benson       | Henry      |             | Benson    | 23  | 1827       | F      | M    | CV       |
| 3    | Henry Benson       | Henry      |             | Benson    | 2   | 1848       | F      | B    | CV       |
| 4    | O S Allen          | O          | S           | Allen     | 35  | 1815       | F      | B    | CV       |
| 5    | O S Allen          | O          | S           | Allen     | 10  | 1840       | F      | B    | CV       |
| 6    | William A Bebb     | William    | A           | Bebb      | 55  | 1795       | M      | B    | CV       |
| 7    | William A Bebb     | William    | A           | Bebb      | 55  | 1795       | M      | B    | CV       |
| 8    | William A Bebb     | William    | A           | Bebb      | 45  | 1805       | F      | B    | CV       |
| 9    | William A Bebb     | William    | A           | Bebb      | 47  | 1803       | F      | B    | CV       |
| 10   | William A Bebb     | William    | A           | Bebb      | 30  | 1820       | F      | M    | CV       |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields	
	- The source field is set to "ALB_SS-1850" or "ALB_SS-1860".
	- The source_year field is set to 1850 or 1860.
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.8.
	- The legal_status field is set to "E"
	- Apply the normalization as described in @Normalize.md
	- Get the location_id as described in @GetLocation.md using the location field
	- Add mention to mentions table.

**Add enslaver mentions**

	- This occurs after all mentions for the enslaved people have been added to the mentions table
	- Add a mention for each unique enslaver {
		- The source field is set to "ALB_SS-1850" or "ALB_SS-1860"
		- The source_year field is set to 1850 or 1860
		- The original_data field is set to the entire row as a JSONB object
		- Set the legal_status field is set to ""
		- The confidence field is set to 0.8
		- The first_name, middle_name, and last_name fields are set to parts of the enslaver_full_name field {
			- Remove all punctuation from middle name
			- If the enslaver_full_name has only one word, then add that word to last_name
			- If the full_name has two words, then first_name is the first word and last_name is the last word
			- If the full_name has more than two words, then first_name is the first word, middle_name is the second word, and last_name is the last word
			- if the full_name has a jr or sr or or ii or iii or iv 2nd or 3rd or 4th or 5th, use the word before it as the last_name	
			}
		- Apply the normalization as described in @Normalize.md.
		- Get the location_id as described in @GetLocation.md using the location field.
		- age, race, gender, and birth_year fields are ignored.
		- Add mention to mentions table.
	}

**Add assertions**

	- This occurs after all enslaver mentions have been added to the mentions table.
	- Make a look-up table of names from the enslaver_full_name field and the enslaver's mention_id
	- For each enslaved mention {
		- Use the enslaver_full_name field to find the enslaver's mention_id from the look-up table.
		- Add  the that mention_id to the enslaved person's mention row.
		- Create assertion row data {
			subject: enslaved person's mention_id.
			predicate: wasEnslavedBy.
			object: enslaver's mention_id.
			who: "slaveSchedule", 
			start_year: 1850 or 1860.
			end_year: 1850 or 1860.	
			confidence: 0.8.
			}
	- Add assertion to assertions table.
	- TODO: Lynn will add relationship assertions (confidence is .5).
	}

