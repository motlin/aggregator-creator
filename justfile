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
#   just repo-list motlin --limit 100
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

# Run a complete workflow test demonstrating the full process
workflow-test CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    # Set up test directories
    TEST_DIR="$(mktemp -d -t oclif-workflow-test-XXXXXXXX)"
    REPOS_DIR="${TEST_DIR}/repos"
    VALIDATED_REPOS="${TEST_DIR}/validated-repos"
    FINAL_REPOS="${TEST_DIR}/final-repos"

    echo "🧪 Running workflow test in ${TEST_DIR}"
    echo "📂 Test Directory: ${TEST_DIR}"
    mkdir -p "${REPOS_DIR}" "${VALIDATED_REPOS}" "${FINAL_REPOS}"

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

    echo "Step 1: List repositories using repo:list"
    echo "🔍 Listing repositories for motlin..."
    ./bin/run.js repo:list --user motlin --limit 100 --json > "${TEST_DIR}/repos.json"
    cat "${TEST_DIR}/repos.json" | jq -r '.[].full_name' > "${TEST_DIR}/repos-to-clone.txt"
    echo "📋 Found $(wc -l < "${TEST_DIR}/repos-to-clone.txt") repositories"

    echo "Step 2: Clone repositories using repo:clone"
    echo "📦 Cloning repositories..."
    cat "${TEST_DIR}/repos.json" | ./bin/run.js repo:clone "${REPOS_DIR}"

    echo "Step 3: Validate repositories using repo:validate"
    echo "🔍 Validating Maven repositories..."
    touch "${TEST_DIR}/validated-repos.txt"

    for OWNER_DIR in "${REPOS_DIR}"/*; do
        if [ -d "${OWNER_DIR}" ]; then
            OWNER=$(basename "${OWNER_DIR}")

            for REPO_DIR in "${OWNER_DIR}"/*; do
                if [ -d "${REPO_DIR}" ]; then
                    REPO_NAME=$(basename "${REPO_DIR}")
                    FULL_NAME="${OWNER}/${REPO_NAME}"

                    # Only try to validate repos with pom.xml
                    if [ -f "${REPO_DIR}/pom.xml" ]; then
                        echo "🔍 Validating Maven repository: ${FULL_NAME}"
                        if ./bin/run.js repo:validate "${REPO_DIR}" &> /dev/null; then
                            echo "✅ Validation successful: ${FULL_NAME}"
                            echo "${FULL_NAME}" >> "${TEST_DIR}/validated-repos.txt"

                            # Copy to validated repos dir preserving owner/repo structure
                            mkdir -p "${VALIDATED_REPOS}/${OWNER}"
                            cp -r "${REPO_DIR}" "${VALIDATED_REPOS}/${OWNER}/"
                        else
                            echo "❌ Validation failed: ${FULL_NAME}"
                        fi
                    else
                        echo "⏩ Skipping non-Maven repository: ${FULL_NAME}"
                    fi
                fi
            done
        fi
    done

    # Count validated repos
    VALIDATED_COUNT=$(wc -l < "${TEST_DIR}/validated-repos.txt")
    echo "✅ Found ${VALIDATED_COUNT} validated Maven repositories"

    if [ "${VALIDATED_COUNT}" -gt 0 ]; then
        echo "Step 4: Tag validated repositories using repo:tag"
        echo "🏷️ Adding maven topic to validated repositories..."
        ./bin/run.js repo:tag "${VALIDATED_REPOS}" --topic maven --dry-run

        echo "Step 5: List repositories with maven topic"
        echo "🔍 Listing repositories with maven topic..."
        ./bin/run.js repo:list --user motlin --topic maven --limit 100 --json > "${TEST_DIR}/maven-repos.json"

        echo "Step 6: Clone maven-tagged repositories"
        echo "📦 Cloning maven-tagged repositories..."
        cat "${TEST_DIR}/maven-repos.json" | ./bin/run.js repo:clone "${FINAL_REPOS}"

        echo "Step 7: Create aggregator POM"
        echo "📄 Creating aggregator POM..."
        ./bin/run.js aggregator:create "${FINAL_REPOS}" --groupId org.example --artifactId maven-aggregator

        # Verify the aggregator POM was created
        if [ -f "${FINAL_REPOS}/pom.xml" ]; then
            echo "📄 Successfully created aggregator POM at: ${FINAL_REPOS}/pom.xml"
        else
            echo "⚠️ Aggregator POM was not created as expected"
        fi
    else
        echo "⚠️ No validated Maven repositories found, skipping tagging and aggregator steps"
    fi

    echo ""
    echo "✅ Workflow test completed successfully!"

    # Clean up or preserve test directory based on parameter
    if [ "{{CLEAN}}" = "true" ]; then
        echo "🧹 Cleaning up test directory..."
        rm -rf "${TEST_DIR}"
    else
        echo "📂 Test files preserved at: ${TEST_DIR}"
        echo ""
        echo "🧹 When you're done reviewing, clean up with:"
        echo "rm -rf \"${TEST_DIR}\""
    fi

    echo "🎉 Workflow test finished."

# Run everything
precommit: install build lint-fix format test manifest
    @echo "✅ All checks and steps completed successfully."
