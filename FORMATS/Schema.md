**DATABASE SCHEMA**

// ssh -i "C:\Bill\CC\js\StageToolsKey.pem" -L 3000:127.0.0.1:3000 -L 5432:127.0.0.1:5432 bitnami@52.70.208.176 -N
// NOTIFY pgrst, 'reload schema';

The following SQL commands define the schema for the various tables needed:

**DDL**

	CREATE TABLE mentions (
		mention_id      VARCHAR(50) PRIMARY KEY,
		verid           VARCHAR(50),
		source          VARCHAR(100) NOT NULL,
		source_year     SMALLINT,
		confidence      REAL CHECK (confidence BETWEEN 0 AND 1),
		full_name       VARCHAR(255),
		first_name      VARCHAR(100),
		middle_name     VARCHAR(100),
		last_name       VARCHAR(100),
		birth_year      SMALLINT,
		death_year      SMALLINT,
		birth_place     VARCHAR(255),
		race            VARCHAR(1) CHECK (race IS NULL OR race IN ('B','M','W','C','I','Y','')),
		gender          VARCHAR(1) CHECK (gender IS NULL OR gender IN ('M','F','')),
		occupation      VARCHAR(100),
		legal_status    VARCHAR(1) CHECK (legal_status IS NULL OR legal_status IN ('E','F','H','')),
		norm_first_name      VARCHAR(100),
		nysiis_last_name     VARCHAR(100),
		metaphone_last_name  VARCHAR(100),
		norm_race            VARCHAR(1) CHECK (norm_race IS NULL OR norm_race IN ('B','W','')),
		norm_occupation      VARCHAR(100),
		head            BOOLEAN,
		household_id    VARCHAR(50),
		family_id       VARCHAR(50),
		data            JSONB
		);

	-- One person is enumerated at most once per census year.
	CREATE UNIQUE INDEX ux_mentions_verid_year
		ON mentions (verid, source_year)
		WHERE verid IS NOT NULL AND verid <> '';

	CREATE INDEX ix_mentions_verid        ON mentions (verid);
	CREATE INDEX ix_mentions_source_year  ON mentions (source, source_year);
	CREATE INDEX ix_mentions_family       ON mentions (family_id);
	CREATE INDEX ix_mentions_household    ON mentions (household_id);
	CREATE INDEX ix_mentions_nysiis       ON mentions (nysiis_last_name, norm_first_name);


	CREATE TABLE assertions (
		assertion_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		subject_id    VARCHAR(50) NOT NULL REFERENCES mentions(mention_id),
		predicate     VARCHAR(100) NOT NULL,
		object_id     VARCHAR(50) REFERENCES mentions(mention_id),
		start_year    SMALLINT,
		end_year      SMALLINT,
		who           VARCHAR(100) NOT NULL,
		confidence    REAL CHECK (confidence BETWEEN 0 AND 1),

		CONSTRAINT ck_predicate CHECK (predicate IN (
			-- identity
			'isSameAs','isNotSameAs',
			-- core kinship
			'isParentOf','isChildOf','isSpouseOf','isSiblingOf',
			-- extended kinship (in data and/or emitted by expansion)
			'isGrandParentOf','isGrandChildOf',
			'isPiblingOf','isNiblingOf','isCousinOf',
			'isStepParentOf','isStepChildOf','isStepSiblingOf',
			'isParentInLawOf','isChildInLawOf','isSiblingInLawOf',
			'isGrandParentInLawOf','isGrandChildInLawOf',
			'isPiblingInLawOf','isNiblingInLawOf',
			-- bondage
			'wasEnslavedBy',
			-- co-residence / place
			'isHousemateOf','inFamilyOf','isNeighborOf',
			'hasNameVariant','isLocatedAt','isMemberOf'
			))
		-- NOTE: gendered forms (isMotherOf, isWifeOf, isNephewOf, ...) are
		-- deliberately excluded. AssertionExpansion.md Pass A rewrites them to
		-- the neutral form, but Pass A runs after ingest, so any source that
		-- writes a gendered predicate would be rejected at insert. No current
		-- source does. If one is added, either map at ingest or admit the
		-- gendered forms here.
		);

	-- The dedupe rule. One row per source per claim.
	CREATE UNIQUE INDEX ux_assertions_claim
		ON assertions (subject_id, predicate, object_id, who);

	CREATE INDEX ix_assertions_subject ON assertions (subject_id, predicate);
	CREATE INDEX ix_assertions_object  ON assertions (object_id, predicate);
	CREATE INDEX ix_assertions_years   ON assertions (start_year, end_year);


	-- One row per distinct link, with agreement made explicit.
	CREATE VIEW assertion_links AS
		SELECT
			subject_id,
			predicate,
			object_id,
			MIN(start_year)            AS start_year,
			MAX(end_year)              AS end_year,
			COUNT(DISTINCT who) FILTER (WHERE who <> 'expanded')
			                           AS support_count,
			ARRAY_AGG(DISTINCT who ORDER BY who) AS sources,
			BOOL_OR(who = 'expanded')  AS is_derived,
			MAX(confidence)            AS max_source_confidence
		FROM assertions
		GROUP BY subject_id, predicate, object_id;

	-- support_count excludes who = 'expanded'. AssertionExpansion.md writes
	-- derived rows with that marker; counting them would let the system's own
	-- deduction masquerade as independent corroboration from a second source.

	-- Pass A rewrites symmetric assertions in place so that subject < object.
	-- Where a source asserted both directions that rewrite collides with
	-- ux_assertions_claim. No current source does, but the update must be
	-- written ON CONFLICT DO NOTHING followed by a delete of the loser, not as
	-- a bare UPDATE.


	CREATE TABLE hypotheses (
		hypothesis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		confidence    REAL CHECK (confidence BETWEEN 0 AND 1),
		created       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);


	CREATE TABLE conflicts (
		conflict_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		mention_id   VARCHAR(50) NOT NULL REFERENCES mentions(mention_id),
		candidate_subject_ids JSONB,
		who_by_candidate      JSONB,
		current_year SMALLINT,
		logged_date  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		status       VARCHAR(50) DEFAULT 'open' CHECK (status IN
		               ('open','resolved-supersede','resolved-distinct'))
		);


	CREATE TABLE supersede (
		supersede_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		retired_verid   VARCHAR(50) NOT NULL,
		surviving_verid VARCHAR(50) NOT NULL,
		reason          TEXT,
		who             VARCHAR(100),
		decided_date    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
