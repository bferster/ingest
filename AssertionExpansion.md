The goal is to implement steps of the development plan outlined in @veritePlan.md. 
This is a separate plain vanilla JavaScript web application that is used only by the system administrators. Use async/await throughout; no callback-style code. The overall plan will be implemented in multiple phases. 
Implement only the phase outlines below:

Add a button titled "Expand assertions"
If an "Are you sure?" dialog is positive, expand the assertions as outline below:

###PHASE TASK: EXPAND ASSERTIONS

Implement a post-processing phase that runs after the ingest's first pass of assertion creation completes. It computes the deductive closure of the assertions table — making implicit relationships explicit so downstream scoring and the family-tree UI can rely on a uniform, normalized predicate vocabulary. 

All new assertions added have their who field set to “derived“.
Before inserting any derived assertion, check whether an identical row (same subject, predicate, object_id, who='derived') already exists; skip the insert if so.

## THE FOUR PASSES (run in order, then run pass C again)

**Pass A — Changed (in-place predicate replacement)**

	Replace the predicate with a more generic one -- From → To.  Only one row remains
		{
		isSonOf, isDaughterOf → isChildOf
		isGrandFatherOf, isGrandMotherOf → isGrandParentOf
		isUncleOf, isAuntOf → isPiblingOf 
		isNephewOf, isNieceOf → isNiblingOf
		isStepMotherOf, isStepFatherOf → isStepParentOf
		isStepSonOf, isStepDaughterOf → isStepChildOf
		isStepBrotherOf, isStepSisterOf → isStepSiblingOf
		isSonInLawOf, isDaughterInLawOf → isChildInLawOf
		isGrandFatherInLawOf, isGrandMotherInLawOf → isGrandParentInLawOf
		isUncleInLawOf, isAuntInLawOf → isPiblingInLawOf
		isNephewInLawOf, isNieceInLawOf → isNiblingInLawOf
		}

** Pass B — Identical (additive supertype)**

	The source predicate is kept (it carries gender or specificity information) -- Trigger → Also add. A more-generic supertype assertion is also added 
		{
		isMotherOf, isFatherOf → isParentOf
		isHusbandOf, isWifeOf → isSpouseOf
		isGrandSonOf, isGrandDaughterOf → isGrandChildOf
		isBrotherOf, isSisterOf → isSiblingOf
		isFatherInLawOf, isMotherInLawOf → isParentInLawOf
		isBrotherInLawOf, isSisterInLawOf → isSiblingInLawOf
		isGrandSonInLawOf, isGrandDaughterInLawOf → isGrandChildInLawOf
		}

**Pass C — Inverse (additive mirror)**

	For each assertion `A predicate B` where the object is a person (`object_id IS NOT NULL`), add `B inverse(predicate) A`.

	*Direct relationships -- forward → inverse*
		{
		isParentOf → isChildOf
		isChildOf → isParentOf
		isSpouseOf → isSpouseOf (symmetric)
		isSiblingOf → isSiblingOf (symmetric)
		isGrandParentOf → isGrandChildOf 
		isGrandChildOf → isGrandParentOf
		isPiblingOf → isNiblingOf
		isNiblingOf → isPiblingOf
		isCousinOf → isCousinOf (symmetric)
		}
	*Step relationships -- forward → inverse*
		{
		isStepParentOf → isStepChildOf
		isStepChildOf → isStepParentOf
		isStepSiblingOf → isStepSiblingOf (symmetric)
		}
	*In-law relationships -- forward → inverse*
		{
		isParentInLawOf → isChildInLawOf
		isChildInLawOf → isParentInLawOf
		isSiblingInLawOf → isSiblingInLawOf (symmetric)
		isGrandParentInLawOf → isGrandChildInLawOf
		isGrandChildInLawOf → isGrandParentInLawOf
		isPiblingInLawOf → isNiblingInLawOf
		isNiblingInLawOf → isPiblingInLawOf
		isCousinInLawOf → isCousinInLawOf (symmetric)
		}

	*Gendered originals retained by Pass B also get inverses -- gendered forward → inverse*
		{
		isFatherOf, isMotherOf → isChildOf
		isHusbandOf → isWifeOf
		isWifeOf → isHusbandOf
		isBrotherOf, isSisterOf → isSiblingOf
		isGrandSonOf, isGrandDaughterOf → isGrandParentOf
		isFatherInLawOf, isMotherInLawOf → isChildInLawOf
		isBrotherInLawOf, isSisterInLawOf → isSiblingInLawOf
		}

