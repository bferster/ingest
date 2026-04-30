**FREEDMAN'S LIST FORMAT**

	This file is a transcription of the people listed in th Freesman's List from 1865 to 1872
	It is a table with 7 columns. 
	Each row represents a black person
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

	| line | full_name           | first_name | middle_name | last_name | record_year | location |
	|------|-------------------- |------------|-------------|-----------|-------------|--------|
	| 1    | Polly Williams      | Polly      |             | Williams  | 1866        | Franklin Surry NC |
	| 2    | Armstead Williamson | Armstead   |             | Williamson| 1866        | Franklin |
	| 3    | Segeour Williams    | Segeour    |             | Williams  | 1867        | Franklin |
	| 4    | Eliza Ellen Williams| Eliza      | Ellen       | Williams  | 1866        | Charlottesville |
	| 5    | Bob Nelson          | Bob        |             | Nelson    | 1866        | Charlottesville |
	| 6    | Louisa Nelson       | Louisa     |             | Nelson    | 1866        | Charlottesville |
	| 7    | Tom Nelson          | Tom        |             | Nelson    | 1866        | Charlottesville |
	| 8    | Robert Anderson     | Robert     |             | Anderson  | 1866        | Charlottesville |
	| 9    | Alger Shother       | Alger      |             | Shother   | 1866        | Franklin Macon, NC |
	| 10   | Betty Pendleton     | Betty      |             | Pendleton | 1866        | Charlottesville |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields	
	- The source field is set to "ALB_FL-1865"
	- The source_year field is set to the value in the record_year field
	- The original_data field is set to the entire row as a JSONB object
	- The confidence field is set to 0.8
	- The legal_status field is set to "F"
	- Apply the normalization as described in @Normalize.md
	- Get the location_id as described in @GetLocation.md using the location field
	- Share surname - TODO: Get rules from Lynn before implementation