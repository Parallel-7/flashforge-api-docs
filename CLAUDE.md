# CLAUDE.md

## Repository layout — READ THIS FIRST

This project is backed by **two separate git repositories**:

1. **Main repo** (this directory) → `origin` = `https://github.com/Parallel-7/flashforge-api-docs.git`
   - Contains the YAML endpoint specs (`endpoints/`), README, and `.claude/` config.

2. **Wiki repo** → `docs-wiki/` subdirectory → `origin` = `https://github.com/Parallel-7/flashforge-api-docs.wiki.git`
   - This is the GitHub **wiki**, cloned as a nested git repo. Branch is `master` (not `main`).
   - Holds all the `*.md` wiki pages (AD5X, Adventurer series, protocol docs, etc.).

### ⚠️ The `docs-wiki/` directory is gitignored by the main repo

See `.gitignore` line `/docs-wiki`. Because it is ignored, it is **invisible to ordinary `git status` / search from the main repo** and easy to miss.

**When checking repo state or preparing a push, you MUST check BOTH repos:**

```bash
# Main repo
git status
git log --branches --not --remotes --oneline

# Wiki repo — DO NOT FORGET THIS ONE
git -C docs-wiki status
git -C docs-wiki log --branches --not --remotes --oneline
```

Pushing changes for this project frequently means **two pushes**: one in the main repo and one inside `docs-wiki/`. Never report on "the repo" without also inspecting `docs-wiki/`.
