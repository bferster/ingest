**1880 CENSUS FORMAT**

	This file is a transcription of the US census for 1880 and is a table with 19 columns. 
	It was made by an enumerator person going dwelling to dwelling. 
	Each row represents one person living in that household. 
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	The following columns represent information about the person in a row. 	
	Some fields may be blank {
		- line - A unique identifier for the row.
		- district - The post office of the enumeration district.
		- dwelling - A number used by the enumerator to identify a unique household, in order of visitation.
		- family - A number used by the enumerator to identify a unique family, in order of visitation.
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces. If there are only two words, the first is
		- last_name and the second is the last_name. If there is only one word, it is only the last_name.
		- first_name - The given name.
		- middle_name - The middle name or initials.
		- last_name - The surname.
		- first_name - The given name.
		- age - The age of the person in 1870.
		- birth_year - The year the person was born. May be inaccurate +/- 5 years.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person. B, W, M, I, C or Y.
		- marital - The marital status.
		- relation - The relationship between the person and the head of household, whose relationship is labelled Self. 
		- occupation - The work role of the person.
		- head - "Y" if the person is the head of the household.
		}

**Example rows**

| line | district | dwelling | family | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | marital | relation | occupation | birth_place | mother_birth_place | father_birth_place | head |
| ---- | -------- | -------- | ------ | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ------- | -------- | ---------- | ----------- | ------------------ | ------------------ | ---- |
| 1    | 21       | 1        | 1      | Josoeph F Wood | Josoeph | F         | Wood      | 48  | 1832       | M      | W    | M       | Self     | Blacksmith |             | MD                 | VA                 | Y    |
| 2    | 21       | 1        | 1      | Martha A Wood  | Martha  | A         | Wood      | 47  | 1833       | F      | W    | M       | Wife     | Keeping House | VA       | VA                 |                    |      |
| 3    | 21       | 1        | 1      | William J Wood | William | J         | Wood      | 19  | 1861       | M      | W    | S       | Son      | Blacksmith | VA          | VA                 |                    |      |
| 4    | 21       | 1        | 1      | Fanny S Wood   | Fanny | S           | Wood      | 14  | 1866       | F      | W    | S       | Daughter | At Home    | VA          | VA                 |                    |      |
| 5    | 21       | 1        | 1      | Joseph B Wood  | Joseph | B          | Wood      | 11  | 1869       | M      | W    | S       | Son      | Attending School | VA    | VA                 |                    |      |
| 6    | 21       | 1        | 1      | Ada F Wood     | Ada   | F           | Wood      | 7   | 1873       | F      | W    | S       | Daughter |            | VA          | VA                 |                    |      |
| 7    | 21       | 1        | 2      | James W Brown  | James | W           | Brown     | 45  | 1835       | M      | W    | M       | Self     | Carpenter  | VA          | VA                 |                    | Y    |
| 8    | 21       | 1        | 2      | Mary J Brown   | Mary  | J           | Brown     | 36  | 1844       | F      | W    | M       | Wife     | Keeping House | VA       | VA                 |                    |      |
| 9    | 21       | 1        | 2      | Marshall C Brown | Marshall | C      | Brown     | 12  | 1868       | M      | W    | S       | Son      |            | VA          | VA                 |                    |      |
| 10   | 21       | 1        | 2      | Lavinia Brown  | Lavinia |           | Brown     | 10  | 1870       | F      | W    | S       | Daughter | At Home    | VA          | VA                 |                    |      |
| 11   | 21       | 1        | 2      | Lucy F Brown   | Lucy  | F           | Brown     | 9   | 1871       | F      | W    | S       | Daughter |            | VA          | VA                 |                    |      |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source field is set to "ALB_CN_1880".
	- The source_type field is set to "census".
	- The source_year field is set to 1880.
	- The original_data field is set to the file's entire row as a JSONB object
	- The confidence field is set to 0.9.
	- If a new household is detected, i.e. the dwelling number is different from the previous row {
		- create a new id using the year and the dwelling number, such as 1880-67.
		- set the household_id field to the new id
		}
	- If a new family is detected, i.e. the family number is different from the previous row {
		- create a new id using the year and the family number, such as 1880-67.
		- set the family_id field to the new id.
		}
	- If the head field is "Y" then set the head  field to TRUE.	
	- Apply the normalization as described in @Normalize.md.
	- Get the location_id as described in @GetLocation.md using the district field prepended with ED_1880, i.e "ED_1880_21".
	- Add mention to mentions table

**Assertions**

	- This occurs after all mentions have been added to the mentions table
	- For each mention with the same household_id {
		- Identify the head of household as the person with the head field value of TRUE.
		- find the other mentions in the household with the same household_id and find predicate {
			- If the relation field is "Wife" then predicate is isSpouseOf
			- If the relation field is "Son" then predicate is isChildOf
			- If the relation field is "Daughter" then predicate is isChildOf
			- If the relation field is "Brother" then predicate is isSiblingOf
			- If the relation field is "Sister" then predicate is isSiblingOf
			- If the relation field is "Father" then predicate is isFatherOf
			- If the relation field is "Mother" then predicate is isMotherOf
			- If the relation field is "Grandfather" then predicate is isGrandfatherOf
			- If the relation field is "Grandmother" then predicate is isGrandmotherOf
			- If the relation field is "Uncle" then predicate is isUncleOf
			- If the relation field is "Aunt" then predicate is isAuntOf
			- If the relation field is "Cousin" then predicate is isCousinOf
			- If the relation field is "Nephew" then predicate is isNephewOf
			- If the relation field is "Niece" then predicate is isNieceOf
			- If the relation field is "Son-in-law" then predicate is isSonInLawOf
			- If the relation field is "Daughter-in-law" then predicate is isDaughterInLawOf
			- If the relation field is "Brother-in-law" then predicate is isBrotherInLawOf
			- If the relation field is "Sister-in-law" then predicate is isSisterInLawOf
			- If the relation field is "Father-in-law" then predicate is isFatherInLawOf
			- If the relation field is "Mother-in-law" then predicate is isMotherInLawOf
			- If the relation field is "Grandfather-in-law" then predicate is isGrandfatherInLawOf
			- If the relation field is "Grandmother-in-law" then predicate is isGrandmotherInLawOf
			- If the relation field is "Uncle-in-law" then predicate is isUncleInLawOf
			- If the relation field is "Aunt-in-law" then predicate is isAuntInLawOf
			- If the relation field is "Cousin-in-law" then predicate is isCousinInLawOf
			- If the relation field is "Nephew-in-law" then predicate is isNephewInLawOf
			- If the relation field is "Niece-in-law" then predicate is isNieceInLawOf	
			- If the relation field is "Son-in-law" then predicate is isSonInLawOf
			- If the relation field is "Daughter-in-law" then predicate is isDaughterInLawOf
			- If the relation field is "Brother-in-law" then predicate is isBrotherInLawOf
			- If the relation field is "Sister-in-law" then predicate is isSisterInLawOf
			- If the relation field is "Father-in-law" then predicate is isFatherInLawOf
			- If the relation field is "Mother-in-law" then predicate is isMotherInLawOf
			}
		- Create assertion row data {
			subject: head_mention_id
			predicate: predicate identified from relation field above
			object: person with relation person's mention_id
			who: "1880Census" 
			start_year: 1880
			end_year: ""	
			confidence: 0.9
			}
		- Add assertion to assertions table
	}
