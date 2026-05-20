# Error log

Operational retries (commands, migrations, config, tooling) that took more than two attempts. Check this file before suggesting similar tactical fixes.

For GSD-tracked work, also record phase-scoped or architectural outcomes in `.planning/phases/*/*-SUMMARY.md` (deviations) or `*-LEARNINGS.md` (decisions, patterns) — see `.claude/developer-profile.md` agent conduct rule 5.

## Entry template

```markdown
### YYYY-MM-DD — Short title

**Context:** What task or area (file, feature, command).

**What didn't work:**
- Attempt 1: …
- Attempt 2: …

**What worked instead:**
- …

**Note for next time:**
- …
```

---

<!-- Add entries below, newest first -->
