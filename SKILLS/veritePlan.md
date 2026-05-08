This is a high level view of what we are trying to accomplish with the overall app. Only the ingest phase (phase 1)  will be implemented now.



The Verité project uses the new LLM-based tools coupled with the structured reasoning of expert genealogists who have successfully traced African Americans across the emancipation divide; a context where personal names are often absent from pre-Civil War records and where identity can only be established by reasoning across multiple inconsistent and incomplete primary sources. 

In reality, there exists only one identity that represents that person, even though there may be evidence for them scattered over many records. Each record can be inaccurate and incomplete, but any person they refer to is one of those unique individuals. 

The Verité project’s goal is two-fold: First, provide access to accurately transcribed primary source documents for individual Virginia counties with normalized fields enabling systematic comparisons across multiple documents.

Second, we have designed a series of web-based tools that can aid people in this complicated tracing exercise. Drawing with guidance from experienced genealogists, this toolset scaffolds the complex search and tracing process using local records, such as censuses (including slave schedules), cemetery, birth and death records, marriage licenses, Freedman Bureau records, baptism entries, tax lists, and other local sources. 

The Verité system relies on this collection of datasets which have been normalized to provide information about unique individuals. It is centered around the researcher: a true human-in-the loop (HITL) AI application.

These sources are fed into the system and a data model is constructed using the process outlined below. We are an official licensee of the FamilySearch genealogy API and have full access to their vast databases and records.

Project Partners

To help identify these tools, we have partnered with two local organizations who have been working on this problem for several decades, and two universities:

Afro-American Historical Association: The AAHA has digitized hundreds of records to aid people doing this research, including birth and death records, official documents, wills, slave schedules, censor records, and church records. AAHA’s Know Their Names project helps trace the ancestry of formerly enslaved people in Fauquier County Virginia, about an hour from Washington, DC.

Central Virginia History Researchers: the CVHR is located in Charlottesville, VA and has been actively researching genealogical history in Albemarle County.

University of Maryland College of Information: A top-ranked research and teaching college in the field of information science, expanding the frontiers of how information and technology are accessed and used in a rapidly evolving world. 

University of Virginia School of Data Science: Their program features a rigorous, integrated curriculum, with coursework in ethics, data mining, probabilistic modeling, machine learning, and text analytics. We participate in their capstone program.

FamilySearch: We have partnered with FamilySearch and have been granted API access to their rich data sources. 
Project Principals
Lynn Rainville, PhD is an author, speaker, and public historian. She was a dean of the College at Sweet Briar and was the executive director of Institutional History and the Museums at Washington and Lee University.

Bill Ferster, PhD is a former University of Virginia  research professor (joint appointments in history and educational technology), technologist, author, and has founded multiple technology companies.

Zubin Jelveh, PhD is a professor at the University of Maryland and expert in data science for public policy, and record linkage. He was director of NY’s Crime Lab, at the University of Chicago to develop programs to reduce crime and violence.

Daniel Ruskin is a doctoral student in information science at the University of Maryland, and has previously worked on unraveling historical records of the enslaved at Washington University in St. Louis.


Verité strategy
The basic problem from the researcher’s perspective is: If I know the identity of a person, who are they related to? This starts with parents, but extends to other relatives and relationships. By answering this question iteratively, the family tree can be constructed, so this is the primary research question in the Verité system. The ultimate goal is identification.

One way to establish these relationships is by finding evidence of the people in historical records, such as censuses, slave schedules, vital records, etc.. These primary sources have been transcribed and loaded into the system for analysis. Mentions of people are connected with one another by assertions about their relationship to each other, and finally, people are positively identified by following hypotheses explored from these assertions.
Mentions 
Each time a person is identified in a primary source, whether by name or some other description, a record of that person is added to the system as a mention. A mention merely notes the identification of an individual in a primary source, with no claims about who it may actually be, or their relationship to any other person or organization. 

Mentions are the atomic units that the Verité system is built upon. They contain all the information available about that person, such as names, ages, gender, race, etc. Some mentions may not even have any name associated with them at all. This information is normalized, so we can later compare “apples with apples.” 
Assertions
To connect mentions about people with other people, we create a series of assertions that define that relationship. Assertions take the form where one person, the subject, is connected to another person, the object, has a predicate relationship, such as being the father, mother, enslaver, etc.. No assertion exists without a traceable chain back to its primary source.

