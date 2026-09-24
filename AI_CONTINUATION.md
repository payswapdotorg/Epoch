# Epoch Stateless Continuation

Fresh-session rule: recover the project from repository state and live GitHub state only.

Current:
- default branch: main
- architecture: E1.0 / Experience X1.0
- work-order schema: WO1.0
- maximum concurrent workers: 3
- current authorized item: W007 (wave 3, single worker — the only READY item; W001-W006 COMPLETE)
- bootstrap baseline: ad76c5c5cdb92cd4ff72b90b663bdce26bb9b3ce
- W001 merge: 1b0d8d240f01de95cc6e269d4ae86471a934f717 (PR #2)
- wave-1 merges: W002 f4a7ffa1 (PR #6), W003 aeabf3b6 (PR #8), W004 d98bb42e (PR #7)
- foundation reconcile 1: 63a7469f125f79dc5125061f0166ae466d411b78 (PR #9)
- wave-2 merges: W005 27a1ab8a (PR #12), W006 b42a0bcc (PR #13)
- foundation reconcile 2: 46f0091713ac688eb8294a45358098f0846f10ae (PR #14, wave-2 lockfile)

After W007 merges, the frontier widens: W008 (Extension SDK + Wasm),
W009 (Tenancy/Identity/Authorization), W010 (Event/Replay/Collaboration),
and W011 (Experience Protocol) all unlock — select up to three with
pairwise-disjoint surfaces (W008/W009/W010 are disjoint; W011 overlaps
none of them either — verify against work-items.md at dispatch time).

docs/LLM-ARCHITECT-HANDOFF.md is the technical takeover summary; it supplements and never overrides the architecture lock, Work Orders, actual Git ancestry, and verified CI/evidence.
