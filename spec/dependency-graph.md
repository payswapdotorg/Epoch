# Epoch Dependency Graph

W001 -> W002/W003/W004
W002 -> W005/W006
W003/W005/W006 -> W007
W003/W007 -> W008
W002/W007 -> W009
W002/W003/W009 -> W010
W002/W003/W006/W007 -> W011
W011 -> W012/W013
W009/W011/W012 -> W014
W010/W011/W012 -> W015
W012/W013 -> W016
W014/W015/W016 -> W017/W018
W013/W016 -> W019
W003/W007/W010 -> W020
W005/W007/W020 -> W021
W003/W004/W006/W009/W020 -> W022
W007/W008/W009 -> W023
W009/W023 -> W024
W008/W023/W024 -> W025
W002/W004/W006/W007/W011/W013/W036 -> W026
W002/W003/W006/W007/W011/W013/W036 -> W027
W002/W004/W006/W007/W008 -> W028
W007/W013/W021/W022 -> W029
W008/W009/W020/W021/W022/W023 -> W030
W014/W015/W016/W020/W021/W022/W026/W027/W028/W029 -> W031
W026/W027/W028/W031 -> W032
W032 -> W033
W032/W033 -> W034
W033/W034 -> W035

# Approved successor delivery program (ACR-001)
W002/W003/W004/W006/W009/W010/W011 -> W036
W036/W007/W009 -> W037
W036/W006/W007/W010 -> W038
W037/W038 -> W039
W039/W005/W006 -> W040
W009/W011/W036 -> W041
W007/W010/W036/W041 -> W042
W020/W022/W036/W038 -> W043
W026/W031/W037/W038/W039/W040/W041/W042/W043 -> W044

## Safe concurrency
Examples, never overrides dependencies:
W002|W003|W004
W005|W006
W008|W009
W010|W011
W012|W013
W014|W015|W016
W017|W018|W019
W037|W038|W041
W037|W038|W042
W039|W041|W043

## No-rebase invariant
Shared contracts are sequenced before consumers. Concurrent workers never edit the same owned path. Root manifests/lockfiles are serial-owned by W001 and later Tech Lead dependency-intake changes.


## Universal domain-pack rule
W026/W027 and every future domain pack depend on W036 for the universal lifecycle contracts. They may not proceed with a local lifecycle authority. Domain specialization is validated against `spec/domain-pack-contract.md`.

# ACR-005 Productization Graph

W001-W045 -> W046
W046 -> W047/W048/W049
W047/W048/W049 -> W050

## Safe concurrency

W047 | W048 | W049

W050 is serialized after all three client work orders complete.

## No-rebase invariant

W046 freezes the Application Gateway/client-runtime contract before W047-W049. W047/W048/W049 own disjoint client surfaces. Root manifests/lockfiles remain Tech Lead-owned serial work. W050 is the only cross-platform implementation owner after all three client workers merge.

## Journey invariant

A client Work Order closes only after real-product journey evidence passes and discovered P0/P1 defects are fixed and rerun. W050 closes cross-platform/release defects.

# ACR-006 Public Deployment Graph

W001-W050 (complete) -> ACR-006 -> W051
W051 -> W052/W053/W054
W052 + W053 + W054 -> W055

## Safe concurrency

W052 | W053 | W054 (pairwise-disjoint: web product vs infrastructure adapters vs acquisition adapter + discovery wiring)

W055 is serialized after all three.

## No-rebase invariant

W051 freezes the production environment contract, the RequestGuard port, the adapter package skeletons and the apps/web production binding files before the concurrent wave begins. W052/W053/W054 never edit each other's surfaces or the W051-frozen files. Root manifests/lockfiles are untouched by the entire program (zero-new-dependency rule); any exception is a serialized Tech Lead foundation change.

## Journey invariant

W052 executes the production web journeys against the real deployed site (P01-P18 per spec/journey-validation.md); W055 consolidates and closes. A green source suite alone does not close a deployment work order — the observe → record → reproduce → regression test → fix → rerun loop applies against the deployed product.

## Credential-boundary invariant

Real provider provisioning (Vercel/Neon/R2/Upstash/Apify accounts) requires operator-owned credentials. Work orders deliver all engineering up to that boundary, record honest VERIFIED/NOT-VERIFIED states, and never claim deployment without a real public endpoint.
