---
name: Assertions Format
description: Format instructions for Assertions
---
	To connect mentions about people with other people, we create a series of assertions that define that relationship. 
	Assertions take the form where one person, the subject, is connected to another person, the object, has a predicate relationship, such as being the father, mother, enslaver, etc.. 
	No assertion exists without a traceable chain back to its primary source.
	Some of these relationships can be directly inferred from the primary source data. 
	For example, the 1880 census explicitly identifies the relationship between the head of household and household members. 
	Others are extracted from unstructured statements, such as “Thomas is the son of John.”  using queries to an LLM. An assertion important to true identification of a person is isSameAs, which asserts that two mentions refer to the same actual person. 
	A sophisticated matching process is later used to judge their similarity.

- The subject is the mention_id of the subject person.
- The object is what person the subject has a relationship with.
- The predicate is the type of the relationship

The predicate vocabulary includes:

	- isSameAs: the same-person link. Produced by the scoring step, consumed by the persons step.
	- isNotSameAs: an explicit negative assertion. 
	- isParentOf, isSpouseOf, isSiblingOf: all directional.
	- wasEnslavedBy: Subject A is the person, object B is the enslaver.
	- isHousemateOf: co-resident in the same household for a specific year.
	- inFamilyOf: member in the family of head at a specific year.
	- isNeighborOf: member of an adjacent household in enumeration order.
	- hasNameVariant: person mentioned is known by an additional name.isLocatedAt: Subject A is a historical mention, Object B is the 

**ASSERTION FORMAT**

	This file is a transcription of the assertions about family relationships, etc 
	It is a table with 8 columns. 
	Each row represents an assertion
	Some fields may be not be present in table.

**Field names and descriptions:**
	
	- The following columns represent information about the enslaved person	 in a row {
		- assertion_id - A unique identifier for the row
		- subject_id - The identifier of the subject of the assertion
		- predicate - The predicate of the assertion
		- object_id - The identifier of the object of the assertion
		- start_year - The start year of the assertion
		- end_year - The end year of the assertion
		- who - The who of the assertion
		- confidence - The confidence of the assertion
		}

**Example rows**

| assertion_id                         | subject_id  | predicate  | object_id | start_year | end_year | who    | confidence |
|--------------------------------------|-------------|------------|-----------|------------|----------|--------|------------|
| 16036e87-8d99-40b2-912b-2f659a2e0c28 | AUG-SB-67.1 | isParentOf | AUG-SB-67 | 1853       |          | AUG-SB | 0.95       |
| 4ea8afd5-264f-4e8f-9933-1fef253e81ca | AUG-SB-96.1 | isParentOf | AUG-SB-96 | 1853       |          | AUG-SB | 0.95       |
| 8e90e00a-51ee-4c6f-8f7a-c7adb4a64723 | AUG-CC-28.1 | isParentOf | AUG-CC-28 | 1866       |          | AUG-CC | 0.95       |
| 49cb464b-4bc6-471a-9936-1521c182e520 | AUG-CC-97.1 | isParentOf | AUG-CC-97 | 1866       |          | AUG-CC | 0.95       |
| 9479d8c6-8356-49fc-b744-1be749862521 | AUG-CC-98.1 | isParentOf | AUG-CC-98 | 1866       |          | AUG-CC | 0.95       |
| 36032e36-82f8-48c8-8d6b-23841aa6f324 | AUG-CC-99.1 | isParentOf | AUG-CC-99 | 1866       |          | AUG-CC | 0.95       || 3 