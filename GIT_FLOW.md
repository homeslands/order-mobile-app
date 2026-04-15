# Git Flow Guide

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

Run this when a batch of features on `develop` is ready for QA.

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

## 5. Conventional Commits

```
feat(scope):      New feature
fix(scope):       Bug fix
perf(scope):      Performance improvement
refactor(scope):  Refactor without behavior change
chore(scope):     Tooling, config, dependencies
test(scope):      Tests
docs(scope):      Documentation
style(scope):     Formatting only
```

Breaking change — add `!` after scope:
```
feat(auth)!: replace JWT with session tokens
```

---

## Rules

- Never push directly to `main` or `staging`
- Never base feature branches on `staging` or `main`
- Never cherry-pick instead of merging
- Always back-merge hotfix and release branches into `develop`
- Tag every production release on `main`
