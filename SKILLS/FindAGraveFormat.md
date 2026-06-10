**FindAGrave FORMAT**

	This file contains the cemeteries where people are buried, from 1600 to 1900. 
	It is a table with 8 columns. 
	There may be omissions, duplications, and errors in this data.
	Some fields may be not be present in table.

**Field names and descriptions**
	
	The following columns represent information about the person in a row. 
	Some columns may be blank { 
		line - A unique identifier for the row
		full_name - The combination of the first_name, the middle_name, and the last_name separated by spaces
		first_name - The given name
		middle_name - The middle name or initials
		last_name - The surname
		birth_year - The year the person was born
		death_year - The year the person died
		location - The location of the cemetery
	}

**Example rows**

| line | full_name | first_name | middle_name | last_name | birth_year | death_year | location |	
|------|-----------|------------|-------------|-----------|------------|------------|----------|
| 1    | Lelia Abbott | Lelia   |             | Abbott    | 1864       | 1868       | Keene    |
| 2    | Abraham   | Abraham    |             |           | 1740       | 1818       |          |
| 3    | Thompson Adams | Thompson |          | Adams     | 1817       | 1873       | North Garden |
| 4    | Eli Ames  | Eli        |             | Ames      | 1795       | 1870       | Covesville |
| 5    | Eunice Ames | Eunice   |             | Ames      | 1761       | 1843       | Covesville |
| 6    | B C H Amiss | BC       |             | Amiss     | 1871       | 1874       | Woodridge |
| 7    | John S Amiss | John    | S           | Amiss     | 1790       | 1885       | Woodridge |

**Creating the mention_id**
	- The county for this source is "ALB".
	- The source type is "FG".
	- The year is "1600	".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-FG-1600-1, where  "ALB" is the county, "FG" is the source type, "1600" is the year and "1" is the line number from the line field in the row. 
	- If there is already an identical mention_id within this source append a number to it to differentiate it, like this for the first one: ALB-FG-1600-1.1, ALB-FG-1600-1.2 for the second, etc.

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source field is set to "ALB_FindAGrave".
	- The original_data field is set to the entire row as a JSONB object.
	- The confidence field is set to 0.8 apply the normalization as described in @Normalize.md
	- Get the location_id as described in @GetLocation.md using the location field.
