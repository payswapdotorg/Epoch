# Epoch Stateless Continuation

Fresh-session rule: recover the project from repository state and live GitHub state only.

Current:
- default branch: main
- architecture: E1.0 / Experience X1.0
- work-order schema: WO1.0
- maximum concurrent workers: 3
- current authorized items: W008 + W009 + W011 (wave 4, three workers, pairwise-disjoint surfaces; W001-W007 COMPLETE)
- bootstrap baseline: ad76c5c5cdb92cd4ff72b90b663bdce26bb9b3ce
- W001 merge: 1b0d8d240f01de95cc6e269d4ae86471a934f717 (PR #2)
- wave-1 merges: W002 f4a7ffa1 (PR #6), W003 aeabf3b6 (PR #8), W004 d98bb42e (PR #7)
- foundation reconcile 1: 63a7469f125f79dc5125061f0166ae466d411b78 (PR #9)
- wave-2 merges: W005 27a1ab8a (PR #12), W006 b42a0bcc (PR #13)
- foundation reconcile 2: 46f0091713ac688eb8294a45358098f0846f10ae (PR #14, wave-2 lockfile)
- W007 merge: 000fcdd78dd13b7c4ebec4b127ccfe7d0c0ae263 (PR #16; reviewed head 01b59838)
- foundation reconcile 3: 5a5a1e24915b51a4b49ce7ef3036d10af6ae558b (PR #17, wave-3 lockfile)

After the wave-4 merges, the frontier widens again: W010 unlocks when
W009 lands; W012 (Experience Compiler) and W013 (Renderer Runtime)
unlock when W011 lands; W014/W015/W016 unlock later per
work-items.md. Always re-derive READY items from the dependency graph
and keep pairwise-disjoint surfaces (verify against work-items.md at
dispatch time). Budget a work/foundation-* lockfile reconcile after
every package-adding wave.

docs/LLM-ARCHITECT-HANDOFF.md is the technical takeover summary; it supplements and never overrides the architecture lock, Work Orders, actual Git ancestry, and verified CI/evidence.
