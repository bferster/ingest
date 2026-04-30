**FREE BLACK REGISTER FORMAT**

	This file is a transcription of the Free black register.
	Also known as the "Register of Free Negroes".
	Requiring free African Americans to formally register to prove their status.
	It is a table with 12 columns. 
	Each row represents free Black person.
	There may be omissions, duplications, and errors in this data. 
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row {
		- line - A unique identifier for the row
		- full_name - The combination of the first-name, the middle_name, and the last_name separated by spaces 
		- first_name - The enslaved's given name
		- middle_name - The enslaved's middle name or initial
		- last_name - The enslaved's surname
		- birth_year - The year the person was born. May be inaccurate +/- 5 years
		- gender - The sex of the person. Can be F for female or M for male
		- age - The age of the person in 1870
		- height - The height of the person
		- date - The date of the record
		- color - The percieved color of person
		- description - The description of the person
		}

**Example rows**

	| line | full_name          | first_name | middle_name | last_name | gender | age | birth_year | date | height    | color        | description |
	|------|------------------- |------------|-------------|-----------|--------|-----|------------|------|-----------|--------------|-------------|
	| 1    | Amanda Ailstock    | Amanda     |             | Ailstock  | F      | 35  | 1816       | 1851 | 5' 1 1/2" | dark mulatto | no scars or marks perceivable |
	| 2    | Amanda Ailstock    | Amanda     |             | Ailstock  | F      | 41  | 1817       | 1858 | 5' 1 1/2" | dark         | no scars or marks perceivable |
	| 3    | Amanda Ailstock    | Amanda     |             | Ailstock  | F      | 45  | 1817       | 1862 | 5' 1 1/2" | dark         | no scars or marks perceivable |
	| 4    | Betsy Ailstock     | Betsy      |             | Ailstock  | F      | 40  | 1811       | 1851 | 5' 3 1/4" | dark         | no scars or marks perceivable |
	| 5    | Betsy Ailstock     | Betsy      |             | Ailstock  | F      | 46  | 1812       | 1858 | 5' 3 1/4" | dark         | no scars or marks perceivable |
	| 6    | Elizabeth Ailstock | Elizabeth  |             | Ailstock  | F      | 22  | 1828       | 1850 | 5' 2"     | dark         | a small scar upon the forefinger of the left hand |
	| 7    | Elizabeth Ailstock | Elizabeth  |             | Ailstock  | F      | 28  | 1829       | 1857 | 5' 2"     | dark         | small scar upon the forefinger of the left hand and one over the left eye |
	| 8    | Elizabeth Ailstock | Elizabeth  |             | Ailstock  | F      | 23  | 1829       | 1852 | 5' 6"     | dark         | scar on the right side of her neck |
	| 9    | Frances Ailstock   | Frances    |             | Ailstock  | F      | 25  | 1825       | 1850 | 5' 2"     | dark         | a scar upon the upper lip and one upon the back of the right hand |
	| 10   | Frances Ailstock   | Frances    |             | Ailstock  | F      | 32  | 1826       | 1858 | 5' 2"     | dark         | scar upon upper lip and one upon back of right hand |
	| 11   | George W Ailstock  | George     | W           | Ailstock  | M      | 23  | 1834       | 1857 | 5' 8"     | light        | scar on the forehead, four on the left hand and one on the forefinger of the right hand |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields	
	- The source field is set to "ALB_FBR" 
	- The source_year field is set to the date column field value.
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.85.
	- The legal_status field is set to "F".
	- If color contains "light" or "mulatto" or "brown" or "olive" or "tawny" {
		- set race to "M".
		- else if color contains "yellow" or "indian", set race to "I".
		- else set race to "B".
		}
	- Height in the JSONB height field should be translated to inches.
	- Apply the normalization as described in @Normalize.md.
	- Add mention to mentions table.
