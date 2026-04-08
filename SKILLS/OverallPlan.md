**Verité philosophy**

The basic problem from the researcher’s perspective is: If I know the identity of a person, who are they related to? This starts with parents, but extends to other relatives and relationships. By answering this question iteratively, the family tree can be constructed, so this is the primary research question in the Verité system. The ultimate goal is identification.

One way to establish these relationships is by finding evidence of the people in historical records, such as censuses, slave schedules, vital records, etc.. These primary sources have been transcribed and loaded into the system for analysis. Mentions of people are connected with one another by assertions about their relationship to each other, and people are positively identified by following hypotheses.
Mentions 
Each time a person is identified in a primary source, whether by name, description, a record of that person is added to the system as a mention. A mention merely notes the identification of an individual in a primary source, with no claims about who it may actually be, or their relationship to any other person or organization. 

Mentions are the atomic units that the Verité system is built upon. They contain all the information available about that person, such as names, ages, gender, race, etc. Some mentions may not even have any name associated with them at all. This information is normalized, so we can later compare “apples with apples.” 
Assertions
To connect mentions about people with other people, we create a series of assertions that define that relationship. Assertions take the form where one person, the subject, is connected to another person, the object has a predicate relationship, such as being the father, mother, enslaver, etc.. No assertion exists without a traceable chain back to a primary source.

Some of these relationships can be directly inferred from the primary source data. For example, the 1880 census explicitly identifies the relationship between the head of household and household members. Others are extracted from unstructured statements, such as “Thomas is the son of John.”  using queries to an LLM. An assertion important to true identification of a person is IsSameAs, which asserts that two mentions refer to the same actual person. A sophisticated matching process is used to judge their similarity.
Hypotheses 
Researchers are led through the process by investigating hypotheses inspired by experienced genealogists to use the assertions to identify probable identities and add them to the family tree. This scaffolds the process and provides guidance to choosing the correct evidence that supports that identification. The evidentiary trail is available to defend that identification,
Verité Data Model

**Step 1: Ingest raw data from primary sources**

Sources, such as censuses, slave schedules, church records, etc., that had been saved as tables, and queried data from the FamilySearch API are curated and ingested into the model. No assertion in the system exists without an unbroken chain back to the document it originally is referenced from. 

The data loaded from these is not directly referenced in further steps, but is mediated through the MENTIONS table detailed below and applied to every source document. Each type of source will have its fields interpreted and stored into a mention differently.

This ingest process is performed once for each source document, with the data extracted into the MENTIONS table described in the next step. Even though the phases are described as steps, they are not necessarily done in the order they have been presented after the initial run. They can be called to process new elements as new research, assertions and hypotheses are added.

**The LOCATIONS table**

The LOCATIONS table contains the information about properties where people lived, worked, worshipped, learned, and were buried. These are entered by hand prior to ingesting any source, but as new locations are discovered through the ingestion process, they are added to this table. 

The table’s rows consist of the location’s name, any aliases of that name, owners (if applicable), start_year, end_year of their ownership, and the latitude, longitude of the centroid of the property location and the radius. If there are successive owners, each new group gets a row and the start_year and end_year fields define their tenure.

To map an enslaver’s property, you need to pull from sources designed specifically to track land and wealth, such as the agricultural schedules, county land tax books, confederate engineer maps, and other records. Census records use the location_id from the enumerator. Other types of locations include: “counties”, “districts”, “farms”, “workplaces”, and “schools”. 

**Step 2: Create MENTIONS list**

Mentions provide the link between the raw data found in the various records and the ability to infer relationships between them. The original records are never altered, simply copied into a row in the MENTIONS table.

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
race
gender
occupation
aliases
legal_status: “free” or  “enslaved”
Is_enslaver: “true” or  “”
norm_first_name: resolves abbreviations and nicknames 
nysiis_last_name: phonetic encoding like Soundeex
norm_race: “B” or  “W”
norm_occupation: cluster of 21 basic categories 
location_id
enslaver_id
household _id
family_id

