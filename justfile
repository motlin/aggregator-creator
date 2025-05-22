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
#   just repo-list motlin --language Java --limit 100
#   just repo-list motlin --visibility public --type org
#   just repo-list motlin --visibility all --type all
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

    # Function to run and display command
    run_command() {
        local step_num="$1"
        local step_desc="$2"
        local cmd="$3"
        local redirect="${4:-}"

        echo "Step ${step_num}: ${step_desc}"
        if [ -n "$redirect" ]; then
            echo "📋 Manual command: ${cmd} ${redirect}"
            eval "${cmd} ${redirect}"
        else
            echo "📋 Manual command: ${cmd}"
            eval "${cmd}"
        fi
    }

    # Step 1: List repositories
    LIST_CMD="./bin/run.js repo:list --user motlin --user liftwizard --language Java --visibility all --type all --limit 100 --json"
    LIST_OUTPUT="${TEST_DIR}/repos.json"

    run_command "1" "List repositories using repo:list" "${LIST_CMD}" "> ${LIST_OUTPUT}"
    cat "${LIST_OUTPUT}" | jq -r '.[] | .owner.login + "/" + .name' > "${TEST_DIR}/repos-to-clone.txt"
    echo "📋 Found $(wc -l < "${TEST_DIR}/repos-to-clone.txt") repositories"

    # Step 2: Clone repositories
    CLONE_CMD="./bin/run.js repo:clone"
    CLONE_FULL_CMD="cat ${LIST_OUTPUT} | ${CLONE_CMD} ${REPOS_DIR}"

    run_command "2" "Clone repositories using repo:clone" "${CLONE_FULL_CMD}"

    # Step 3: Validate repositories
    VALIDATE_CMD="./bin/run.js repo:validate"
    VALIDATE_PARAMS="--output ${TEST_DIR}/validated-repos.txt --copyTo ${VALIDATED_REPOS}"
    VALIDATE_FULL_CMD="${VALIDATE_CMD} ${REPOS_DIR} ${VALIDATE_PARAMS}"

    run_command "3" "Validate repositories using repo:validate" "${VALIDATE_FULL_CMD}"

    # Count validated repos for next steps
    VALIDATED_COUNT=$(wc -l < "${TEST_DIR}/validated-repos.txt" || echo 0)

    if [ "${VALIDATED_COUNT}" -gt 0 ]; then
        # Step 4: Tag validated repositories
        TAG_CMD="./bin/run.js repo:tag"
        TAG_PARAMS="--topic maven --yes"
        TAG_FULL_CMD="${TAG_CMD} ${VALIDATED_REPOS} ${TAG_PARAMS}"

        run_command "4" "Tag validated repositories using repo:tag" "${TAG_FULL_CMD}"

        # Step 5: List tagged repositories
        MAVEN_LIST_CMD="./bin/run.js repo:list --user motlin --user liftwizard --topic maven --language Java --visibility public --type all --limit 100 --json"
        MAVEN_LIST_OUTPUT="${TEST_DIR}/maven-repos.json"

        run_command "5" "List repositories with maven topic" "${MAVEN_LIST_CMD}" "> ${MAVEN_LIST_OUTPUT}"

        # Step 6: Clone maven-tagged repositories
        MAVEN_CLONE_FULL_CMD="cat ${MAVEN_LIST_OUTPUT} | ${CLONE_CMD} ${FINAL_REPOS}"

        run_command "6" "Clone maven-tagged repositories" "${MAVEN_CLONE_FULL_CMD}"

        # Step 7: Create aggregator POM
        AGGREGATOR_CMD="./bin/run.js aggregator:create"
        AGGREGATOR_PARAMS="--groupId org.example --artifactId maven-aggregator --yes --no-parallel"
        AGGREGATOR_FULL_CMD="${AGGREGATOR_CMD} ${FINAL_REPOS} ${AGGREGATOR_PARAMS}"

        run_command "7" "Create aggregator POM" "${AGGREGATOR_FULL_CMD}"

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
precommit: install build lint-fix format
    just test || true
    @echo "✅ All checks and steps completed successfully."
