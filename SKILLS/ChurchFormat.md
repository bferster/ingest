**FindAGrave FORMAT**

	This file contains the churches people attended, from 1851 to 1880. 
	It is a table with 13 columns. 
	There may be omissions, duplications, and errors in this data.
	Some fields may be not be present in table.

**Field names and descriptions**
	
	The following columns represent information about the person in a row. 
	Some columns may be blank { 
		line - A unique identifier for the row
		record_year - The year of the church record
		full_name - The combination of the first_name, the middle_name, and the last_name separated by spaces
		first_name - The given name
		race - The race (B/W)
		gender - The gender of the person (M/F)
		church_name - name of church	
		church_id - ID of church from table below	
		enslaver_full_name - The combination of the enslaver_first_name, the enslaver_middle_name, and the enslaver_last_name separated by spaces
		enslaver_first_name - The given name of the enslaver
		enslaver_middle_name - The middle name or initials of the enslaver
		enslaver_last_name - The surname of the enslaver
		}

**Church ID table**

	|church_id |church_name |
	|----------|------------|
	| BC       | Ballenger Creek |
	| CB       | Charlottesville Baptist|
	| CGE      | Chestnut Grove, Earlysville|
	| MPE      | Mountain Plain/Escol pre1858|
	| CEC      | Christ Episcopal, Charlottesville|
	| SPI      | St. Paul's Church, Ivy|
	| MM       | Mount Moriah|
	| MP       | Mount Pleasant|
	| NG       | North Garden|
	| SHI      | Shiloh|
	| IC       | Ivy Creek|
	| BIN      | Bingham's|
	| GEN      | Gentry's|
	| CoP      | Cove Presbyterian|
	| LC       | Lebanon Church|
	| ChP      | Charlottesville Presbyterian|
	| AFR      | African|
	| SG       | South Garden|
	| CBOL 	   | Colored Baptist: Old Lynchburg Rd.|
	| NGCF     | North Garden Colored Free Church|
	| PAB      | Piedmont African Baptist|
	| DEL      | Delevan|
	| MZ       | Mt. Zion|
	| SUR      | Salem later Union Ridge|
	| UR       | Union Ridge|
	| MSN      | Mount Sinai on side of the Nortonsville Rd.|
	| UB       | Union Branch|
	| PG       | Pleasant Grove|
	| FUSP     | Free Union, Stony Point|
	| MA       | Mount Amos|
	| MZ       | Mount Zion|
	| ME       | Mount Ed|
	| SH       | Spring Hill|
	| HPG      | Hardware formerly Pine Grove|
	| ABCB     | African Baptist Church near Carter's Bridge|
	| BBIC     | Bethel Baptist Institutional Church|
	| BCGC 	   | Bethel Church of God in Christ|
	| BAC      | Bethlehem Apostolic Church|
	| ChGBC    | Chapman Grove Baptist Church|
	| CCCBW    | Charlottesville Church of Christ, Bible Way World Wide|
	| CGBOL    | Chestnut Grove Baptist Church - Old Lynchburg Road|
	| CGBSA    | Chestnut Grove Baptist Church - Southern Albemarle|
	| ChT  	   | Christ's Temple|
	| COGH     | Church of God HOLINESS|
	| COGSC    | Church of God and Saints of Christ|
	| COGIC    | Church of God in Christ|
	| CLG      | Church of the Living God|
	| EBC      | Ebenezer Baptist Church|
	| EvB      | Evergreen Baptist|
	| FHLIHDC  | Faith Hope and Love International Healing and Deliverance Center|
	| FBCov    | First Baptist Church - Covesville|
	| FBCW     | First Baptist Church - West Main Street|
	| FUBSP    | Free Union Baptist Church - Stony Point|
	| HPBC     | Hatton Pond Baptist Church|
	| HHBC     | Hickory Hill Baptist Church|
	| HCLGPGT  | Holy Church of the Living God the Pillar & Ground of the Truth|
	| HCLG     | Holy Church of the Living God|
	| HCG      | Holy Church of God|
	| HTCGC    | Holy Temple Church of God in Christ|
	| JWM      | John Wesley Methodist|
	| MHPC     | Mars Hill Pentecostal Church|
	| MidOBC   | Middle Oak Baptist Church|
	| MCC      | Mission of Christ Church|
	| MtABC    | Mount Alto Baptist Church|
	| MtAmBC   | Mount Amos Baptist Church, Free Union|
	| MtCalBC  | Mount Calvary Baptist Church|
	| MtCarBC  | Mount Carmel Baptist Church|
	| MtEBC    | Mount Eagle Baptist Church|
	| MNMEC    | Mount Nathan Methodist Episcopal Church|
	| MtOBC    | Mount Olivet Baptist Church|
	| MtPBC    | Mount Pleasant Baptist Church|
	| MtSaBC   | Mount Salem Baptist Church|
	| MtSiBC   | Mount Sinai Baptist Church|
	| MZBAM    | Mount Zion Baptist Church-Advance Mills|
	| MZBC     | Mount Zion Baptist Church-Charlottesville|
	| MZBN     | Mount Zion Baptist Church-Newtown|
	| MtVBC    | Mountain View Baptist Church|
	| NCPC     | New Covenant Pentecostal Church|
	| NGMBC    | New Green Mountain Baptist Church|
	| NHBC     | New Hope Baptist Church|
	| ORBC     | Oak Ridge Baptist Church|
	| OUBC     | Oak Union Baptist Church|
	| PACD     | Pentecost Assembly Church of Deliverance (Faith)|
	| PBYM     | Piedmont Baptist Church, Yancey Mills|
	| PilBC    | Pilgrim Baptist Church|
	| PGMH     | Pine Grove Meeting House|
	| PlGBC    | Pleasant Grove Baptist Church|
	| RSBC     | Rising Sun Baptist Church|
	| RHBC     | Rose Hill Baptist Church|
	| SMMRCC   | Saint Margaret Mary's Roman Catholic Church|
	| SJBC     | Saint John's Baptist Church|
	| SdRBC    | Sandroad Baptist Church [Sand Road]|
	| ShiBC    | Shiloh Baptist Church|
	| ShiMC    | Shiloh Methodist (AME) Church|
	| SlHBC    | Slate Hill Baptist Church|
	| SoGBC    | South Garden Baptist Church|
	| SprHBC   | Spring Hill Baptist Church|
	| TEC      | Trinity Episcopal Church|
	| THCG     | True Holiness Church of God|
	| THCKes   | True Holiness Church, Keswick|
	| UnBC     | Union Baptist Church|
	| UGBC     | Union Grove Baptist Church|
	| UMBC     | Union Mission Baptist Church|
	| URBC     | Union Ridge Baptist Church|
	| URuBC    | Union Run Baptist Church|
	| WFBC     | Wake Forest Baptist Church|
	| WGBC     | Wildon Grove Baptist Church|
	| ZBNG     | Zion Baptist Church, North Garden|
	| ZHBC     | Zion Hill Baptist Church|
	| ZUBC 	   | Zion Union Baptist Church|

