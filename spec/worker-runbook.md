# Worker Runbook

Before coding: read governance, architecture lock, requirements, assigned Work Order, live issue/PR state, exact dispatch base, and run governance check.

Branch: work/W###-short-slug

Rules:
- one Work Order = one branch = one PR;
- write only declared surfaces;
- no governance-state edits in flight;
- no shared lockfile/root-manifest edits in parallel;
- no new dependencies without Tech Lead intake;
- no silent scope expansion;
- tests/evidence for every acceptance criterion;
- remediation on same PR.

PR must state Work Order, dispatch base SHA, final head SHA, owned paths, verification, evidence, limitations, and architecture questions.

Workers never merge.
