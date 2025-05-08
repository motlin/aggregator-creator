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

# Run a manual smoke test with real repositories
smoke-test CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    # Set up test directories
    TEST_DIR="$(mktemp -d -t oclif-smoke-test-XXXXXXXX)"
    REPOS_DIR="${TEST_DIR}/repos"
    MAVEN_DIRS="${TEST_DIR}/maven-repos"
    AGGREGATOR_DIR="${TEST_DIR}/aggregator"

    echo "🧪 Running smoke test in ${TEST_DIR}"
    echo "📂 Test Directory: ${TEST_DIR}"
    mkdir -p "${REPOS_DIR}" "${MAVEN_DIRS}" "${AGGREGATOR_DIR}"

    # Validate GitHub CLI is available
    if ! command -v gh &> /dev/null; then
        echo "❌ GitHub CLI (gh) not installed. Please install it from https://cli.github.com/"
        rm -rf "${TEST_DIR}"
        exit 1
    fi

    # Check if authenticated with GitHub
    if ! gh auth status &> /dev/null; then
        echo "❌ Not authenticated with GitHub. Please run 'gh auth login' first."
        rm -rf "${TEST_DIR}"
        exit 1
    fi

    echo "Step 1: Testing repo:list"
    echo "🔍 Listing repositories for motlin..."
    ./bin/run.js repo:list -u motlin -l 100 > "${TEST_DIR}/list-output.txt"

    echo "Step 2: Testing repo:clone"
    echo "📦 Cloning repositories..."
    cat "${TEST_DIR}/list-output.txt" | grep -E "^- [^/]+/[^/]+" | sed 's/^- \([^/]*\/[^( ]*\).*/\1/' > "${TEST_DIR}/repos-to-clone.txt"
    cat "${TEST_DIR}/repos-to-clone.txt" | ./bin/run.js repo:clone "${REPOS_DIR}"

    echo "Step 3: Testing repo:tag"
    echo "🏷️ Tagging repositories with dry-run..."
    ./bin/run.js repo:tag "${REPOS_DIR}" -t maven -d

    echo "Step 4: Testing repo:validate"
    echo "🔍 Finding Maven repositories..."
    MAVEN_COUNT=0

    # Look only for repositories with pom.xml directly at their root
    # This handles the repository structure from repo:clone which creates owner/repo directories
    for OWNER_DIR in "${REPOS_DIR}"/*; do
        if [ -d "${OWNER_DIR}" ]; then
            OWNER=$(basename "${OWNER_DIR}")

            for REPO_DIR in "${OWNER_DIR}"/*; do
                if [ -d "${REPO_DIR}" ]; then
                    REPO_NAME=$(basename "${REPO_DIR}")
                    # Check if pom.xml exists at the root of this repository
                    if [ -f "${REPO_DIR}/pom.xml" ]; then
                        echo "✅ Found Maven repository: ${OWNER}/${REPO_NAME}"
                        # Create directory with the repo name only
                        mkdir -p "${MAVEN_DIRS}/${REPO_NAME}"
                        cp -r "${REPO_DIR}/." "${MAVEN_DIRS}/${REPO_NAME}"
                        MAVEN_COUNT=$((MAVEN_COUNT + 1))
                    fi
                fi
            done
        fi
    done

    # Validate at least one Maven repo was found
    if [ "$(ls -A "${MAVEN_DIRS}")" ]; then
        echo "✅ Found ${MAVEN_COUNT} Maven repositories for validation"

        # Validate each Maven repository
        for MAVEN_REPO in "${MAVEN_DIRS}"/*; do
            if [ -d "${MAVEN_REPO}" ]; then
                REPO_NAME=$(basename "${MAVEN_REPO}")
                echo "🔍 Validating Maven repository: ${REPO_NAME}"

                # Skip actual validation if Maven isn't installed
                if command -v mvn &> /dev/null; then
                    ./bin/run.js repo:validate "${MAVEN_REPO}" || echo "⚠️ Validation failed for ${REPO_NAME} but continuing test"
                else
                    echo "⚠️ Maven not installed, skipping actual validation"
                fi
            fi
        done
    else
        echo "⚠️ No Maven repositories found for validation"
    fi

    echo "Step 5: Testing aggregator:create"
    echo "📦 Creating aggregator..."
    ./bin/run.js aggregator:create "${MAVEN_DIRS}" -g com.example -a maven-aggregator

    echo ""
    echo "✅ All smoke tests completed successfully!"

    # Check the value of CLEAN parameter to determine cleanup behavior
    if [ "{{CLEAN}}" = "true" ]; then
        echo "🧹 Cleaning up test directory..."
        rm -rf "${TEST_DIR}"
    else
        echo "🔍 Generated POM file is at: ${MAVEN_DIRS}/pom.xml"
        echo "📂 Test files preserved at: ${TEST_DIR}"
        echo ""
        echo "🧹 When you're done reviewing, clean up with:"
        echo "rm -rf \"${TEST_DIR}\""
    fi

    echo "🎉 Smoke test finished."

# Run everything
precommit: install build lint-fix format test manifest
    @echo "✅ All checks and steps completed successfully."
