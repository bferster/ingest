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
		- middle_name - The middle name or initia.
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

	| line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | occupation | page | revalue | pevalue | head |
	| ---- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ---------- | ---- | ------- | ------- | ---- |
	| 1    | PO1870-4 | 1        | 1      | Mary Hamm | Mary       |             | Hamm      | 83  | 1787       | F      | W    |            | 1    | 3500    | 832     | Y    |
	| 2    | PO1870-4 | 1        | 1      | Mary Hamm | Mary       |             | Hamm      | 52  | 1818       | F      | W    |            | 1    |         |         |      |
	| 3    | PO1870-4 | 1        | 1      | Nath G Hamm | Nath     | G           | Hamm      | 45  | 1825       | M      | W    |            | 1    | 1000    | 2000    |      |
	| 4    | PO1870-4 | 1        | 1      | Clifton Hamm | Clifton |             | Hamm      | 43  | 1827       | M      | W    |            | 1    | 1000    | 1300    |      |
	| 5    | PO1870-4 | 1        | 1      | Agnes Hamm | Agnes     |             | Hamm      | 41  | 1829       | F      | W    |            | 1    |         |         |      |
	| 6    | PO1870-4 | 1        | 1      | Sallie Maddex | Sallie |             | Maddex    | 8   | 1862       | F      | W    | At Home    | 1    |         |         |      |
	| 7    | PO1870-8 | 2        | 2      | John Myers| John       |             | Myers     | 45  | 1825       | M      | B    | Rail Road  | 1    |         |         | Y    |
	| 8    | PO1870-8 | 2        | 2      | Helen Myers | Helen    |             | Myers     | 50  | 1820       | F      | B    |            | 1    |         |         |      |
	| 9    | PO1870-8 | 2        | 2      | Sam Brown | Sam        |             | Brown     | 20  | 1850       | M      | B    |            | 1    |         |         |      |
	| 10   | PO1870-8 | 2        | 2      | Betsy Brown | Betsy    |             | Brown     | 13  | 1857       | F      | B    | At Home    | 1    |         |         |      |
	| 11   | PO1870-8 | 2        | 2      | Albert Brown | Albert  |             | Brown     | 15  | 1855       | M      | B    | Domestic   | 1    |         |         |      |
	| 12   | PO1870-8 | 2        | 2      | Nancy Brown| Nancy     |             | Brown     | 9   | 1861       | F      | B    | At Home    | 1    |         |         |      |
	| 13   | PO1870-8 | 2        | 2      | Robt J Barber| Robt    | J           | Barber    | 60  | 1810       | M      | B    | Farm Laborer| 1   |         |         |      |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source field is set to "ALB_CN_1870"
	- The source_type field is set to "census"
	- The source_year field is set to 1870
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.9
	- The legal_status field is set to "F"
	- If the head  field is "Y" then set the head  field to TRUE	
	- Apply the normalization as described in @Normalize.md
	- Get the location_id as described in @GetLocation.md using the district field
	- Add mention to mentions table

**Assertions**

	- This occurs after all mentions have been added to the mentions table
	- For each mention with the same household_id {
		- Identify the head of household as the person with the head field value of TRUE.
		- find the other mentions in the household with the same household_id and find predicate {
			- From Lynn			
			}
		- Create assertion row data {
			subject: head_mention_id
			predicate: predicate identified from above
			object: person with relation person's mention_id
			who: "1870Census" 
			start_year: 1870
			end_year: ""	
			confidence: 0.5
			}
		- Add assertion to assertions table
	}