Some of these relationships can be directly inferred from the primary source data. For example, the 1880 census explicitly identifies the relationship between the head of household and household members. Others are extracted from unstructured statements, such as “Thomas is the son of John.”  using queries to an LLM. An assertion important to true identification of a person is isSameAs, which asserts that two mentions refer to the same actual person. A sophisticated matching process is used to judge their similarity.
Hypotheses 
Researchers are led through the process by investigating hypotheses inspired by experienced genealogists to apply the assertions to identify probable identities and add them to the family tree. This scaffolds the process and provides guidance to choosing the correct evidence that supports that identification. The evidentiary trail is available to defend that identification.
Researcher’s journey 

The researcher typically navigates the system through two distinct functional modes. In confirmation mode, the application identifies high-confidence candidates for validation, allowing for rapid tree construction during the post-1870 period, when documentation is most abundant. Conversely, investigation mode engages the researcher in analyzing primary source records, reconciling conflicting evidence, and utilizing the hypothesis scaffolding to navigate through ambiguous cases. 

While the system never assumes final authority on complex identifications, it surfaces pertinent evidence to support the human-in-the-loop and preserves an unbroken evidentiary trail to defend every conclusion.

This comprehensive working environment consists of three integrated views: the tree view visualizing the current state of knowledge, the hypothesis panel managing open research questions, and the card provenance detailing the specific evidence supporting every assertion. 
Phase 1: Starting the tree
Research often begins with known data regarding an individual or recent ancestor, such as a name, an approximate birth_year, or a specific geographic location. Upon entering this information, the system generates an initial person card and executes several background processes:



A new entry is created in the persons table.
A fuzzy search is posed to the mentions table to identify local matches.
Parallel queries are dispatched to the FamilySearch API.
Candidates are ranked by confidence and returned for researcher confirmation.

Confirmed matches result in the record are stamped with the unique person_id, populating the card with available evidence from censuses, vital records, and church registers. Absent a confirmed match, the card remains a stub, awaiting future data ingestion.
Phase 2: Climbing the tree
From a confirmed identity, researchers can add relatives via the + button. Basic parameters, such as "mother, born circa 1840, race: Black, Virginia" are sufficient to trigger a search. The system returns candidates ranked by confidence, requiring the researcher to apply qualitative judgment to evaluate whether a specific mention, such as a neighbor in a census record, is a plausible match for the family unit. 
Phase 3: Hitting the 1870 wall
As research approaches the 1870 emancipation boundary, records become significantly sparse. The system provides a visual warning on the card as search confidence declines, at which point the following automated routines are initiated:

The wall-pierce function scans slave schedule mentions.
Freedmen's Bureau records are queried for matching demographic data.
Identified matches are presented as Identity hypotheses on the card.

Direct evidence, such as a labor contract explicitly naming a former enslaver, can automatically resolve an identity. Probabilistic matches based on factors like enslaver_name are surfaced as hypotheses for expert evaluation.
Phase 4: Working hypotheses
Once the researcher encounters the emancipation wall, the hypothesis panel serves as the primary workspace. The system flags patterns for review, such as:

Household co-occurrence among 1870 neighbors matching a single slave schedule page.
Conflicting birthplaces between records, requiring an assessment of informant reliability.
The absence of a previously recorded child, suggesting potential migration or a name change.

By resolving these hypotheses, researchers provide the expert justification required to update confidence scores and create new assertions. Supported hypotheses result in confirmed relationships like WasEnslavedBy, while refuted ones generate isNotSameAs links to prevent erroneous pairings in future runs.
Verité Data Model
Sources, such as censuses, slave schedules, church records, etc., that had been saved as tables, and queried data from the FamilySearch API are curated and ingested into the model. No assertion in the system exists without an unbroken chain back to the document it originally is referenced from. The data loaded from these is not directly referenced in further steps, but is mediated through the MENTIONS table detailed below and applied to every source document.
Step 1: Ingest raw data from primary sources


This ingest process is performed once for each source document, with the data extracted into the MENTIONS table described in the next step. Even though the phases are described as steps, they are not necessarily done in the order they have been presented after the initial run. They can be called to process new elements as new research, assertions and hypotheses are added.

The LOCATIONS table

The LOCATIONS table contains the information about properties where people lived, worked, worshipped, learned, and were buried. These are entered by hand prior to ingesting any source, but as new locations are discovered through the ingestion process, they are added to this table. 

The table’s rows consist of the location’s name, any aliases of that name, owners (if applicable), start_year, end_year of their ownership, and the latitude, longitude of the centroid of the property location and the radius. If there are successive owners, each new group gets a row and the start_year and end_year fields define their tenure.

To map an enslaver’s property, you need to pull from sources designed specifically to track land and wealth, such as the agricultural schedules, county land tax books, confederate engineer maps, and other records. Census records use the location_id from the enumerator. Other types of locations include: “counties”, “districts”, “farms”, “workplaces”, and “schools”. 
Step 2: Create MENTIONS list

