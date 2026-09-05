**PERSISTENT PERSON IDENTIFIER (VERID) — CROSSWALK INGEST**

	Default county = "AUG"

	I want to establish a persistent, stable identifier that identifies a unique person across multiple sources and years. This id is called `verid`, and is added as a new field on the mention table.

	**verid construction (1850 baseline mentions only)**

		verid = <county>-VP-<century_suffix><line, zero-padded to 6 digits>

		Where century_suffix is the two-digit suffix of the census year (census_year - 1800), and line is always padded to exactly 6 digits regardless of its natural length, so the year suffix and line number occupy fixed, non-overlapping positions and can never be ambiguous.

		Examples:
			1850, line 1234  -> AUG-VP-50001234
			1850, line 234   -> AUG-VP-50000234
			1850, line 50234 -> AUG-VP-50050234

		Total length after "AUG-VP-" is always exactly 8 characters: 2-digit century_suffix + 6-digit zero-padded line. This width must never vary. If a line number were ever to exceed 999999, the padding width would need to be widened deliberately, not silently overflowed.

		A verid is added for each line in the 1850 census, at ingest. Additional verid's may be added by hand at a later time, for mentions not otherwise covered by this process.

	**verid propagation (all later censuses)**

		For any census after 1850, a mention's verid is not newly minted — it is inherited from an earlier mention of the same person, where a crosswalk source has linked them. A mention with no such link keeps no verid until one is established.

		Resolution of which verid to inherit is NOT decided during ingest. It is a separate, later, inspectable step (see "Resolution," below), so that a genuine disagreement between sources is recorded, never silently overwritten.

	**Crosswalk source data**

		Crosswalk assertions are downloaded from a per-county file, e.g.:

			Augusta: https://docs.google.com/spreadsheets/d/1OyE2864BiEAfqof6sgS8JC2IADNoXz1T7LOFje_vadw

		Schema: assertion_id, subject_id, predicate, object_id, start_year, end_year, who, confidence

			- subject_id is the mention_id of the earlier census
			- object_id is the mention_id of the later census
			- who identifies the source/method (e.g. CNT, CLP-ABE, MLP-v2, verite-signature)
			- There may be multiple subject/object rows referencing the same mention, from different sources or with different candidate targets

	**Crosswalk() function** — create in crosswalk.js

		Crosswalk(county, current_year):

			getYear(mention):
				// Derive year from the mention's own stored source_year field,
				// never by re-parsing the mention_id string.
				return mention.source_year

			If current_year == 1850 {
				For each row in the 1850 census file {
					Assign verid using the fixed-width construction above.
				}
				return
			}

			// For all later years: build the crosswalk index ONCE
			// Maps each later census mention (object_id) back to its earlier mention (subject_id).
			// If an unambiguous link traces back to an 1850 baseline mention, inherit its verid.
			// If there are multiple conflicting candidate targets, do NOT resolve during ingest
			// (leaves verid null) so that disagreements can be inspected and resolved later.

	**Resolution**

		When crosswalk sources provide multiple conflicting candidate links for a mention, or when a mention's verid link needs manual curation, resolution is handled as an explicit, inspectable post-processing step rather than an automatic override during ingest. Genuine disagreement between sources is preserved and recorded.