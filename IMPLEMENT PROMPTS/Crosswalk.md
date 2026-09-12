**PERSISTENT PERSON IDENTIFIER (VERID) — CROSSWALK INGEST**

	Default county = "AUG"

	I want to establish a persistent, stable identifier that identifies a unique person across multiple sources and years. This id is called `verid`, and is added as a new field on the mention table.

	Every mention gets a verid. A mention without one is indistinguishable from a missing record or an ingest failure, so verid is never left null. A mention either inherits a verid from an earlier mention of the same person, or mints its own. Inheritance is preferred; minting is the fallback, never the absence of a value.

	**Scope**

		This spec covers census mentions only (AUG-CN-<year>).

	**verid construction**

		verid = <county>-VP-<century_suffix><line, zero-padded to 6 digits>

		century_suffix is the census year modulo 100, formatted as exactly two
		digits (1850 -> "50", 1870 -> "70", 1900 -> "00", 1910 -> "10").
		Do NOT compute this as census_year - 1800, which produces three digits
		from 1900 onward and breaks the fixed-width guarantee.

		line is the census line number, always padded to exactly 6 digits
		regardless of its natural length, so the year suffix and line number
		occupy fixed, non-overlapping positions and can never be ambiguous.

		Examples:
			1850, line 1234  -> AUG-VP-50001234
			1850, line 234   -> AUG-VP-50000234
			1850, line 50234 -> AUG-VP-50050234
			1900, line 1234  -> AUG-VP-00001234

		Total length after "AUG-VP-" is always exactly 8 characters: 2-digit
		century_suffix + 6-digit zero-padded line. This width must never vary.
		If a line number were ever to exceed 999999, the padding width would
		need to be widened deliberately across the whole scheme, not silently
		overflowed.

		Note: century_suffix collides across centuries (1850 and 1950 both
		yield "50"). This is safe for the current 1850-1940 scope. Ingesting
		1950 or later would require extending the scheme.

	**Ingest order**

		Censuses MUST be ingested in chronological order. Inheritance depends on
		the earlier mention already having a verid; ingesting 1870 before 1860
		will silently cause 1870 mentions to mint instead of inherit.

	**Crosswalk source data**

		Crosswalk assertions are downloaded from a per-county file:

		https://docs.google.com/spreadsheets/d/1OyE2864BiEAfqof6sgS8JC2IADNoXz1T7LOFje_vadw

		Schema: assertion_id, subject_id, predicate, object_id, start_year, end_year, who, confidence

			- subject_id is the mention_id of the earlier census
			- object_id is the mention_id of the later census
			- who identifies the source/method (e.g. CNT, CLP-ABE, MLP-v2, verite-signature)
			- There may be multiple rows referencing the same mention, from
			  different sources or proposing different candidate targets

	**Crosswalk() function** — create in crosswalk.js

		Crosswalk(county, current_year):
			// current_year must always be passed explicitly. No default value.

			// Build the crosswalk index ONCE per run, not once per mention.
			// Key on object_id (the later mention) so each mention in the
			// current year can look up its candidate earlier mentions in O(1).
			crosswalk_index = empty map

			For each row in crosswalk file {
				crosswalk_index[row.object_id].append({ subject_id: row.subject_id, who: row.who })
			}

			For each mention m in the current_year census {

				candidates = crosswalk_index[m.mention_id]   // empty if no links

				If candidates is empty {
					Mint a verid for m using the construction above.
					continue
				}

				grouped = group candidates by subject_id, collecting the who values for each

				If there is exactly one distinct subject_id {
					Inherit: set m.verid to that subject mention's existing verid.
					// Inherit whatever verid the earlier mention holds, regardless
					// of whether that verid was itself inherited or minted. There
					// is no privileged baseline year.
				}

				Else if two or more sources agree on the same subject_id, and it is
				the majority among the candidates {
					Inherit that subject mention's verid.
					Log which sources agreed and which dissented.
				}

				Else {
					// Sources disagree with no majority. The mention is still a
					// person and still gets an identifier; what is contested is
					// whether it is the SAME person as some earlier mention.
					Mint a fresh verid for m using the construction above.
					Write a conflict record (see Resolution below).
					// Do NOT leave verid null. Do NOT pick a default source as
					// a tiebreaker.
				}
			}

	**Resolution**

		Contested links are never resolved during ingest. They are minted as
		independent identities and routed to a conflicts table for later review:

			conflict_id, mention_id, candidate_subject_ids, who_by_candidate,
			current_year, logged_date, status

		status is one of: open, resolved-supersede, resolved-distinct.

		Resolution is an explicit, inspectable post-processing step performed by
		a human, or by a documented source-reliability rule grounded in measured
		precision for this county. Confirming a contested link produces a
		supersede (below). Rejecting it closes the conflict as resolved-distinct
		and the minted verid stands.

		Genuine disagreement between sources is preserved and recorded, never
		silently collapsed.

	**Supersede**

		Minting on unlinked and contested mentions will produce cases where one
		person holds two or more verids — typically when a link to an earlier
		mention is discovered or confirmed after both have been ingested. This is
		expected and is resolved by superseding, not by rewriting history.

		When two verids are found to refer to the same person:

			- The verid anchored at the earlier mention survives.
			- The later verid is retired.
			- A row is written to the supersede table:
				  retired_verid, surviving_verid, reason, who, decided_date
			- Mentions carrying the retired verid are updated to the surviving one.
			- The retired verid is never reused and never deleted, so any external
			  reference to it can still be resolved through the supersede table.

		verid identifies the earliest *known* mention of a person. Discovering an
		earlier mention is normal and triggers a supersede rather than
		invalidating the identifier.

		Superseding is a deliberate, recorded operation. It is never a silent
		side effect of ingest.