Mentions provide the link between the raw data found in the various records and the ability to infer relationships between them. The original records are never altered, simply copied verbatim into the MENTIONS table.

Mentions are the atomic units of the entire Verité identity resolution system. They connect people with evidence. The original row data from the source in the ingest step is added, but only the mentions are the only references to the original source going forward.

There is at least one mention for every row in a source: the person that is referenced in a census line, Freedman's Bureau entry, vital record, or church register and becomes exactly one mention. If a row identifies more than one person, each person is added as their own mention entry in the table. 

The original_data field contains a link to the JSONB stored original data ingested for further reference and searchability by the PostGreSQL data storage system where the data is permanently stored and accessed.

To capture some of the relationships discovered, assertions are added to the ASSERTIONS table. More are added after this process by combing through the mentions.

Aside from the original data added directly from the source, a number of normalized fields are used to provide a common basis for later comparisons:

mention_id: unique id
source: a unique identifier of the source ingested 
source_type: “census”, “slaveschedule”, “findagrave”, …
source_year: year of source data
original_data: the full row in original source table
confidence: from 0 to 1
full_name
first_name 
middle_name
last_name
maiden_name
birth_year
death_year
racelegal
gender 
legal_status: “F” or  “E” (free or enslaved)
is_enslaver: “true” or  “”
norm_first_name: resolves abbreviations and nicknames 
nysiis_last_name: phonetic encoding like Soundex
norm_race: “B” or  “W”
norm_occupation: cluster of 21 basic categories 
location_id
enslaver_id
household _id
family_id

Name aliases / nicknames
If a source exposes a nickname, alias, or alternative names, a hasNameVariant assertion is added for each alternative name, making them searchable in the knowledge graph and available for name matching in the scoring step.

Data from unstructured sources
Deed books, probate records, oral histories, newspapers, runway slave ads, WPA narratives, church records, Find-a-Grave entries, and wills often contain unstructured, narrative text.  A probate record of John Smith might read:  "I leave to my son Thomas my enslaved woman Hannah and her infant child." From this, many mentions can be automatically extracted using an LLM at ingest time to interpret the text, for example:

John Smith, is_enslaver: TRUE 
Thomas is_enslaver: TRUE, 
Hannah, legal_status: “E” 
Infant child, legal_status: “E”

Once all the person mentions are added, they are thereafter referred to by their unique mention_id. Any information that matches one of the mention fields is also added. Hannah's and the infant's  enslaver_id  set to Thomas's mention_id. The following assertions then are be added:

Hannah wasEnslavedBy John Smith, end_year 1858
Infant wasEnslavedBy John Smith, end_year 1858
Hannah wasEnslavedBy Thomas, start_year 1858
Infant wasEnslavedBy Thomas, start_year 1858
Thomas isChildOf John Smith
Infant isChildOf Hannah

Data from Censuses 
Because census records are a trusted source of data, information ingested from census records will fit into the standard fields of mention. 

Different years may have more or less information, but all the original data fields can be accessed through the original_data field. 

The location_id is set from the enumeration district in 1880 or the post_office in 1870 for that row queried from the LOCATIONS table.

The 1880 census contains a relationship field that defines the relationship to the head. If the person is not the head of the household, an assertion describing their relationship is added to tie the two together, using their mention_ids.

There are some rules that can be applied to earlier censuses that don’t explicitly specify the relations, and these assertions as added with lower confidence levels.

Data from Slave Schedules
The slave schedules contain information about enslavers and the enslaved, so a pair of mentions is added for each enslaved person row in the schedule. 

The enslaver is added as with is_enslaver: TRUE
The enslaved person is added with enslaver_id is set to the mention_id of the enslaver.

Data from Freed Black Register
These contain additional fields of value, each requiring a new mention row:

The relationship is an unstructured field which identifies a second person. A mention is added for both people.
An assertion describing their relationship is added to tie the two together, using their mention_ids.
If an alias is listed, that name is added as a hasNameVariant assertion. 

Data from Freedmen's Bureau
Labor contracts name the freedperson and often the former owner. These are unstructured and require LLM extraction. This can uncover enslavers, marriages, education, travel requests, land possession, occupations, family relationships, locations, apprenticeships, indentureships, family separations, court cases, land titles, and physical appearances.

Data from Freedmen's Bank
Freedman's bank records name depositors, their family members, and sometimes their former enslaver. These are unstructured and require LLM extraction. This can uncover enslavers, family relationships, occupation, employment, locations, and military service.

Data from Vital Records
Vital records contain information about birth, deaths and marriages. The birth and death places, maiden names, and parents' names can be gleaned. 

Data from church records
Birth records name the child and often both parents. The location_id is obtained from the LOCATIONS table. A mention is added for each person referenced.

