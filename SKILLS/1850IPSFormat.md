---
name: 1850IPSFormat
description: Format instructions for 1850IPSFormat
---

**1850 IPS FORMAT**

	This file is a transcription of the 1850 IPUMS Slave Schedule (IPS) dataset.
	It is a table with 13 columns.
	Each row represents an enslaved individual in a holding.
	There may be omissions, duplications, and errors in this data.
	Some fields may not be present in the table.

**Field names and descriptions:**
	
	- The following columns represent information about the person in a row.
	- Some fields may be blank {
		- line - A unique identifier for the row.
		- holdnum - The IPUMS holding/slaveholder ID or number.
		- slavenum - The sequence number of the enslaved individual within the holding.
		- sizehold - The total number of enslaved individuals in the holding.
		- age - The age of the person in 1850.
		- birth_year - The estimated year the person was born.
		- gender - The sex of the person. Can be F for female or M for male.
		- race - The race of the person as recorded (B, M, etc.).
		- norm_race - The normalized race of the person (B, etc.).
		- household_id - The identifier for the holding (e.g., HI1850-1).
		- histid_slave - IPUMS id for the enslaved person record.
		- histid - IPUMS id for the household / owner record.
		- hand - Y if verified by hand
		}

**Example rows**

| line | holdnum | slavenum | sizehold | age | birth_year | gender | race | norm_race | household_id | histid_slave | histid | hand |
| ---- | ------- | -------- | -------- | --- | ---------- | ------ | ---- | --------- | ------------ | ------------ | ------ | ---- |
| 1    | 307719  | 1        | 11       | 35  | 1815       | M      | B    | B         | HI1850-1     | 181462564884 | 181462564885 ||
| 2    | 307719  | 2        | 11       | 30  | 1820       | F      | B    | B         | HI1850-1     | 181462630420 | 181462564885 ||
| 3    | 307719  | 3        | 11       | 3   | 1847       | F      | B    | B         | HI1850-1     | 181462695956 | 181462564885 ||
| 4    | 307719  | 4        | 11       | 36  | 1814       | M      | B    | B         | HI1850-1     | 181462761492 | 181462564885 | Y |
| 5    | 307719  | 5        | 11       | 25  | 1825       | M      | M    | B         | HI1850-1     | 181462827028 | 181462564885 ||
| 6    | 307719  | 6        | 11       | 16  | 1834       | M      | B    | B         | HI1850-1     | 181462892564 | 181462564885 ||
| 7    | 307719  | 7        | 11       | 14  | 1836       | M      | B    | B         | HI1850-1     | 181462958100 | 181462564885 ||
| 8    | 307719  | 8        | 11       | 7   | 1843       | M      | B    | B         | HI1850-1     | 181463023636 | 181462564885 ||
| 9    | 307719  | 9        | 11       | 10  | 1840       | M      | B    | B         | HI1850-1     | 181463089172 | 181462564885 ||

**Translation instructions**

	- The source_year field is set to 1850.
	- Source is set to county-IPS-1850 (i.e. AUG-IPS-1850).
	- The confidence field is set to 0.8.
	- Add mention to mentions table.

**Creating the mention_id**

	- The source type is "IPS".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-IPS-1850-1, where "ALB" is the county, "IPS" is the source type, "1850" is the year and "1" is the line number from the line field in the row.

**Assertions**

	- Do not create any assertions for this source.

	
**Data source**
	https://usa.ipums.org/usa/slave/slave.shtml
https://www.tandfonline.com/doi/full/10.1080/01615440.2024.2442314
https://www.slaverycodes.org/source/nps_1850.html
