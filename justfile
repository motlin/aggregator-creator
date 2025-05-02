# `just --list --unsorted`
default:
    @just --list --unsorted

# `npm run typecheck`
typecheck: install
    npm run typecheck

# `npm run lint`
lint: install
    npm run lint

# `npm run lint:fix`
lint-fix: install
    npm run lint:fix

# `npx prettier --write ...`
format: install
    npx prettier --write "**/*.{json,yaml,yml,md}"

# `npm install`
install:
    npm install

# `npm run build`
build: install
    npm run build

# Run repo:list command to list GitHub repositories
repo-list USERNAME LIMIT="10": build
    @echo "🔍 Listing GitHub repositories for {{USERNAME}}..."
    ./bin/run.js repo:list --user {{USERNAME}} --limit {{LIMIT}}

# Run repo:list command with JSON output
repo-list-json USERNAME LIMIT="10": build
    @echo "🔍 Listing GitHub repositories for {{USERNAME}} as JSON..."
    ./bin/run.js repo:list --user {{USERNAME}} --limit {{LIMIT}} --json

# Run all checks, continuing even if some fail
precommit:
    @echo "🔍 Running pre-commit checks..."
    @just typecheck || (echo "❌ Typecheck failed but continuing...")
    @just lint-fix || (echo "❌ Lint-fix failed but continuing...")
    @just format || (echo "❌ Format failed but continuing...")
    @echo "✅ Pre-commit checks completed. Review any errors above."