The owner has is_enslaver: TRUE and the person’s enslaver_id is set to their mention_id. An isMemberOf assertion is added to the ASSERTIONS table.

If parents are referenced, isChildOf assertions are added to reflect that relationship. The notes field can be parsed with an LLM to extract other field data and may generate other mentions.

Data from birth and death records
Death records name the deceased and sometimes a spouse or parent. A mention is added for each person. The appropriate assertions are added to reflect their relationship.

Other records:

Deed Books: Sales and gifts of enslaved people were recorded in county deed books. The Grantor and Grantee both become entities in the enslavers table.

The 1850 & 1860 Agricultural Schedules lists farms in the order that the enumerator traveled across the county. It provides the total acreage of the farm.

Confederate Engineer Bureau: During the Civil War, the Confederacy commissioned highly detailed topographical maps of Virginia counties. Maps created by Jedediah Hotchkiss explicitly label the locations of prominent plantations, mills, and enslaver residences. These will need to be transcribed using AI or by hand.

County Land Tax Books contain distance and bearing from the county courthouse, plus the nearest waterway. A row might read: Benjamin T. Brown | 800 acres | 14 miles NW | On Moorman's River.
Step 3: Create post hoc mentions

After all the census mentions have been added, some mentions are updated to reflect changes implied by other mentions, which contain aggregated data.

Households and families 
The system groups the mentions by their household, stored in the mention’s household_id field. These are added by iterating through all the census mentions in any given census. For each mention in that census:

The system creates a new unique household identifier, such as HC1860-123455 when it encounters a new dwelling.

The system creates a new unique family identifier, such as FC1860-123455 when it encounters a new family number.

For each mention in that census with that dwelling, that mention’s household_id is set.

For each mention in that census with that family number, that mention’s family_id is set.

Censuses after 1870 have a relationship field so a series of assertions are added to the ASSERTIONS table to reflect those relationships.

Some spousal and parental relationships can be inferred from the age and line placement for earlier censuses.

Name variation assertions
If a source encounters an alternate name for a person, a hasNameVarient  assertion is added to the assertions list linking that person’s mention_id with the alternative name. These assertions are examined in the scoring process.
Step 4: Create ASSERTIONS list

This is the heart of the inference system by creating a list of statements that use mentions to define the connection between people, creating a knowledge graph of RDF encoded statements such as isChildOf, isSisterOf, isSameAs, etc. These are the same kinds of building blocks used in linked-data systems. Assertions are created in two passes of this step. 

The first pass creates the assertions table and adds non-identity assertions. It defines the table structure, the predicate vocabulary, the who field, and the temporal fields. It then writes all assertions that do not depend on scoring: isHousemateOf, inFamilyOf, isNeighborOf, wasEnslavedBy, isLocatedAt, and any family relationship assertions from Bureau and vital records. 


A second pass occurs immediately after the score similarity step writes any assertions to the assertions table as done in the first pass. This is primarily the isSameAs assertion.

The format for representing these relationships is: 

The subject is the mention_id of the subject person.
The object is what person the subject has a relationship with, based on the predicate type:
object_id holds object is an id
object_string if a string 
object_id holds a mention_id if that type of predicate 	
confidence, from 0 to 1, that it is indeed true.
The start_year and end_year define the temporal span.
who is the person or document asserting the relationship. This can be “human”, “inferred”, or some other source.

The predicate vocabulary:

isSameAs: the same-person link. Produced by the scoring step, consumed by the persons step.
isNotSameAs: an explicit negative assertion. Useful when two records that look similar have been confirmed by a human as different people. This prevents re-linking them on the next run.
isChildOf, isParentOf, isSpouseOf, isSiblingOf: all directional. isChildOf with subject A and object B means A is the child, B is the parent.
wasEnslavedBy: Subject A is the person, object B is the enslaver.
isHousemateOf: co-resident in the same household for a specific year.
inFamilyOf: member in the family of head at a specific year.
isNeighborOf: member of an adjacent household in enumeration order.
hasNameVariant: person mentioned is known by an additional name.
isLocatedAt: Subject A is a historical mention, Object B is the property_id of a specific physical location.
isMemberOf: Subject A is the person, Object B is the property_id of a specific.
sFatherOf, isMotherOf, isGrandfatherOf, isGrandmotherOf, isUncleOf, isAuntOf, isCousinOf, isNephewOf, isNieceOf, isSonInLawOf, isDaughterInLawOf, isBrotherInLawOf, isSisterInLawOf, isFatherInLawOf, isMotherInLawOf, isGrandfatherInLawOf, isGrandmotherInLawOf, isUncleInLawOf, isAuntInLawOf, isCousinInLawOf, isNephewInLawOf, isNieceInLawOf 