Name aliases / nicknames
If a source exposes a nickname, alias, or alternative names, they are added to the mention's aliases field as comma-separated entities. In the Assertions step, a HasNameVariant assertion is added for each alias, making them searchable in the knowledge graph and available for name matching in the scoring step.

Data from unstructured sources
Deed books, probate records, oral histories, newspapers, runway slave ads, WPA narratives, church records, Find-a-Grave entries, and wills often contain unstructured, narrative text. 

A probate record of John Smith might read:  "I leave to my son Thomas my enslaved woman Hannah and her infant child." From this, many mentions can be automatically extracted using an LLM at ingest time to interpret the text, for example:

John Smith, is_enslaver: TRUE 
Thomas is_enslaver: TRUE, 
Hannah, legal_status: enslaved 
Infant child, legal_status: enslaved

Once all the person mentions are added, they are subsequently referred to by their unique mention_id. Any information that matches one of the mention fields is also added. Hannah's enslaver_id is set to Thomas's mention_id and the Infant's enslaver_id is set to Thomas's mention_id.

These assertions need to be added:

Hannah IsEnslavedBy John Smith, end_year 1858
Infant IsEnslavedBy John Smith, end_year 1858
Hannah IsEnslavedBy Thomas, start_year 1858
Infant IsEnslavedBy Thomas, start_year 1858
Thomas IsChildOf John Smith
Infant IsChildOf Hannah

Data from Censuses 
Because census records are a trusted source of data, information ingested from census records will fit into the standard fields of mention. 

Different years may have more or less information, but all the original data fields can be accessed through the original_data field. 

The location_id is set from the enumeration district in 1880 or the post_office in 1870 for that row queried from the LOCATIONS table.

The 1880 census contains a relationship field that defines the relationship to the head. If the person is not the head of the household, an assertion describing their relationship is added to tie the two together, using their mention_ids.

Data from Slave Schedules
The slave schedules contain information about enslavers and the enslaved, so a pair of mentions is added for each enslaved person row in the schedule. 

The enslaver is added as with is_enslaver: TRUE
The enslaved person is added with enslaver_id is set to the mention_id of the enslaver.

Data from Freed Black Register
These contain additional fields of value, each requiring a new mention row:

relationship is an unstructured field called, which identifies a second person. A mention is added for both people.
An assertion describing their relationship is added to tie the two together, using their mention_ids.
If an alias is listed, that name is added to the person’s aliases field. 

Data from Freedmen's Bureau
Labor contracts name the freedperson and often the former owner. These are unstructured and require LLM extraction. This can uncover enslavers, marriages, education, travel requests, land possession, occupations, family relationships, locations, apprenticeships, indentureships, family separations, court cases, land titles, and physical appearances.

Data from Freedmen's Bank
Freedman's bank records name depositors, their family members, and sometimes their former enslaver. These are unstructured and require LLM extraction. This can uncover enslavers, family relationships, occupation, employment, locations, and military service.

Data from Vital Records
Vital records contain information about birth, deaths and marriages. The birth and death places, maiden names, and parents' names can be gleaned. 

Data from church records
Birth records name the child and often both parents. The location_id is obtained from the LOCATIONS table. A mention is added for each person referenced.

The owner has is_enslaver: TRUE and the person’s enslaver_id is set to their mention_id. An IsMemberOf assertion is added to the ASSERTIONS table.

If parents are referenced, IsChildOf assertions are added to reflect that relationship. The notes field can be parsed with an LLM to extract other field data and may generate other mentions.

Data from birth and death records
Death records name the deceased and sometimes a spouse or parent. A mention is added for each person. The appropriate assertions are added to reflect their relationship.

**Step 3: Create ENSLAVERS list**

The wall-pierce step needs two things to link a resolved person to a pre-1865 record of an enslaved individual: a birth_year range match and an enslaver name match. 

The table is initially created from the slave schedules for 1850 and 1860 and extracts every distinct value in the enslaver_name column across. Other sources include:

Personal Property Tax Records: In Virginia, enslavers were taxed for each person they enslaved above a certain age.

