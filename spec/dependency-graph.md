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
W002/W004/W006/W007/W011/W013 -> W026
W002/W003/W006/W007/W011/W013 -> W027
W002/W004/W006/W007/W008 -> W028
W007/W013/W021/W022 -> W029
W008/W009/W020/W021/W022/W023 -> W030
W014/W015/W016/W020/W021/W022/W026/W027/W028/W029 -> W031
W026/W027/W028/W029/W031 -> W032
W032 -> W033
W032/W033 -> W034
W033/W034 -> W035

## Safe concurrent groups
These are examples, not replacement dependencies:
W002|W003|W004
W005|W006
W008|W009
W010|W011
W012|W013
W014|W015|W016
W017|W018|W019

After W019 and as later dependencies resolve, the Tech Lead selects up to three READY items dynamically. No concurrent set may violate a dependency or owned-surface rule.

## No-rebase invariant
Shared contracts are sequenced before consumers. Concurrent workers never edit the same owned path. Root manifests/lockfiles are serial-owned by W001 and later Tech Lead dependency-intake changes.
