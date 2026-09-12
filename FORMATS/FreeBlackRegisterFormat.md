---
name: FreeBlackRegisterFormat
description: Format instructions for FreeBlackRegisterFormat
---

**FREE BLACK REGISTER FORMAT**

	This file is a transcription of the Free black register.
	Also known as the "Register of Free Negroes".
	Requiring free African Americans to formally register to prove their status.
	It is a table with 14 columns. 
	Each row represents a free Black person.
	There may be omissions, duplications, and errors in this data. 
	Some fields may not be present in the table.
	

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row {
		- line - A unique identifier for the row
		- full_name - The combination of the first_name, middle_name, and last_name separated by spaces 
		- first_name - The person's given name
		- middle_name - The person's middle name or initial
		- last_name - The person's surname
		- age - The age of the person at the time of registration
		- birth_year - The year the person was born. May be inaccurate +/- 5 years
		- gender - The sex of the person. Can be F for female or M for male
		- race - The race of the person (e.g. B)
		- color - The perceived color/complexion of the person
		- height - The height of the person (in inches)
		- regnum - The register number
		- record_year - The year of the record
		- info - Remarks, trade, emancipation details, or certificate notes
		}

**Example rows**

| line | full_name | first_name | middle_name | last_name | age | birth_year | gender | race | color | height | regnum | record_year | info |
| ---- | --------- | ---------- | ----------- | --------- | --- | ---------- | ------ | ---- | ----- | ------ | ------ | ----------- | ---- |
| 1 | Andrew Vind | Andrew | | Vind | 21 | 1789 | M | B | black | 68 | 1 | 1810 | Bound to the Overseer of the poor in Culpeper County to William Barber by Indenture 25th of July 1798 as appears by the certificate of John Jamison, clerk of Culpeper County. |
| 2 | Young Hill | Young | | Hill | 36 | | M | B | dark copper | 69 | 2 | | appears from the certificate of J. Holmes endorsed as a deed of emancipation produced by said Hill, and now in his possession which said deed bears date the 9th day of Decr 1794 and (as appears from an endorsement thereon made or signed P Brooke Beale (C S) has been recorded in the Land Office of said County of Montgomery. |
| 3 | Harry White | Harry | | White | 50 | 1761 | M | B | Black | 67 | 3 | 1811 | Shoemaker by trade; produced the certificate of the clerk of Cumberland County Virginia of his regular emancipation to me which is recorded as this request. |
| 4 | Boatswain Baily | Boatswain | | Baily | 30 | 1781 | M | B | Black | 72 | 4 | 1811 | freed by deed bearing the date of the 6th day of January 1808 agreeable to |
| 5 | John Gollathan | John | | Gollathan | 31 | 1782 | M | B | Yellow Complextion | 72 | 5 | 1813 | this day admitted to record in the court of [illegible] county. |
| 6 | Isaac Burns | Isaac | | Burns | 27 | 1786 | M | B | bright mulatto | 67.5 | 6 | 1813 | |
| 7 | John Burns | John | | Burns | 30 | 1783 | M | B | dark yellow | 70 | 7 | 1813 | by trade a shoe maker |
| 8 | Charles Whitrow | Charles | | Whitrow | 36 | 1778 | M | B | mulatto | 74 | 8 | 1814 | |
| 9 | Hannah McCoy | Hannah | | McCoy | 25 | 1789 | F | B | dark mulatto | 68 | 9 | 1814 | born free as appears by a certificate from Samuel McWilliams, clerk of the county court of Rockingham. |

**Creating the mention_id**

	- The source type is "FBR"
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: AUG-FBR-1, where  "AUG" is the county, "FBR" is the source type, and "1" is the line number from the line field in the row. 
	
**Translation instructions**

	- Most of the fields in the file match the same as the mentions' fields.
	- The source_year field is set from the record_year column.
	- The confidence field is set to 0.9.
	- The legal_status field is set to "F".
	- If color contains "light" or "mulatto" or "brown" or "olive" or "tawny" {
		- set race to "M".
		- else if color contains "yellow" or "indian" or "yallowish" or "yallow", set race to "I".
		- else set race to "B".
		}
	- Set norm_race to "B".
	- Add the following fields to the data JSONB field:
		- regnum
		- height
		- color
		- info
		- i.e. {"regnum": 1, "height": 68, "color": "black", "info": "Bound to the Overseer..."}
	- Apply the normalization as described in @Normalize.md.
	- Add mention to mentions table.
	
