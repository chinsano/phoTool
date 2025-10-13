# Enhancements (EH-XXXX)

Purpose:
- Track non-trivial, optional improvements separate from ADRs (decisions) and the plan (implementation).
- Keep proposals discoverable and scoped for future scheduling.

Process:
- Create a new file `EH-XXXX-<short-title>.md` in this folder.
- Use this lightweight template:
  - Status: Proposed | Accepted | Rejected | Deferred
  - Date: YYYY-MM-DD
  - Context
  - Proposal
  - Scope (In/Out)
  - Architecture / APIs / Data
  - Acceptance criteria
  - Risks / Open questions
  - References
- Keep enhancements independent; when an enhancement is adopted, capture key decisions via an ADR.

Numbering:
- Start at `0001` and increment; zero-padded.

Conventions:
- Filenames: `EH-XXXX-kebab-title.md`.
- Keep each EH short (≤ 2 pages) with links to details/PRs.