Location changes over time, so there may be many assertions of location for a given person. The system will traverse to the properties table to retrieve the actual latitude and longitude.

For the Enslaved Era: If an wasEnslavedBy assertion is found, it gets the latitude/longitude from the enslaver_id’s listing in the LOCATIONS table for that time span.

For the Emancipated Era: The system looks at an 1870 census mention for the person. If the person mentioned in the isNeighborOf assertion has a race of “W”, the system queries the LOCATIONS table for that year using the neighbor's person_id or name.

End users can confirm or dispute any assertion through the client UI. Their contributions add new assertion rows tagged who: human with a confidence: 1.0. The original assertion is never overwritten and both coexist with disagreement is part of the record. 

This table exists as both a traditional relational database table and a graph object that connects nodes (mentions) and edges (other mentions or strings) using Apache AGE, an extension to PostgreSQL that supports linked-data graphing capabilities.

Plausibility checking

When the system creates an isChildOf, isParentOf, or isSpouseOf assertion, it already has access to both mentions' birth_year fields. The plausibility check is a validation gate on those assertions, before writing the row, compute the implied parental age at the child's birth, and if it falls outside plausible bounds, do two things: write the assertion anyway (the evidence is real, even if the interpretation is wrong), but simultaneously write a "Relationship" hypothesis to the hypotheses table flagging the implausibility.

Contradictions and confirmations 

When a new assertion is added to the assertions table, query for any existing assertions that share the same subject (or the same person_id if resolved) and the same predicate type but have a different object. 

If the  new assertion conflicts with an existing one. Add an "Informant-reliability" hypothesis to the hypotheses table, linking both assertions as evidence and letting the researcher adjudicate. If the new assertion agrees with an existing one. Boost the confidence on the existing assertion.

Users with FamilySearch accounts can also push confirmed links back to their FS tree via the API.
Step 5: Score similarity 

This step uses matching algorithms to compare two people and assign a similarity confidence score. The score is used to set the confidence value when creating the isSameAs assertions in the assertions step There are a number of  factors in determining whether two people are actually the same:

Jaro-Winkler string distance on normalized names alongside a comparison of NYSIIS phonetic codes. Jaro-Winkler gives extra weight to matching characters at the start of a string, which matters for names where the first syllable is the most stable part. A pair where both the string distance and phonetic codes agree scores at the top. A pair that only matches phonetically scores in the middle.

birth_year compares uncertainty ranges rather than point estimates. If the two records' birth_year_low to birth_year_high windows overlap, the base score is positive and scales with how close the point estimates are — a gap of zero years scores 1.0, one year scores ~0.92, four years scores ~0.60. If the ranges do not overlap at all, the birth year score is 0.0 regardless of how close the point estimates appear. Non-overlapping ranges mean the records cannot plausibly be the same individual given the uncertainty model.

Household context is the most powerful signal. The scorer retrieves the full households table for each record's household and compares: do the head names match? Do the spouse names match? Are there children in both households whose birth year ranges overlap? A household with a matching head name, matching spouse name, and qat least two overlapping children can contribute up to 30% of the overall confidence — more than name similarity alone. Records without a household_id (non-census sources) receive a neutral 0.5 on this signal rather than 0.0, because absence of household data is not evidence against a match.

race and gender are a binary exact-match signal. Disagreement produces 0.0 and typically eliminates the pair. Agreement produces 1.0. Unknown values on either side produce a neutral score.

The assertions list is searched for alternative names encounters via hasNameVarient assertions. These effect the scoring as well.

Final score is a weighted sum calculated as follows: 

Knockout gates — certain signals short-circuit the whole score to zero regardless of everything else. Gender disagreement is the obvious one. If birth year ranges don't overlap at all, that's also a knockout. No amount of name and household agreement should override a ten-year birth year gap with tight ranges.

Conditional boosts — the weight of a signal shifts based on the informativeness of the context. Here's where it gets interesting for your domain:

Rare name adjustment. Using the Fellegi-Sunter algorithm, compute a frequency weight for each name in the corpus. When the name is rare, boost the name signal weight and reduce household dependence. When the name is common, do the reverse. 