**Example rows**

	| line | record_year | full_name | first_name | last_name | race | gender| church_name | church_id | enslaver_full_name | enslaver_first_name | enslaver_middle_name | enslaver_last_name |  	
	|------|-------------|-----------|------------|-----------|------|-------|-------------|-----------|--------------------|---------------------|----------------------|--------------------|
	| 1	 | 1851	         | George    | George     |           | B    | M     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 2	 | 1851	         | Peter     | Peter      |           | B    | M     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 3	 | 1851	         | John      | John       |           | B    | M     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 4	 | 1851	         | Fanny     | Fanny      |           | B    | F     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 5	 | 1851	         | Manerva   | Manerva    |           | B    | F     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 6	 | 1851	         | Maria     | Maria      |           | B    | F     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 7	 | 1851	         | Eliza     | Eliza      |           | B    | F     | Ballenger Creek | BC    | A M Appling        | A                   | M                    | Appling |
	| 8	 | 1851	         | Peyton    | Peyton     |           | B    | M     | Ballenger Creek | BC    | R L Jefferson      | R                   | L                    | Jefferson |
	| 9	 | 1851	         | William   | William    |           | B    | M     | Ballenger Creek | BC    | R L Jefferson      | R                   | L                    | Jefferson |
	| 10 | 1851	         | Lucy      | Lucy       |           | B    | F     | Ballenger Creek | BC    | R L Jefferson      | R                   | L                    | Jefferson |

**Translation instructions**

	- Most of the fields in file match the same as the mentions' fields.	
	- The source field is set to "ALB_CH_1851".
	- The original_data field is set to the entire row as a JSONB object.
	- The confidence field is set to 0.8 apply the normalization as described in @Normalize.md
	- Get the location_id as described in @GetLocation.md using the location field.

**Add enslaver mentions**

	- This occurs after all mentions for the enslaved people have been added to the mentions table.
	- Add a mention for each unique enslaver {
		- The source field is set to "ALB_CH_1851"
		- The source_year field is set to the value of the record_year field.
		- The original_data field is set to the entire row as a JSONB object.
		- Set the legal_status field is set to ""
		- Set is_enslaver to TRUE
		- The confidence field is set to 0.85.
		- Set the full_name from the enslaver_full_name 
		- Set the middle_name from the enslaver_middle_name.
		- Set the last_name from the enslaver_last_name.
		- Apply the normalization as described in @Normalize.md.
		- Get the location_id as described in @GetLocation.md using the location field.
		- age, race, gender, and birth_year fields are ignored.
		- Add mention to mentions table.
	}

**Add assertions**

	- This occurs after all enslaver mentions have been added to the mentions table.
	-	- For each enslaved person mention added this ingest {
		- Get their enslaver's mention_id.
		- Create assertion row data {
			subject: enslaved person's mention_id.
			predicate: wasEnslavedBy
			object: enslaver's mention_id.
			who: ALB_CH_1851, 
			start_year: record_year.
			end_year: null.	
			confidence: 0.8.
			}
	- If the new assertion already exists in the database, skip it.
	- Otherwise add new assertion to assertions table.
	}


