**DATABASE SCHEMA**

The following SQL commands define the schema for the various tables needed:

	CREATE TABLE locations (
		location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
		location GEOGRAPHY(Point, 4326), 
		latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
		longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
		radius SMALLINT, 
		acres INTEGER,
		start_year SMALLINT, 
		end_year SMALLINT,
		name VARCHAR(255),
		alias VARCHAR(255),
		owner_mention_id UUID,
		owner_name VARCHAR(255),
		location_type VARCHAR(50) CHECK (location_type IN (
             'county','district','farm','workplace','school',
             'church','cemetery','other')),
		description VARCHAR(255),
		confidence REAL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

	CREATE TABLE mentions (
		mention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		source VARCHAR(100),
		source_type VARCHAR(100), 
		source_year SMALLINT, 
		source_line SMALLINT, 
		original_data JSONB NOT NULL DEFAULT '{}'::jsonb,
		confidence REAL,
		
		full_name VARCHAR(255),
		first_name VARCHAR(100),
		middle_name VARCHAR(100),
		last_name VARCHAR(100),
		maiden_name VARCHAR(100),
		birth_year SMALLINT,
		death_year SMALLINT,
		race VARCHAR(1) CHECK (race IN ('B','M','W','C','I','Y','')),
		gender VARCHAR(1) CHECK (gender IN ('M','F')),
		occupation VARCHAR(100),
		aliases VARCHAR(255),
		legal_status VARCHAR(100),
		is_enslaver BOOLEAN NOT NULL DEFAULT FALSE,

		norm_first_name VARCHAR(100),
		nysiis_last_name VARCHAR(100), 
		norm_race VARCHAR(1) CHECK (norm_race IN ('B','W')),
		norm_occupation VARCHAR(100),

		enslaver_id UUID REFERENCES mentions(mention_id),
		location_id UUID REFERENCES locations(location_id),
		household_id VARCHAR(50),	
		family_id VARCHAR(50),
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

	ALTER TABLE locations 
		ADD CONSTRAINT fk_owner FOREIGN KEY (owner_mention_id) 
		REFERENCES mentions(mention_id);

	CREATE INDEX idx_mentions_original_data ON mentions USING GIN (original_data);

	CREATE TABLE assertions (
		assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		subject_id UUID NOT NULL REFERENCES mentions(mention_id),
		predicate VARCHAR(100) NOT NULL,
		object_id UUID REFERENCES mentions(mention_id),   -- when object is a mention
		object_string VARCHAR(255),                       -- when object is a string
		start_year SMALLINT,
		end_year SMALLINT,
		who VARCHAR(100),
		confidence REAL CHECK (confidence BETWEEN 0 AND 1),
		source_id UUID,  -- traceability back to originating mention or document
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		CHECK (object_id IS NOT NULL OR object_string IS NOT NULL)
		);

	CREATE TABLE persons (
		person_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		display_name VARCHAR(255),
		first_name VARCHAR(100),
		last_name VARCHAR(100),
		birth_year_est SMALLINT,
		birth_year_low SMALLINT,
		birth_year_high SMALLINT,
		death_year_est SMALLINT,
		gender VARCHAR(1) CHECK (gender IN ('M','F')),
		race VARCHAR(1) CHECK (race IN ('B','M','W','C','I','Y')),
		birth_place VARCHAR(255),
		mention_count INTEGER DEFAULT 0,
		algorithm VARCHAR(20) CHECK (algorithm IN ('emergent','FamilySearch','human')),
		has_pre_wall_link BOOLEAN NOT NULL DEFAULT FALSE,
		wall_pierce_confidence REAL,
		confidence REAL CHECK (confidence BETWEEN 0 AND 1),
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

	CREATE TABLE hypotheses (
		hypothesis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		confidence REAL, 
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

