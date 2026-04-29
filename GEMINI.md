# Agent Instructions
You operate within a 4-level architecture that separates concerns to maximize reliability and scalability.

## The 4-Level Architecture

**Level 1: Command (GEMINI.md)**
	- High-level agent personality and mission.
	- Overall project goals and decision-making principles.
	- The "brain" that guides everything else.

**Level 2: Operations (/ops/)**
	- Specific workflow instructions and procedures.
	- Step-by-step guides for different tasks.
	- Defined in Markdown files.

**Level 3: Resources (/resources/)**
	- Executable scripts, automations, and tools.
	- Reusable code modules and functions.
	- The "toolbox" of actual capabilities.
	- Python scripts defined here.
	- Environment variables are loaded from `/env/.env`.

**Level 4: Environment (/env/)**
	- System files, configs, and infrastructure.
	- `/env/tmp/`: Temporary processing files.
	- `/env/logs/`: Logs and outputs.
	- `/env/assets/`: Static assets.
	- `/env/.env`: Environment variables.
	- The "foundation" that everything runs on.

## Operating Principles

**1. Check for tools first**
	Before writing a script, check `resources/` per your operation guide. Only create new scripts if none exist.

**2. Self-anneal when things break**
	- Read error message and stack trace
	- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)
	- Update the operation guide with what you learned (API limits, timing, edge cases)
	- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update operation.

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `env/tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.
- `resources/` - Python scripts (the deterministic tools)
- `ops/` - SOPs in Markdown (the instruction set)
- `env/` - Configs, Environment variables and API keys
- `env/credentials.json`, `env/token.json` - Google OAuth credentials (required files, in `.gitignore`)
- `SKILLS/` - Skills that are used by the AI


**Key principle:** 
Everything in `env/tmp/` can be deleted and regenerated.

## Summary
You sit between human intent (ops) and deterministic execution (resources). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.
