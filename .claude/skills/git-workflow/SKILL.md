---
name: git-workflow
description: Trigger when creating commits, writing commit messages, naming branches, preparing PRs, or resolving merge conflicts. Enforces consistent Git conventions for this project so history stays readable and CI stays green.
---

# Git Workflow

## Branch Naming

```
<type>/<short-description>

feat/add-loyalty-point-hub
fix/cart-quantity-update-flicker
perf/flashlist-menu-estimatedItemSize
refactor/order-flow-store-split
chore/upgrade-reanimated-4.1
```

| Prefix | When to use |
|---|---|
| `feat/` | New feature or screen |
| `fix/` | Bug fix |
| `perf/` | Performance improvement |
| `refactor/` | Code restructure with no behavior change |
| `chore/` | Dependency updates, config, tooling |
| `hotfix/` | Urgent production fix |

**Rules:**
- Lowercase, hyphens only — no underscores, no slashes in the description part
- Max 50 characters total
- Branch off `main` unless it's a hotfix on a release branch

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

### Scopes (use project domain names)

```
feat(cart): add swipe-to-delete for cart items
fix(auth): handle token refresh race condition
perf(menu): add estimatedItemSize to FlashList
refactor(order-flow): split store into pricing and items slices
chore(deps): upgrade reanimated to 4.1.3
```

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

### Footer

```
# Breaking change
BREAKING CHANGE: useOrderFlowStore shape changed — selectors updated

# Issue reference
Closes #142
Refs #138
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
- Tag relevant areas: `[cart]`, `[perf]`, `[auth]` in the title if cross-cutting
- Self-review before requesting review: read your own diff

---

## Merge Strategy

- **Squash merge** for feature branches (clean, linear history on `main`)
- **Merge commit** only for release branches or hotfixes that need traceability
- **Never force-push to `main`**
- Delete branch after merge

---

## Conflict Resolution

```bash
# Rebase onto main before merging (preferred over merge commit)
git fetch origin
git rebase origin/main

# Resolve conflicts in each file, then:
git add <resolved-files>
git rebase --continue

# If rebase is too complex:
git rebase --abort
# → use merge instead, document in PR body why
```

**Never resolve conflicts by accepting all-theirs or all-ours blindly** — read both sides.

---

## Common Mistakes

| ❌ Don't | ✅ Do |
|---|---|
| `git commit -m "fix stuff"` | Use conventional commit format |
| Commit directly to `main` | Always use a feature branch |
| `git push --force` on shared branches | Use `--force-with-lease` only if needed |
| Commit `node_modules/`, `.env.local` | Verify `.gitignore` covers them |
| Mix formatting + logic in one commit | Split into separate commits |
| Leave `console.log` in committed code | Remove before committing |
