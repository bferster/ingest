**VITAL RECORDS FORMAT**

	This file is a transcription vital records., such as birth, death, and marriage records.	
	It is a table with 10 columns. 
	Each row represents an enslaved person, their data and theue enslaver.
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the enslaved person	 in a row {
		- line - A unique identifier for the row
		- type - The type of vital record. Can be "birth", "death", or "marriage"
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces 
		- first_name - The enslaved's given name
		- middle_name - The enslaved's middle name or initial
		- last_name - The enslaved's surname
		- age - The age of the person in 1870
		- birth_year - The year the person was born.
		- record_year - The year of the death or marriage record. Empty for birth records
		- birth_place - The place the person was born. Empty for death or marriage records	
		- gender - The sex of the person. Can be F for female or M for male
		- race - The race of the person. B, W, M, I, C or Y
		- location - The location of the record
		- relations - The relations mentioned in the record	
		- note - Any notes about the record
		}

**Example rows**

	| line | type     | record_year | full_name      | first_name | middle_name | last_name | birth_year | birth_place | race | gender | mother | father | relations | note |
	|------|----------|-------------|----------------|------------|-------------|-----------|------------|-------------|------|--------|--------|--------|-----------|------|
	| 1794 | death    | 1871        | Billie Renick  | Billie     |             | Renick    | 1846       | Roanoke     |      |        |        |        |           | Franklin |
	| 1795 | death    | 1873        | Mary Hoban     | Mary       |             | Hoban     | 1869       |             |      |        |        |        |           | Westmoreland |
	| 1796 | death    | 1873        | Robert Hoban   | Robert     |             | Hoban     | 1871       |             |      |        |        |        |           | Westmoreland |
	| 1797 | birth    |             | James          | James      |             |           | 1855       |             | B    | M      | Fanny  |        |           |      |
	| 1798 | birth    |             | Patsy          | Patsy      |             |           | 1855       |             | B    | F      | Ellen  |        |           |      |
	| 1799 | birth    |             |                |            |             |           | 1855       |             | B    | M      | Sarah  |        |           |      |
	| 1800 | marriage | 1871        | Betsy Tyree    | Betsy      |             | Tyree     | 1831       |             | B    | F      | Malinda|        |           | Buck, Watson |
	| 1801 | marriage | 1871        | Ambrose Walker | Ambrose    |             | Walker    | 1841       |             | B    | M      | Lindsay| James Walker |     | Bowe, Lucy |
	| 1802 | marriage | 1871        | Bella Jackson  | Bella      |             | Jackson   | 1848       |             | B    | F      | Lizzie | Hiram Jackson |    | Bowe, Lucy |
	| 1803 | marriage | 1871        | Tandy Wood     | Tandy      |             | Wood      | 1849       |             | B    | M      | Jane   | Peter Wood |       | Mosby, John farm |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.
	- The source field is set to "ALB_VR_1715".
	- The source_type field is set to "vitalRecords".
	- The source_year field is set to the year in the record_year field.
	- The original_data field is set to the entire row as a JSONB object.
	- The confidence field is set to 0.85.
	- Apply the normalization as described in @Normalize.md
	- Add mention to mentions table

**Add parent mentions**

	- This occurs after all row mentions have been added to the mentions table
	- Add parent mentions for each record {
		- if mother mentioned add an mention for the mother.
		- if father mentioned add an mention for the father.
		- The source field is set to "ALB_VR_1715".
		- The gender field is set to "F" for the mother and "M" for the father.
		- The source_year field is set to the year in the record_year field.
		- The original_data field is set to the entire row as a JSONB object
		- The full_name field is set to the mother or father field
		- The first_name, middle_name, and last_name fields are set to parts of the mother or father field {
			- Remove all punctuation from full_name
			- If the full_name has only one word, then add that word to last_name and first_name.
			- If the full_name has two words, then first_name is the first word and last_name is the last word.
			- If the full_name has more than two words, then first_name is the first word, middle_name is the second word, and last_name is the last word.
			- If the full_name has a jr or sr or or ii or iii or iv 2nd or 3rd or 4th or 5th, use the word before it as the last_name.	
			}
		- Apply the normalization as described in @Normalize.md.
		- The confidence field is set to 0.85.
		- Add mention to mentions table
		}

**Add assertions**

	- This occurs after all parent mentions have been added to the mentions table.
	- if mother mentioned add an assertion for the mother with predicate IsMotherOf as below:
	- if father mentioned add an assertion for the father with predicate IsFatherOf as below:
		- Add assertion {
			subject: parent's mention_id.
			predicate: as defined above.
			object: child's mention_id.
			who: "vitalRecords". 
			start_year: record_year.
			end_year: "".	
			confidence: 0.85.
			}
		- Add assertion to assertions table.

