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

# `npm run format`
format: install
    npm run format

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
# Examples:
#   just repo-list motlin
#   just repo-list motlin --limit 10
#   just repo-list motlin --language Java
#   just repo-list motlin --topic maven
#
# Short flag alternatives:
#   -l = --limit
#   -g = --language
#   -t = --topic
#   -u = --user
repo-list USERNAME *FLAGS="": build
    @echo "🔍 Listing GitHub repositories for {{USERNAME}}..."
    ./bin/run.js repo:list --user {{USERNAME}} {{FLAGS}}

# Run everything
precommit: install build lint-fix format test manifest
    @echo "✅ All checks and steps completed successfully."
