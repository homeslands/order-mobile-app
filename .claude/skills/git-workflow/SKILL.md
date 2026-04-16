---
name: git-workflow
description: Trigger when creating commits, writing commit messages, naming branches, preparing PRs, or resolving merge conflicts. Enforces consistent Git conventions for this project so history stays readable and CI stays green.
---

# Git Workflow

## Branch Hierarchy

```
develop  →  staging  →  main
(lowest)                (production)
```

| Branch | Environment | Purpose |
|--------|-------------|---------|
| `main` | Production — App Store / Play Store | Stable releases only, always tagged |
| `staging` | Pre-prod — TestFlight / Internal Track | QA sign-off before production |
| `develop` | Development — internal builds | Integration branch, base for all features |

---

## Branch Naming

```
feature/<description>        feature/loyalty-points-redemption
bugfix/<description>         bugfix/cart-badge-count-after-clear
hotfix/<version>-<desc>      hotfix/2.2.1-android14-payment-crash
release/<version>            release/2.2.0
```

**Rules:**
- Lowercase, hyphens only — no underscores, no slashes in the description part
- Max 50 characters total
- Feature and bugfix branches → always off `develop`
- Hotfix branches → off `main` only

---

## 1. New Feature

```bash
# Start from latest develop
git checkout develop
git pull origin develop
git checkout -b feature/<description>

# Commit often
git add <files>
git commit -m "feat(scope): description"

# Push and open PR → develop
git push origin feature/<description>
# GitHub: PR feature/<description> → develop
```

After PR is merged into `develop`, delete the feature branch.

---

## 2. Bug Fix (non-urgent)

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/<description>

git commit -m "fix(scope): description"

git push origin bugfix/<description>
# GitHub: PR bugfix/<description> → develop
```

---

## 3. Release to Staging and Production

Run when a batch of features on `develop` is ready for QA.

```bash
# Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/<version>

# Bump version in app.json
git commit -m "chore(release): bump version to <version>"

# Merge to staging for QA
git checkout staging
git pull origin staging
git merge release/<version> --no-ff -m "chore(staging): merge release/<version>"
git push origin staging

# After QA approval — merge to production
git checkout main
git pull origin main
git merge release/<version> --no-ff -m "chore(release): release v<version>"
git push origin main
git tag -a v<version> -m "Release v<version>"
git push origin v<version>

# Back-merge to develop (required — keeps develop in sync)
git checkout develop
git merge release/<version>
git push origin develop

# Clean up
git branch -d release/<version>
git push origin --delete release/<version>
```

---

## 4. Hotfix (urgent production bug)

Branch **from `main`**, not from `develop`.

```bash
git checkout main
git pull origin main
git checkout -b hotfix/<version>-<description>

git commit -m "fix(scope): description"

# Merge to production
git checkout main
git merge hotfix/<version>-<description> --no-ff
git push origin main
git tag -a v<version> -m "Hotfix v<version>"
git push origin v<version>

# REQUIRED: back-merge to develop
git checkout develop
git merge hotfix/<version>-<description>
git push origin develop

# Clean up
git branch -d hotfix/<version>-<description>
git push origin --delete hotfix/<version>-<description>
```

---

## Commit Message Format

Follows **Conventional Commits**:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type | When |
|---|---|
| `feat` | New functionality visible to users |
| `fix` | Bug fix |
| `perf` | Performance improvement (60fps, bundle size) |
| `refactor` | Restructure without behavior change |
| `style` | Formatting, NativeWind class reorder (no logic) |
| `chore` | Dependencies, build config, tooling |
| `test` | Add or fix tests |
| `docs` | CLAUDE.md, README, comments only |
| `revert` | Revert a previous commit |

Breaking change — add `!` after scope:
```
feat(auth)!: replace JWT with session tokens
```

### Scopes (use project domain names)

Common scopes: `cart`, `menu`, `order-flow`, `payment`, `auth`, `profile`, `navigation`, `home`, `gift-card`, `notification`, `i18n`, `deps`, `ci`

### Summary line rules
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removing"
- Max 72 characters
- No period at end
- No capital first letter after the colon

```
✅ feat(cart): add voucher application bottom sheet
✅ fix(auth): prevent double token refresh on 401
✅ perf(home): memoize banner carousel render item

❌ feat(cart): Added voucher sheet.   ← past tense + period
❌ fix: fixed the bug                 ← no scope, vague
❌ FEAT(CART): ADD VOUCHER            ← wrong case
```

### Body (when to add)

Add a body when the **why** isn't obvious from the summary:

```
perf(menu): replace FlatList with FlashList for category list

FlatList caused visible frame drops on mid-range Android when
scrolling categories with 30+ items. FlashList with
estimatedItemSize=80 brings scroll to consistent 60fps.

Tested on: Samsung A32, Pixel 6, iPhone 13
```

---

## Pre-commit Checklist

Before every commit, verify:

```bash
npm run check          # typecheck + lint — must pass clean
npm run format         # Prettier — auto-fixes class order
```

**Never commit with:**
- `console.log` in TS/TSX files (hook will block it)
- `--no-verify` flag (hook will block it)
- TypeScript errors (`npm run typecheck` must exit 0)
- ESLint errors (`npm run lint` must exit 0)
- Hardcoded secrets or API keys

---

## PR Conventions

### Title
Same format as commit: `feat(cart): add voucher bottom sheet`

### PR body template

```markdown
## What
Brief description of the change.

## Why
Motivation — bug report, performance issue, feature request.

## How
Key implementation decisions (especially non-obvious ones).

## Test plan
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Tested dark mode
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No lint errors (`npm run lint`)

## Screenshots (if UI change)
| Before | After |
|---|---|
| screenshot | screenshot |
```

### PR rules
- **One concern per PR** — mix of feat + refactor = split into two PRs
- Keep PRs under 400 lines changed when possible
- Self-review before requesting review: read your own diff
- PR target: always `develop` (never directly to `staging` or `main`)

---

## Merge Strategy

- **Squash merge** for feature/bugfix branches into `develop`
- **Merge commit** (`--no-ff`) for release and hotfix branches to preserve traceability
- **Never force-push** to `main`, `staging`, or `develop`
- Delete branch after merge

---

## Conflict Resolution

```bash
# Rebase onto develop before merging (preferred)
git fetch origin
git rebase origin/develop

# Resolve conflicts in each file, then:
git add <resolved-files>
git rebase --continue

# If rebase is too complex:
git rebase --abort
# → use merge instead, document in PR body why
```

**Never resolve conflicts by accepting all-theirs or all-ours blindly** — read both sides.

---

## Rules

- Never push directly to `main`, `staging`, or `develop`
- Never base feature branches on `staging` or `main`
- Never cherry-pick instead of merging
- Always back-merge hotfix and release branches into `develop`
- Tag every production release on `main`

---

## Common Mistakes

| ❌ Don't | ✅ Do |
|---|---|
| `git commit -m "fix stuff"` | Use conventional commit format |
| Branch feature from `main` or `staging` | Always branch from `develop` |
| Commit directly to `main` | Always use a feature branch |
| `git push --force` on shared branches | Use `--force-with-lease` only if needed |
| Commit `node_modules/`, `.env.local` | Verify `.gitignore` covers them |
| Mix formatting + logic in one commit | Split into separate commits |
| Leave `console.log` in committed code | Remove before committing |
