The goal is to implement the ingest and mention steps of the development plan outlined in @veritePlan.md. This is a separate plain vanilla JavaScript web application that is used only by the system administrators. This plan will be implemented in multiple phases. 

Implement only Phase 1 now.

**PHASE 1: INGEST & MENTIONS TASK**

*OVERALL TASK*

The goal is to implement the ingest and mention steps of the development plan outlined in @veritePlan.md. This is a separate plain vanilla JavaScript web application using no frameworks such as REACT. Please generate the index.html and app.js files. Use basic semantic HTML with simple CSS styling for the progress indicator, pulldown menu, and preview table.

Use PapaParse.js to load CSV files, with the header { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }.

This app is used only by the system administrators.

The database is accessed through a REST interface called PostgREST interface installed on the AWS server. It is administered by a server-based app called Adminer which has been installed on the server.

**DATABASE**

PostGreSQL, PostGIS, PostgREST, and Adminer have already been installed on the AWS server using port:5432. PostgREST calls are made to port:3000. Ignore CORS issues for now.  The tables are accessed as GET/POST /mentions, GET /locations, and GET/POST /assertions. For example:

const response = await fetch('http://localhost:3000/mentions'); 
const data = await response.json(); 

**FORMAT and SCHEMA MARKDOWN FILES**

The @schema.md file contains the table schemas for all the tables. 
The @Normalize.md file contains instructions on how to implement NYSIIS, Jaro-Winkler, Fellengi-Sunter, occupation clustering, race normalization, and first name normalization algorithms.
There are markdown files that contain the data format for sources (i.e @1870CensusFormat.md). The format files also contain the directions on how to map the file’s fields to schema of the table, as well as how to find or format any needed data, and how to construct any assertions required. They also contain a number of rows from the source as an example.
Add a pull-down menu to select the source to ingest.

**INGEST PROCESS **

A file containing the sources available is called sources.csv.  Each one will need its own format markdown and translation function, which the ingest process will be routed through. Each row has the following fields {
display_name is what name is shown to choose the source in the pull-down menu.
url is the link to the CSV formatted source file containing data to ingest.
type is the kind of source it is, (i.e. census )..
format is the markdown file used to generate the translation function.
}
When the ingest starts for a file, provide a preview of the first 30 rows of a source file and ask the user to agree to process the rest of the file.

The process for ingesting a source is:
Load @sources.csv file into memory using PapaParse.
Fill the pulldown menu with the display_name values in @source.csv
When the user selects the row {
Load file from into memory from source_url of selected row.
Use papaparse to convert the CSV to JSON.
Use the markdown file in the format field to guide the process
For each row in loaded table {
Show a progress indicator while processing, and log any failed row inserts to the console without halting the entire batch.
To avoid deduplification, check for existing rows with matching original_data and full_name fields before inserting.
Extract the row and add to the original_data field as JSONB.
Ignore fields that are not present is source and transform and or store values 
Using the @Normalize.md file {
NYSIIS encoded last_name into nysiis_last_name.
Normalize first_name into norm_first_name
Normalize occupation into norm_occupation
Normalize race into norm_race
}
Add gender, birth_year, death_year, birth_place, and head.
Translate source specific data based on source type in the data format .md files.
}
Add a new row to the MENTIONS table.
Any assertions needed are specified in the format .md files are created and stored in the ASSERTIONS table.
Some fields require an LLM API call to extract data from unstructured fields. If used, they may spawn new mentions to be added. If an LLM is to be used, stub it out for now. 
}

**POST-HOC MENTIONS**

For each mention that has a source_type of “census” in a MENTIONS table {
Create a new unique household identifier, when it encounters a new dwelling value with the same source_year. Format as HC{source_year}-{dwelling}, i.e. HC1870-123455. 
Create a new unique family identifier, such as when it encounters a new family value for the same source_year. Format as FC{source_year}-{family}, i.e. FC1880-123433. 
For each mention with the same source_year with that dwelling value, that mention’s household_id is set.
For each mention with the same source_year with that family value, that mention’s family_id is set.
Save changed mention to PostgreSQL as an update..
}

**ASSERTIONS**

Assertions are created in two passes. Only the first pass will be implemented in this phase.  It then writes all assertions that do not depend on scoring: isHousemateOf, inFamilyOf, isNeighborOf, wasEnslavedBy, isLocatedAt, and any family relationship assertions from Bureau and vital records. 


The format for representing these relationships is: 

The subject is the mention_id of the subject person.
The object is what person the subject has a relationship with, based on the predicate type:
object_id holds object is an id
object_string if a string 
object_id holds a mention_id if that type of predicate 	
confidence, from 0 to 1, that it is indeed true.
The start_year and end_year define the temporal span.
who is the person or document asserting the relationship. This can be “human”, “inferred”, or some other source.

The predicate vocabulary {
isSameAs: the same-person link. Produced by the scoring step, consumed by the persons step in a later phase.
isNotSameAs: an explicit negative assertion. Useful when two records that look similar have been confirmed by a human as different people. This prevents re-linking them on the next run.
isChildOf, isParentOf, isSpouseOf, isSiblingOf: all directional. isChildOf with subject A and object B means A is the child, B is the parent.
wasEnslavedBy: Subject A is the person, object B is the enslaver.
isHousemateOf: co-resident in the same household for a specific year.
inFamilyOf: member in the family of head at a specific year.
isNeighborOf: member of an adjacent household in enumeration order.
hasNameVariant: person mentioned is known by an additional name.
isLocatedAt: Subject A is a historical mention, Object B is the property_id of a specific physical location.
isMemberOf: Subject A is the person, Object B is the property_id of a specific.
}

If a wasEnslavedBy assertion is found, it gets the latitude/longitude from the enslaver_id’s listing in the LOCATIONS table for that time span
If  an 1870 census mention person has a isNeighborOf assertion and has a race of “W”, the system queries the LOCATIONS table for that year using the neighbor's person_id or name. This will be implemented later.
Plausibility checking:
When the system creates an isChildOf, isParentOf, or isSpouseOf assertion, it already has access to both mentions' birth_year fields.
The plausibility check is a validation gate on those assertions, before writing the row, compute the implied parental age at the child's birth, and if it falls outside plausible bounds, do two things: write the assertion anyway (the evidence is real, even if the interpretation is wrong), but simultaneously write a "Relationship" hypothesis to the hypotheses table flagging the implausibility. This will be implemented later.

