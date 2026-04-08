**DATABASE SCHEMA**

The following SQL commands define the schema for the various tables needed:

	CREATE TABLE mentions (
		mention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		source VARCHAR(100),
		source_type VARCHAR(100), 
		source_year SMALLINT, 
		source_line SMALLINT, 
		original_data JSONB NOT NULL '{}',
		confidence REAL,
		
		full_name VARCHAR(255),
		first_name VARCHAR(100),
		middle_name VARCHAR(100),
		last_name VARCHAR(100),
		maiden_name VARCHAR(100),
		birth_year SMALLINT,
		death_year SMALLINT,
		race VARCHAR(1) CHECK (race IN ('B','M','W','C','I','Y')),
		gender VARCHAR(1) CHECK (gender IN ('M','F')),
		occupation VARCHAR(100),
		aliases VARCHAR(255),
		legal_status VARCHAR(100),
		is_enslaver BOOLEAN NOT NULL DEFAULT FALSE,

		norm_first_name VARCHAR(100),
		nysiis_last_name VARCHAR(100), 
		norm_race VARCHAR(1) CHECK (norm_race IN ('B','W')),
		norm_occupation VARCHAR(100),

		location_id UUID,  
		enslaver_id UUID,
		household_id UUID,
		family_id UUID,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

	CREATE INDEX mentionsGIN mentions USING GIN (original_data);

	CREATE TABLE locations (
		location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
		location GEOGRAPHY(Point, 4326), 
		latitude DOUBLE PRECISION, 
		longitude DOUBLE PRECISION, 
		radius SMALLINT, 
		acres SMALLINT,
		start_year SMALLINT, 
		end_year SMALLINT,
		name VARCHAR(100),
		alias VARCHAR(255),
		owner VARCHAR(100),
		location_type VARCHAR(100),
		description VARCHAR(255),
		confidence REAL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

	CREATE TABLE assertions (
		assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		subject_id UUID, 
		predicate VARCHAR(100),
		object VARCHAR(255),
		start_year SMALLINT, 
		end_year SMALLINT,
		who VARCHAR(100),
		confidence REAL, 
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

	CREATE TABLE enslavers (
		enslaver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		confidence REAL, 
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

	CREATE TABLE persons (
		person_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		confidence REAL, 
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

	CREATE TABLE hypotheses (
		hypothesis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		confidence REAL, 
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		);