Will Books (Probate Records): These documents often list enslaved people by first name, family groups, and monetary value. The deceased (testator) and the inheritors are all extracted into the enslavers table.

Deed Books: Sales and gifts of enslaved people were recorded in county deed books. The Grantor and Grantee both become entities in the enslavers table.

Freedmen's Bureau Labor Contracts: These often explicitly name the "Former Owner." Extracting these names provides the highest-confidence anchor points for the wall-pierce step.

The 1850 & 1860 Agricultural Schedules lists farms in the order that the enumerator traveled across the county. It provides the total acreage of the farm.

Confederate Engineer Bureau: During the Civil War, the Confederacy commissioned highly detailed topographical maps of Virginia counties. Maps created by Jedediah Hotchkiss explicitly label the locations of prominent plantations, mills, and enslaver residences. These will need to be transcribed using AI or by hand.

County Land Tax Books contain distance and bearing from the county courthouse, plus the nearest waterway. A row might read: Benjamin T. Brown | 800 acres | 14 miles NW | On Moorman's River.

Once added, the enslaver_id is added to the ENSLAVERS table with the same kind of information as is stored for people in the persons table in the persons step. An assertion is then added to the ASSERTIONS table. If the enslaved person is known, add enslaved_person IsEnslavedBy enslaver. 
Step 4: Create post hoc mentions

After all the census mentions have been added, some mentions are updated to reflect changes implied by other mentions, which contain aggregated data.

Households and families 
The system groups the mentions by their household, stored in the mention’s household_id field. These are added by iterating through all the census mentions in any given census. For each mention in that census:

The system creates a new unique household identifier, such as HC1860-123455 when it encounters a new dwelling number.

The system creates a new unique family identifier, such as FC1860-123455 when it encounters a new family number.

For each mention in that census with that dwelling number, that mention’s household_id is set.

For each mention in that census with that family number, that mention’s family_id is set.

Censuses after 1870 have a relationship field so a series of assertions are added to the ASSERTIONS table to reflect those relationships.

Some spousal and parental relationships can be inferred from the age and line placement for earlier censuses.

**Step 5: Create ASSERTIONS list**

This is the heart of the system by creating a list of statements that use mentions to define the connection between people, creating a knowledge graph of RDF encoded statements such as IsChildOf, IsSisterOf, IsSameAs, etc. These are the same kinds of building blocks used in linked-data systems. Assertions are created in two passes of this step. 

The first pass creates the assertions table and adds non-identity assertions. It defines the table structure, the predicate vocabulary, the who field decomposition, and the temporal fields. It then writes all assertions that do not depend on scoring: IsHousemateOf, InFamilyOf, IsNeighborOf, IsEnslavedBy, IsLocatedAt, and any family relationship assertions from Bureau and vital records. 


A second pass occurs immediately after the score similarity step writes any assertions to the assertions table as the first pass. This includes the IsSameAs assertion.

The format for representing these relationships is: 

subject  is the mention_id of the subject person.
object is the mention_id or person the subject has a relationship with, or a string based on the predicate type
predicate is the type of relationship between the subject and object.	
confidence, from 0 to 1, that it is indeed true.
The start_year and end_year define the temporal span.
who is the person or document asserting the relationship. This can be “human”, “inferred”, or some other source.

The predicate vocabulary:

IsSameAs: the same-person link. Produced by the scoring step, consumed by the persons step.
IsNotSameAs: an explicit negative assertion. Useful when two records that look similar have been confirmed by a human as different people. This prevents re-linking them on the next run.
IsChildOf, IsParentOf, IsSpouseOf, IsSiblingOf: all directional. IsChildOf with subject A and object B means A is the child, B is the parent.
IsEnslavedBy: Subject A is the person, object B is the enslaver.
WasEnslavedBy: Subject A is the person, object B is the enslaver.
IsHousemateOf: co-resident in the same household for a specific year.
InFamilyOf: member in the family of head at a specific year.
IsNeighborOf: member of an adjacent household in enumeration order.
HasNameVariant: person mentioned is known by an additional name.
IsLocatedAt: Subject A is a historical mention, Object B is the property_id of a specific physical location.
IsMemberOf: Subject A is the person, Object B is the property_id of a specific