**Pass D — Transitive / Derived (graph closure, additive)**

	These rules produce relationships not implied by any single source assertion. They run on the normalized, inversed graph from Passes A–C.

	*Blood relationships --rule tag → pattern → new assertion(s)*
		{
		`sibling_from_parent` → `X isChildOf P` ∧ `Y isChildOf P` ∧ `X ≠ Y` → `X isSiblingOf Y` and `Y isSiblingOf X`
		`grandparent_from_parent` → `X isParentOf Y` ∧ `Y isParentOf Z` → `X isGrandParentOf Z`
		`pibling_from_sibling` → `X isSiblingOf Y` ∧ `Y isParentOf Z` → `X isPiblingOf Z`
		`cousin_from_pibling` → `X isPiblingOf Y` ∧ `X isParentOf Z` → `Z isCousinOf Y`
		}
	*Step relationships --rule tag → pattern → new assertion(s)*
		{
		`stepsibling_from_stepparent` → `X isChildOf P` ∧ `Y isStepChildOf P` ∧ `X ≠ Y` → `X isStepSiblingOf Y`
		}
	*In-law relationships --rule tag → pattern → new assertion(s)*
		{
		`child_in_law_from_spouse` → `X isSpouseOf Y` ∧ `Y isChildOf P` → `X isChildInLawOf P` 
		`parent_in_law_from_spouse` → `X isSpouseOf Y` ∧ `Y isParentOf C` → `X isParentInLawOf C`
		`sibling_in_law_from_spouse_sibling` → `X isSpouseOf Y` ∧ `Y isSiblingOf S` → `X isSiblingInLawOf S`
		`sibling_in_law_from_sibling_spouse` → `X isSiblingOf Y` ∧ `Y isSpouseOf S` → `S isSiblingInLawOf X`
		`grandparent_in_law_from_spouse` → `X isSpouseOf Y` ∧ `Y isGrandChildOf G` → `X isGrandChildInLawOf G`
		`grandchild_in_law_from_grandchild_spouse` → `X isGrandParentOf C` ∧ `C isSpouseOf S` → `S isGrandChildInLawOf X`
		`pibling_in_law_from_spouse` → `X isSpouseOf Y` ∧ `P isPiblingOf Y` → `P isPiblingInLawOf X`
		`pibling_in_law_from_pibling_spouse` → `P isPiblingOf Y` ∧ `P isSpouseOf S` → `S isPiblingInLawOf Y`
		`cousin_in_law_from_spouse` → `X isSpou	seOf Y` ∧ `Y isCousinOf C` → `X isCousinInLawOf C`
		`cousin_in_law_from_cousin_spouse` → `X isCousinOf Y` ∧ `Y isSpouseOf S` → `S isCousinInLawOf X`
		}

**Important:** 

	Every rule in Pass D should rely on Pass C inverses already existing, so you do **not** need to write both directions of every rule manually. For example, `sibling_in_law_from_spouse_sibling` produces `X isSiblingInLawOf S`; Pass C's next iteration will then produce the symmetric `S isSiblingInLawOf X` automatically.
	Within this pass D, run rules in the order listed (blood → step → in-law). Within blood, the order matters: sibling_from_parent must run before pibling_from_sibling, which must run before cousin_from_pibling.
	Ensure that all derived assertions inherit the start_year, end_year, and source_id of the source assertions that triggered the rule.


