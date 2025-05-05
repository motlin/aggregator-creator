# `just --list --unsorted`
default:
    @just --list --unsorted

# Build project (serves as typecheck)
typecheck: install
    npm run build

# Run eslint
lint: install
    npm run lint

# Run eslint with auto-fixing
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

# `npm run prepack`
manifest: install
    npm run prepack

# `npm test`
test: build
    npm test

# Run repo:list command to list GitHub repositories
repo-list USERNAME LIMIT="10" *FLAGS="": build
    @echo "🔍 Listing GitHub repositories for {{USERNAME}}..."
    ./bin/run.js repo:list --user {{USERNAME}} --limit {{LIMIT}} {{FLAGS}}

# Run all checks, continuing even if some fail
precommit:
    @echo "🔍 Running pre-commit checks..."
    @just build || (echo "❌ Build failed but continuing...")
    @just lint || (echo "❌ Lint failed but continuing...")
    @just format || (echo "❌ Format failed but continuing...")
    @echo "✅ Pre-commit checks completed. Review any errors above."

# Run everything
all: install build lint format test manifest
    @echo "✅ All checks and steps completed successfully."