Location changes over time, so there may be many assertions of location for a given person. The system will traverse to the properties table to retrieve the actual latitude and longitude.

For the Enslaved Era: If an IsEnslavedBy assertion is found, it gets the latitude/longitude from the enslaver_id’s listing in the properties table for that time span.

For the Emancipated Era: The system looks at an 1870 census mention for the person. If the person mentioned in the IsNeighborOf assertion has a race of “W”, the system queries the properties table for that year using the neighbor's person_id or name.

End users can confirm or dispute any assertion through the client UI. Their contributions add new assertion rows tagged who: human with a confidence: 1.0. The original assertion is never overwritten and both coexist with disagreement is part of the record. 

Users with FamilySearch accounts can also push confirmed links back to their FS tree via the API.
Step 6: Score similarity 

This step uses matching algorithms to compare two people and assign a similarity confidence score. The score is used to set the confidence value when creating the IsSameAs assertions in the assertions step There are six factors in determining whether two people are actually the same:

Jaro-Winkler string distance on normalized names alongside a comparison of NYSIIS phonetic codes. Jaro-Winkler gives extra weight to matching characters at the start of a string, which matters for names where the first syllable is the most stable part. A pair where both the string distance and phonetic codes agree scores at the top. A pair that only matches phonetically scores in the middle.

birth_year compares uncertainty ranges rather than point estimates. If the two records' birth_year_low to birth_year_high windows overlap, the base score is positive and scales with how close the point estimates are — a gap of zero years scores 1.0, one year scores ~0.92, four years scores ~0.60. If the ranges do not overlap at all, the birth year score is 0.0 regardless of how close the point estimates appear. Non-overlapping ranges mean the records cannot plausibly be the same individual given the uncertainty model.

Household context is the most powerful signal. The scorer retrieves the full households table for each record's household and compares: do the head names match? Do the spouse names match? Are there children in both households whose birth year ranges overlap? A household with a matching head name, matching spouse name, and qat least two overlapping children can contribute up to 30% of the overall confidence — more than name similarity alone. Records without a household_id (non-census sources) receive a neutral 0.5 on this signal rather than 0.0, because absence of household data is not evidence against a match.

race and gender are a binary exact-match signal. Disagreement produces 0.0 and typically eliminates the pair. Agreement produces 1.0. Unknown values on either side produce a neutral score.

Final score is a weighted sum calculated as follows: 

Knockout gates — certain signals short-circuit the whole score to zero regardless of everything else. Gender disagreement is the obvious one. If birth year ranges don't overlap at all, that's also a knockout. No amount of name and household agreement should override a ten-year birth year gap with tight ranges.

Conditional boosts — the weight of a signal shifts based on the informativeness of the context. Here's where it gets interesting for your domain:

Rare name adjustment. Using the Fellegi-Sunter algorithm, compute a frequency weight for each name in the corpus. When the name is rare, boost the name signal weight and reduce household dependence. When the name is common, do the reverse. 

