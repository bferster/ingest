---
name: 1860IPSFormat
description: Format instructions for 1860IPSFormat
---

**1860 IPS FORMAT**

	This file is a transcription of the 1860 IPUMS Slave Schedule (IPS) dataset.
	It is a table with 28 columns.
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
		- nhouses - Number of slave houses.
		- age - The age of the person in 1860.
		- agemonth - Age in months (99 if not recorded in months / full years).
		- gender - The sex of the person. Can be F for female or M for male.
		- birth_year - The estimated year the person was born.
		- race - The race of the person as recorded (B, M, etc.).
		- norm_race - The normalized race of the person (B, etc.).
		- household_id - The identifier for the holding (e.g., HI1860-1).
		- histid_slave - IPUMS id for the enslaved person record.
		- histid - IPUMS id for the household / owner record.
		- histid2 - Secondary IPUMS holding ID if linked.
		- histid3 - Tertiary IPUMS holding ID if linked.
		- nlinks_slave - Number of links for the enslaved person.
		- blind - Blind indicator.
		- nlinks_holding - Number of links for the holding.
		- deaf - Deaf indicator.
		- idiotic - Idiotic indicator.
		- insane - Insane indicator.
		- sh1type - Slaveholder 1 type.
		- sh1typed - Slaveholder 1 detailed type.
		- sh2type - Slaveholder 2 type.
		- sh2typed - Slaveholder 2 detailed type.
		- sh3type - Slaveholder 3 type.
		- sh3typed - Slaveholder 3 detailed type.
		}

**Example rows**

| line | holdnum | slavenum | sizehold | nhouses | age | agemonth | gender | birth_year | race | norm_race | household_id | histid_slave | histid | histid2 | histid3 | nlinks_slave | blind | nlinks_holding | deaf | idiotic | insane | sh1type | sh1typed | sh2type | sh2typed | sh3type | sh3typed |
| ---- | ------- | -------- | -------- | ------- | --- | -------- | ------ | ---------- | ---- | --------- | ------------ | ------------ | ------ | ------- | ------- | ------------ | ----- | -------------- | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 1    | 29764   | 1        | 2        |         | 54  | 99       | F      | 1806       | B    | B         | HI1860-1     | 228387389466 | 228387389467 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 2    | 29764   | 2        | 2        |         | 18  | 99       | M      | 1842       | M    | B         | HI1860-1     | 228387455002 | 228387389467 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 3    | 29765   | 1        | 1        |         | 12  | 99       | F      | 1848       | B    | B         | HI1860-2     | 228387520538 | 228387520539 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 4    | 29766   | 1        | 3        |         | 45  | 99       | F      | 1815       | B    | B         | HI1860-3     | 228387586074 | 228387586075 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 5    | 29766   | 2        | 3        |         | 8   | 99       | F      | 1852       | M    | B         | HI1860-3     | 228387651610 | 228387586075 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 6    | 29766   | 3        | 3        |         | 6   | 99       | F      | 1854       | M    | B         | HI1860-3     | 228387717146 | 228387586075 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 7    | 29767   | 1        | 10       | 1       | 64  | 99       | M      | 1796       | B    | B         | HI1860-4     | 228387782682 | 228387782683 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 8    | 29767   | 2        | 10       | 1       | 36  | 99       | M      | 1824       | B    | B         | HI1860-4     | 228387848218 | 228387782683 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 9    | 29767   | 3        | 10       | 1       | 29  | 99       | F      | 1831       | M    | B         | HI1860-4     | 228387913754 | 228387782683 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |
| 10   | 29767   | 4        | 10       | 1       | 25  | 99       | F      | 1835       | M    | B         | HI1860-4     | 228387979290 | 228387782683 | 0      | 0       | 1            |     | 1              | ---- | ------- | ------ | ------- | -------- | ------- | -------- | ------- | -------- |

**Translation instructions**

	- The source_year field is set to 1860.
	- Source is set to county-IPS-1860 (i.e. AUG-IPS-1860).
	- The confidence field is set to 0.8.
	- Add mention to mentions table.

**Creating the mention_id**

	- The source type is "IPS".
	- The mention_id is created as follows:
		- Each source has a unique prefix: for example: ALB-IPS-1860-1, where "ALB" is the county, "IPS" is the source type, "1860" is the year and "1" is the line number from the line field in the row.

**Assertions**

	- Do not create any assertions for this source.

**Data source**

	https://usa.ipums.org/usa/slave/slave.shtml
	https://www.tandfonline.com/doi/full/10.1080/01615440.2024.2442314
	https://usa.ipums.org/usa/slave/slave_variables.shtml
