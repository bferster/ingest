### PHASE TASK

	The overall goal is to implement steps of the development plan outlined in @veritePlan.md. This is a separate plain vanilla JavaScript web application that is used only by the system administrators. Use async/await throughout; no callback-style code.

	Place code in a phase module titled: assertionExpansion.js with separate functions for each pass and a top-level expandAssertions() orchestrator.

	This plan will be implemented in multiple phases. Implement only the phase below:

	Implement a post-processing phase that runs after the ingest's first pass of assertion creation completes. It computes the deductive closure of the assertions table — making implicit relationships explicit so downstream scoring, narrative generation, and the family-tree UI can rely on a uniform, normalized predicate vocabulary. It normalizes the predicate vocabulary and computes the deductive closure of the assertions table.

	All new assertions added have their who field set to "expanded".

	THE THREE PASSES (run in order: A → B → C → B):	Pass B runs a second time after Pass C so that inverses of newly-derived asymmetric assertions are mirrored.

**Pass A — Ungendering and canonicalization (in-place)**

	Replace gendered or specific predicates with the gender-neutral form. Only one row remains {
		isMotherOf, isFatherOf                          → isParentOf
		isSonOf, isDaughterOf                           → isChildOf
		isHusbandOf, isWifeOf                           → isSpouseOf
		isBrotherOf, isSisterOf                         → isSiblingOf
		isGrandFatherOf, isGrandMotherOf                → isGrandParentOf
		isGrandSonOf, isGrandDaughterOf                 → isGrandChildOf
		isUncleOf, isAuntOf                             → isPiblingOf
		isNephewOf, isNieceOf                           → isNiblingOf
		isStepMotherOf, isStepFatherOf                  → isStepParentOf
		isStepSonOf, isStepDaughterOf                   → isStepChildOf
		isStepBrotherOf, isStepSisterOf                 → isStepSiblingOf
		isFatherInLawOf, isMotherInLawOf                → isParentInLawOf
		isSonInLawOf, isDaughterInLawOf                 → isChildInLawOf
		isBrotherInLawOf, isSisterInLawOf               → isSiblingInLawOf
		isGrandFatherInLawOf, isGrandMotherInLawOf      → isGrandParentInLawOf
		isGrandSonInLawOf, isGrandDaughterInLawOf       → isGrandChildInLawOf
		isUncleInLawOf, isAuntInLawOf                   → isPiblingInLawOf
		isNephewInLawOf, isNieceInLawOf                 → isNiblingInLawOf
		}

	*Symmetric canonicalization*

		After replacement, for any assertion whose predicate is symmetric, swap subject and object_id if subject > object_id. This guarantees one canonical row per pair regardless of the order the source asserted the relationship. 

		The symmetric predicates are: {
			isSpouseOf
			isSiblingOf
			isCousinOf
			isStepSiblingOf
			}

**Pass B — Inverse assertions (asymmetric only)**

	For each assertion A predicate B where the predicate is asymmetric and the object is a person (object_id IS NOT NULL), add B inverse(predicate) A.
		{
		isParentOf              → isChildOf
		isChildOf               → isParentOf
		isGrandParentOf         → isGrandChildOf
		isGrandChildOf          → isGrandParentOf
		isPiblingOf             → isNiblingOf
		isNiblingOf             → isPiblingOf
		isStepParentOf          → isStepChildOf
		isStepChildOf           → isStepParentOf
		}

	Symmetric predicates are NOT mirrored. Their canonical row from Pass A is the only row stored. Queries against symmetric relationships use WHERE X IN (subject, object_id) to find a person's spouses, siblings, cousins, etc.

**Pass C — Transitive (graph closure, additive)**

	Two rules produce relationships not implied by any single source assertion. Run them in the order listed {
		1. sibling_from_parent: X isChildOf P ∧ Y isChildOf P ∧ X ≠ Y → isSiblingOf(min(X,Y), max(X,Y)). Writes in canonical (subject < object_id) form so two children with two shared parents produce one row, not two.
		2. grandparent_from_parent: X isParentOf Y ∧ Y isParentOf Z → X isGrandParentOf Z. Asymmetric — the second run of Pass B mirrors it to Z isGrandChildOf X.
		}

**Final action: Remove duplicate assertions**

	After all passes are complete, remove all duplicate assertions where the subject, object_id,  and predicate values are the same, and the who field is 'expanded'.