Household availability adjustment. When one or both records lack household data (non-census sources like Freedmen's Bureau individual entries), you can't just score household at 0.5 and move on — you need to redistribute that 30% weight across the remaining signals. Otherwise every non-census comparison is capped at ~70% confidence structurally, which will bias clustering toward census-only identities.

After all the candidates are scored, a second pass adds any assertions to the assertions table just like the first pass in the assertions step. This includes the IsSameAs assertion.

The latitude, longitude, and radius fields are set after the second pass at making the assertions and rely on any connections to properties or the coordinates defined when making any mentions, such as those defined by the enumeration process, such as the enumeration district or post office. 
Step 7: Creating the persons list

This is when records become people. Everything before it produced raw data, normalized fields, household context, and pairwise similarity scores. The persons step reads those scores and makes the leap from "these two records are probably the same person" to "this group of records is one individual."

The step treats evidence assertions as edges in a knowledge graph. Every record row is a node. Every same_person assertion above the confidence threshold is a connection between those two nodes referenced. The step finds all connected components — groups where every node can be reached from every other node through a chain of edges.

Transitivity is the key property. If the 1870 record links to the 1880 record with confidence 0.91, and the 1880 record links to the 1900 record with confidence 0.83, then all three end up in the same cluster, even if the 1870 and 1900 records were never directly compared against each other. 

Once a connected component is identified, the step computes consensus values from all member records to populate the persons row:

display_name is the most complete and most frequently occurring name form. If four records say "eliza goings" and one says "eliza a going", the display name becomes "Eliza Ann Goings" — using the middle initial from the one record that supplied it.

birth_year_est is the median of all birth_year_est values across cluster members. birth_year_range spans from the lowest birth_year_low to the highest birth_year_high across all members.

gender, race, and birth_place are majority values and whichever value appears most often across cluster members wins.

mention_count is the raw count of records in the cluster.

algorithm is the way the person was created, “FamilySearch”, “emergent”, or “human”.

confidence is the average pairwise similarity across all pairs of records in the cluster. This is not the average of the edge scores that were used to build the cluster. It is a fresh computation that measures how internally consistent the full cluster is. A cluster built from five strong pairwise links scores high. A cluster built through transitivity where the ends don't agree closely scores lower and may be flagged.

location uses a two-source approach. Before scoring, the step resolves a coordinate for each mention being compared. It first checks for an IsLocatedAt assertion whose temporal span covers the mention's source_year — if one exists, the linked property's latitude, longitude, and area fields are used. If no property assertion exists, it falls back to the coordinates set on the mention row itself during the mentions step.

After writing the persons row, the step loops through every member record and fills in two fields: person_id is set to the new person's UUID, and resolution_status is set to resolved. Records in an ambiguous cluster get resolution_status: ambiguous. Records that were not claimed by any cluster: no assertions above threshold, or assertions only connecting to disputed clusters keep person_id = null and resolution_status = unresolved.

Every persons row written by the person step has has_pre_wall_link = false and wall_pierce_confidence = null. The person step does not attempt pre-1870 linking. That is entirely the wall-piercing step's responsibility. The person’s step job ends the moment a person row exists with its post-emancipation identity consensus established and all its constituent records stamped.
Step 8: 1870 wall-piercing

It is the mission-critical step of the entire pipeline, the moment where an individual's identity is traced back across the 1870 wall and connected to their existence before emancipation.

Every resolved person from the previous step, the enslavers table built in earlier. The step works person by person. For each person it constructs a candidate set of entries and then scores each candidate.

The step applies three filters in sequence, each reducing the candidate set before scoring begins.

The person's gender must exactly match the schedule entry's gender field. A mismatch eliminates the candidate entirely.

The person's birth_year_low to birth_year_high window must overlap with the schedule entry's birth_year_low to birth_year_high window. The schedule uses ±3 years rather than ±2 because enslaver age estimates were rougher.

The person's nysiis_surname is compared against the NYSIIS field on the enslavers entity linked to that schedule entry via enslaver_mention_id. This should have low valence because it is not very common.

Unlike the scoring step’s six factors, the wall-pierce confidence has no name signal at all. Slave schedules have no names. The score breakdown contains only birth_year overlap, gender, and enslaver surname phonetic match. This structural absence is why wall-pierce confidence scores are inherently lower than census-to-census match score: a 0.74 wall-pierce confidence is a strong result given the constraints, whereas a 0.74 census match would be considered borderline.

Other factors include:

Household co-occurrence: if three people in the same 1870 household all match to entries on the same slave schedule page, that's massively confirmatory. 

Occupation matching: a "blacksmith" in 1870 matching a schedule entry on an enslaver known to have had a forge is weak individually but useful in ensemble.

Freedmen's Bureau records as a bridge: these often name both the freedperson and their former enslaver explicitly, which would let you bypass the probabilistic surname matching entirely for covered individuals.

They're post-emancipation identity records — they mention a named freedperson with age, gender, location, and sometimes family.

They are explicit wall-pierce documents — when they name a former enslaver, they create a direct link that bypasses the wall-pierce step’s probabilistic matching. This is the highest-value contribution.

They're family structure evidence — Bureau marriage records establish spousal links, and labor contracts with family lists establish parent-child relationships. These generate IsSpouseOf, IsChildOf assertions that strengthen your knowledge graph independently of census matching.

If it passes, it fills in person_id on the slave_schedule_records row — the same mechanism the cluster step uses to stamp records rows. This is the moment the anonymous pre-1870 entry is claimed by a named identity.
Step 9: Hypothesis testing

Professional genealogists often form hypotheses around issues they want to explore to root out information and reconcile conflicting data found.

One pattern is: observe an anomaly → form a hypothesis → identify what evidence would resolve it → sometimes find that evidence, sometimes not. Rather than keep this in their head, the system provides a mechanism to scaffold the process, relying on the wealth of primary source information available and the existing assertions. 

Below are a number of common hypothesis types based on the work of professional genealogists. These are derived from detailed research accounts and we are continuing to add new types as they emerge:

Identity: "Person A in record X is the same individual as Person B in record Y." The scoring step already handles this, but surfacing it as an explicit hypothesis lets the researcher attach qualitative reasoning (like "the age is off by 5 years but the neighbors match").

Relationship: "John is Henderson's grandson, not son." These often arise from demographic implausibility and get tested by following the younger person forward in time.

Origin: "Henderson was born in Ohio" vs. "Henderson was born in Albemarle." These get tested by finding corroborating records or by evaluating informant reliability.

Absence: "Henry is missing from the 1860 household because he left home" vs. "Henry is actually J.R. under a different name." 

Succession: "The Henderson who married S.E. Tyre in 1870 is Jr., not Sr." This is exactly the generational confusion that your pipeline needs to handle.

Surname-regime: Person changed across the emancipation boundary because the earlier name was enslaver-assigned.

Community-membership: A group of individuals formed an interconnected post-emancipation community. These arise from co-location patterns across cemeteries, census neighborhoods, or church rolls.

Informant-reliability: "A specific fact on a record is unreliable because the informant lacked firsthand knowledge." These arise when two sources give conflicting facts traceable to different informants.

Dual-identity: "What appears to be one person is actually two distinct individuals sharing similar identifying information." These arise when a single apparent identity produces contradictory facts that cannot be reconciled by normal data variance.

Hypotheses are stored in a hypotheses table just like the assertions. Some hypotheses in it are generated by the system, and some by the user. The system automatically generates candidate hypotheses at two points; when scoring produces ambiguous-range pairs, and when two assertions for the same person contradict each other.

The hypotheses are shown in a collapsible display panel in the main tree view app that shows hypotheses associated with the person currently being viewed. The panel would have these parts:

Auto-generated hypotheses appear here when the system flags them. The researcher can dismiss, confirm, or add notes. Most system-generated identity hypotheses will be dismissed quickly, but the ones that survive become the researcher's working queue.

Researcher-created hypotheses get added via a small form: pick a type from the dropdown, write the statement, optionally link to assertions already visible on screen.

Linkage to data: Each hypothesis can be linked to one or more assertions or source records as supporting, contradicting, or neutral evidence 

The hypothesis feedback loop

The part that makes this more than a notebook is that resolved hypotheses feed back into the system . When a researcher marks an identity hypothesis as "supported" and adds the confirming evidence, that should increase the confidence score on the corresponding assertion or create the assertion if one didn't exist yet. When they mark one "refuted," the corresponding assertion gets downweighted or removed.

This creates a virtuous cycle: the pipeline generates candidates, the researcher evaluates them, their evaluations improve the data, and the improved data produces better candidates on the next pass. Your labeled-pairs strategy for eventually training logistic regression benefits directly, because every resolved hypothesis is essentially a labeled pair with expert justification attached.