Household availability adjustment. When one or both records lack household data (non-census sources like Freedmen's Bureau individual entries), you can't just score household at 0.5 and move on — you need to redistribute that 30% weight across the remaining signals. Otherwise every non-census comparison is capped at ~70% confidence structurally, which will bias clustering toward census-only identities.

After all the candidates are scored, a second pass adds any assertions to the assertions table just like the first pass in the assertions step. This includes the isSameAs assertion.

The latitude, longitude, and radius fields are set after the second pass at making the assertions and rely on any connections to properties or the coordinates defined when making any mentions, such as those defined by the enumeration process, such as the enumeration district or post office. 

NOTE: the refinement of the process will be done by the work of UVA data science students as their final masters degree capstone project during the summer of 2026.
Step 6: Creating the persons list

This is when records become people. Everything before it produced raw data, normalized fields, household context, and pairwise similarity scores. The persons step reads those scores and makes the leap from "these two records are probably the same person" to "this group of records is one individual."

The step treats evidence assertions as edges in a knowledge graph. Every record row is a node. Every isSameAs assertion above the confidence threshold is a connection between those two nodes referenced. The step finds all connected components — groups where every node can be reached from every other node through a chain of edges.

Transitivity is the key property. If the 1870 record links to the 1880 record with confidence 0.91, and the 1880 record links to the 1900 record with confidence 0.83, then all three end up in the same cluster, even if the 1870 and 1900 records were never directly compared against each other. 

Once a connected component is identified, the step computes consensus values from all member records to populate the persons row:

display_name is the most complete and most frequently occurring name form. If four records say "eliza goings" and one says "eliza a going", the display name becomes "Eliza Ann Goings" — using the middle initial from the one record that supplied it.

birth_year_est is the median of all birth_year_est values across cluster members. birth_year_range spans from the lowest birth_year_low to the highest birth_year_high across all members.

gender, race, and birth_place are majority values and whichever value appears most often across cluster members wins.

mention_count is the raw count of records in the cluster.

algorithm is the way the person was created, “FamilySearch”, “inferred”, or “human”.

confidence is the average pairwise similarity across all pairs of records in the cluster. This is not the average of the edge scores that were used to build the cluster. It is a fresh computation that measures how internally consistent the full cluster is. A cluster built from five strong pairwise links scores high. A cluster built through transitivity where the ends don't agree closely scores lower and may be flagged.

location uses a two-source approach. Before scoring, the step resolves a coordinate for each mention being compared. It first checks for an isLocatedAt assertion whose temporal span covers the mention's source_year, if one exists, the linked property's latitude, longitude, and area fields are used. If no property assertion exists, it falls back to the coordinates set on the mention row itself during the mentions step.

After writing the persons row, the step loops through every member record and fills in two fields: person_id is set to the new person's id, and resolution_status is set to resolved. Records in an ambiguous cluster get resolution_status: ambiguous. Records that were not claimed by any cluster: no assertions above threshold, or assertions only connecting to disputed clusters keep person_id = null and resolution_status = unresolved.

Every person's row written by the person step has has_pre_wall_link = false and wall_pierce_confidence = null. The person step does not attempt pre-1870 linking. That is entirely the wall-piercing step's responsibility. The person’s step job ends the moment a person row exists with its post-emancipation identity consensus established and all its constituent records stamped.

Step 7: 1870 wall-piercing

It is the mission-critical step of the entire pipeline, the moment where an individual's identity is traced back across the 1870 wall and connected to their existence before emancipation.

Building the candidate set

Rather than consulting a separate enslavers table, the system queries the mentions table directly. It retrieves all entries where source_type = ‘slaveschedule’ and follows their enslaver_id field to identify the associated enslaver mention: any record where is_enslaver = true. This process pairs the anonymous enslaved entry (containing age, gender, and an estimated birth year) with the enslaver's identity (including name and location), both residing within the same mentions table.

Filtering

To reduce the candidate set before the scoring step begins, the system applies three specific filters:

Gender must be an exact match between the resolved person and the slave schedule mention. Any disagreement acts as a knockout that eliminates the candidate.

Birth year windows must overlap. The system compares the resolved person's birth_year_low and birth_year_high against the entry's window. Notably, the schedule uses a ±3 year range rather than ±2, as enslaver estimates were often less precise than later self-reported data. Non-overlapping ranges result in a hard knockout.

Enslaver surname is compared using phonetic encoding. The resolved person's nysiis_last_name, representing the surname adopted after emancipation, is matched against the nysiis_last_name of the enslaver mention. Because surname adoption was highly inconsistent, this functions as a soft filter rather than a knockout.

Scoring

Unlike the census-to-census pipeline, the wall-piercing score contains no name signal for the enslaved person. The confidence score is constructed from these signals:

Birth year overlap, scaled by the proximity of point estimates within the window.

Gender agreement, treated as a binary match signal.

Enslaver surname match, weighted lightly to account for historical unreliability.

Household co-occurrence provides the most powerful confirmatory signal. If multiple individuals from the same 1870 household match entries on a single slave schedule page — especially in clusters consistent with family units — the co-occurrence provides a significant boost to all candidates.

Occupation matching offers a weak but useful ensemble signal. For instance, a blacksmith in 1870 matching a schedule entry linked to an enslaver known for having a forge adds marginal confidence to the identity.

Freedmen's Bureau records act as a critical bridge. When a labor contract or marriage record explicitly names both the freedperson and former enslaver, the system bypasses probabilistic matching to create a direct WasEnslavedBy assertion with high confidence. This high-value path is processed first.

Threshold and outcome

Because the wall-pierce score typically lacks a name signal, confidence values are structurally lower. A score of 0.74 represents a strong wall-pierce result, even though the same score would be borderline in census matching. The threshold is calibrated to reflect these constraints.

When a candidate clears this threshold, the slave schedule mention’s person_id is set to the resolved person's UUID and the resolution_status is updated to resolved. This is the moment an anonymous record is claimed by a named identity. A WasEnslavedBy assertion is then added to the assertions table, with temporal spans drawn from the schedule and corroborating property records.

The resolved person's row is updated to reflect has_pre_wall_link = true, and the wall_pierce_confidence is recorded. In the tree view, the wall-pierce indicator appears on the person's card, allowing researchers to surface the slave schedule mention, the enslaver's name, and the reconstructed pre-emancipation household context.

Candidates falling below the threshold are written to the hypotheses table as Identity hypotheses. Researchers can then review the evidence to confirm or dismiss the link. Confirmed links create assertions at confidence: 1.0 with who: human, while dismissals generate an isNotSameAs assertion to prevent future re-linking.

Unlike the scoring step’s six factors, the wall-pierce confidence has no name signal at all. Slave schedules have no names. The score breakdown contains only birth_year overlap, gender, and enslaver surname phonetic match. This structural absence is why wall-pierce confidence scores are inherently lower than census-to-census match score: a 0.74 wall-pierce confidence is a strong result given the constraints, whereas a 0.74 census match would be considered borderline.

Other factors include:

Household co-occurrence: if three people in the same 1870 household all match to entries on the same slave schedule page, that's massively confirmatory. 

Occupation matching: a "blacksmith" in 1870 matching a schedule entry on an enslaver known to have had a forge is weak individually but useful in ensemble.

Freedmen's Bureau records as a bridge: these often name both the freedperson and their former enslaver explicitly, which would let you bypass the probabilistic surname matching entirely for covered individuals.

They're post-emancipation identity records and they mention a named freedperson with age, gender, location, and sometimes family.

They are explicit wall-pierce documents.  When they name a former enslaver, they create a direct link that bypasses the wall-pierce step’s probabilistic matching. This is the highest-value contribution.

They're family structure evidence. Bureau marriage records establish spousal links, and labor contracts with family lists establish parent-child relationships. These generate isSpouseOf, isChildOf assertions that strengthen your knowledge graph independently of census matching.

If it passes, it fills in person_id on the slave_schedule_records row, the same mechanism the cluster step uses to stamp records rows. This is the moment the anonymous pre-1870 entry is claimed by a named identity.
Step 8: Hypothesis testing

Professional genealogists often form hypotheses around issues they want to explore to root out information and reconcile conflicting data found. A common pattern is: observe an anomaly → form a hypothesis → identify what evidence would resolve it → sometimes find that evidence, sometimes not. Rather than keep this in their head, the system provides a mechanism to scaffold the process, relying on the wealth of primary source information available and the existing assertions. 

Below are a number of common hypothesis types based on the work of professional genealogists. These are derived from detailed research accounts and we are continuing to add new types:

Identity: "Person A in record X is the same individual as Person B in record Y." 

Relationship: "John is Henderson's grandson, not son." These often arise from demographic implausibility and get tested by following the younger person forward in time.

Origin: "Henderson was born in Ohio" vs. "Henderson was born in Albemarle." These get tested by finding corroborating records or by evaluating informant reliability.

Absence: "Henry is missing from the 1860 household because he left home" vs. "Henry is actually J.R. under a different name." 

Succession: "The Henderson who married S.E. Tyre in 1870 is Jr., not Sr." This is exactly the generational confusion that your pipeline needs to handle.

Surname-regime: Person changed across the emancipation boundary because the earlier name was enslaver-assigned.

Community-membership: A group of individuals formed an interconnected post-emancipation community. These arise from co-location patterns across cemeteries, census neighborhoods, or church rolls.

Informant-reliability: "A specific fact on a record is unreliable because the informant lacked firsthand knowledge." These arise when two sources give conflicting facts traceable to different informants.

Dual-identity: "What appears to be one person is actually two distinct individuals sharing similar identifying information." These arise when a single apparent identity produces contradictory facts that cannot be reconciled by normal data variance.

Adoption/guardianship: "A child with a different surname in a household is a grandchild, orphaned relative, or post-emancipation adoptee rather than a biological child of the head." 

Missing-child: "A person's child who is absent from a census left the household rather than dying, and can be found in a distant location."

Migration-chain: "Multiple family members migrated to the same distant location through a shared pull factor such as employment or kin networks." 

Surname-adoption: "A child listed under one surname in an earlier record later appears under a different surname due to informal adoption or integration into a caretaker's family."

Not-this-person: "A record that appears to match the subject based on name, date, and geography actually belongs to a different individual." 

Church-community: "A person's congregation membership connects them to a specific cemetery, neighborhood, and set of FAN relationships."

Birthplace-as-anchor: "A person found in an unexpected location can be connected to a known family because their record lists a parental birthplace matching the family's origin." 

Hypotheses are stored in a hypotheses table just like the mentions. Some hypotheses in it are generated by the system, and some by the user. The system automatically generates candidate hypotheses at two points; when scoring produces ambiguous-range pairs, and when two assertions for the same person contradict each other.

The hypotheses are shown in a collapsible display panel in the main tree view app that shows hypotheses associated with the person currently being viewed. The panel would have these parts:

Auto-generated hypotheses appear here when the system flags them. The researcher can dismiss, confirm, or add notes. Most system-generated identity hypotheses will be dismissed quickly, but the ones that survive become the researcher's working queue.

Researcher-created hypotheses get added via a small form: pick a type from the dropdown, write the statement, optionally link to assertions already visible on screen.

Linkage to data: Each hypothesis can be linked to one or more assertions or source records as supporting, contradicting, or neutral evidence 

The hypothesis feedback loop

The part that makes this more than a notebook is that resolved hypotheses feed back into the system . When a researcher marks an identity hypothesis as "supported" and adds the confirming evidence, that should increase the confidence score on the corresponding assertion or create the assertion if one didn't exist yet. When they mark one "refuted," the corresponding assertion gets downweighted or removed.

This creates a virtuous cycle: the pipeline generates candidates, the researcher evaluates them, their evaluations improve the data, and the improved data produces better candidates on the next pass. Your labeled-pairs strategy for eventually training logistic regression benefits directly, because every resolved hypothesis is essentially a labeled pair with expert justification attached.



Implementation

The primary interface to the user is a D3 generated family tree diagram that uses cards to represent the people (from the model’s persons table). The cards are nodes in the knowledge graph and they are connected to one another by lines or edges (from the model’s assertions table) that represent their relationships to one another. 



The tree represents what the user believes to be true about their family. Each card is a person the user has asserted exists and has a specific relationship to another person. The tree starts with one card, typically the user themselves, and grows as they click a + button to add parents, spouses, children, and other relatives.

Each card represents a single unique person in the data model. It may not be verified at first, but as the evidence is amassed, it will ultimately be verified as that unique person and indicated by up to four stars on the card that show the confidence level.

For each person added, the system will then search the internal records using the mentions it gleaned from that data and add the evidence it finds to the card’s provenance. 


Whenever a new card with a known or proposed relationship to another person’s card is added:

The user has entered at least some parts of the person’s name, race, and gender (typically inferred by relationship chosen), and the estimated birth_year. Any other information, such as occupation, death_year, etc. will be helpful in identifying the right person.

A new card stub is added to the tree showing the user-entered name and its connection to the parent card with a line representing the asserted relationship. 

The assertion of relationship is added to the assertions table as human generated.

A fuzzy search using the NYSIIS coding of last_name, normalized first_name, birth_year, and Jaro-Winker similarity is posed to the mentions table and used to find local references in the system’s data. Possible matches are stored.

The FamilySearch API is queried with the same fuzzy search information and any possible matches are also stored as possible matches.

The combined possibilities are ranked by their confidences and shown to the user. If the user confirms a match, that person is added to the persons table as outlined in, with the algorithm field set to human and confidence set to 1.0.

If the matched person's row has has_pre_wall_link = true, the wall-pierce indicator appears on the card immediately. The user did not search for the pre-1870 connection, but the system already found it. Clicking on the card’s icon reveals the slave schedule mention, the enslaver's name, and the pre-emancipation household context without the user having to do anything further.

If no match is found, the card remains a stub. The tree structure is preserved, the relationship is recorded, and the system will resurface the stub if a future pipeline run or new source produces a matching record.

Each tree is unique to a user, but the resulting data can be imported to and from other peoples trees if desired. The relationships discovered in one user’s search can be used as evidence in helping identify other people.

The resulting tree is saved to our internal database and can be exported to GEDCOM 5.5.5, RDF turtle format, or directly to FamilySearch through their API. 

