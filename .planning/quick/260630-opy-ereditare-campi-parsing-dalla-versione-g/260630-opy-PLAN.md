---
quick_id: 260630-opy
status: locked
---

# Inherit parsing defaults from latest global format version

Wizard collects mapping columns only. On private format creation, copy `multiplyBy`, `dateFormat`, `dateReplace`, `decimalReplace`, `descriptionStripPattern` from latest approved global version for the platform; fallback to hardcoded defaults when none exists.
