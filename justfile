# `just --list --unsorted`
default:
    @just --list --unsorted

# `npm run ci:typecheck`
typecheck: build
    npm run ci:typecheck

# `npm run lint:fix`
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

# Find and validate Maven repositories, then tag them
find-validate-repos CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    # Set up test directories
    TEST_DIR="$(mktemp -d -t oclif-find-validate-XXXXXXXX)"
    REPOS_DIR="${TEST_DIR}/repos"

    echo "🔍 Finding and validating Maven repositories"
    echo "📂 Test Directory: ${TEST_DIR}"
    mkdir -p "${REPOS_DIR}"

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

        echo ""
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
    # Define base command first
    LIST_CMD="./bin/run.js repo:list --user motlin --user liftwizard --language Java --visibility all --limit 100"

    # First, run without --json to show console output
    LIST_CMD_CONSOLE="${LIST_CMD}"
    run_command "1a" "List repositories (console output)" "${LIST_CMD_CONSOLE}"

    # Then run with --json for piping to next command
    LIST_CMD="${LIST_CMD} --json"
    LIST_OUTPUT="${TEST_DIR}/repos.json"

    run_command "1b" "List repositories (JSON output)" "${LIST_CMD}" "> ${LIST_OUTPUT}"
    cat "${LIST_OUTPUT}" | jq -r '.[] | .owner.login + "/" + .name' > "${TEST_DIR}/repos-to-clone.txt"
    echo "📋 Found $(wc -l < "${TEST_DIR}/repos-to-clone.txt") repositories"

    # Step 2: Clone repositories
    CLONE_CMD="./bin/run.js repo:clone"
    CLONE_FULL_CMD="cat ${LIST_OUTPUT} | ${CLONE_CMD} ${REPOS_DIR}"

    run_command "2" "Clone repositories" "${CLONE_FULL_CMD}"

    # Step 3: Validate repositories
    VALIDATE_CMD="./bin/run.js repo:validate"
    VALIDATE_OUTPUT="${TEST_DIR}/validated-repos.json"
    VALIDATE_PARAMS="--output ${TEST_DIR}/validated-repos.txt --json"
    VALIDATE_FULL_CMD="${VALIDATE_CMD} ${REPOS_DIR} ${VALIDATE_PARAMS}"

    run_command "3" "Validate Maven repositories (JSON output)" "${VALIDATE_FULL_CMD}" "> ${VALIDATE_OUTPUT}"

    # Count validated repos for next steps
    VALIDATED_COUNT=$(cat "${VALIDATE_OUTPUT}" | jq '.validCount' || echo 0)

    if [ "${VALIDATED_COUNT}" -gt 0 ]; then
        echo ""
        echo "✅ Found ${VALIDATED_COUNT} valid Maven repositories"

        # Step 4: Tag validated repositories
        TAG_CMD="./bin/run.js repo:tag"
        TAG_PARAMS="--topic maven --yes"
        TAG_FULL_CMD="cat ${VALIDATE_OUTPUT} | ${TAG_CMD} ${TAG_PARAMS}"

        run_command "4" "Tag validated repositories with 'maven' topic (via JSON pipe)" "${TAG_FULL_CMD}"

        echo ""
        echo "🏷️  Successfully tagged ${VALIDATED_COUNT} repositories with 'maven' topic"
    else
        echo ""
        echo "⚠️  No validated Maven repositories found"
    fi

    echo ""
    echo "✅ Find and validate workflow completed!"

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

# Create aggregator from repositories already tagged with 'maven' topic
create-aggregator-from-tagged CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    # Set up test directories
    TEST_DIR="$(mktemp -d -t oclif-create-aggregator-XXXXXXXX)"
    MAVEN_REPOS="${TEST_DIR}/maven-repos"

    echo "🏗️  Creating aggregator from maven-tagged repositories"
    echo "📂 Test Directory: ${TEST_DIR}"
    mkdir -p "${MAVEN_REPOS}"

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

        echo ""
        echo "Step ${step_num}: ${step_desc}"
        if [ -n "$redirect" ]; then
            echo "📋 Manual command: ${cmd} ${redirect}"
            eval "${cmd} ${redirect}"
        else
            echo "📋 Manual command: ${cmd}"
            eval "${cmd}"
        fi
    }

    # Step 1: List repositories with maven topic
    MAVEN_LIST_CMD="./bin/run.js repo:list --user motlin --user liftwizard --topic maven --language Java --visibility public --limit 100 --json"
    MAVEN_LIST_OUTPUT="${TEST_DIR}/maven-repos.json"

    run_command "1" "List repositories with 'maven' topic" "${MAVEN_LIST_CMD}" "> ${MAVEN_LIST_OUTPUT}"

    REPO_COUNT=$(cat "${MAVEN_LIST_OUTPUT}" | jq 'length')
    echo "📋 Found ${REPO_COUNT} repositories tagged with 'maven'"

    if [ "${REPO_COUNT}" -gt 0 ]; then
        # Step 2: Clone maven-tagged repositories
        CLONE_CMD="./bin/run.js repo:clone"
        CLONE_FULL_CMD="cat ${MAVEN_LIST_OUTPUT} | ${CLONE_CMD} ${MAVEN_REPOS}"

        run_command "2" "Clone maven-tagged repositories" "${CLONE_FULL_CMD}"

        # Step 3: Create aggregator POM
        AGGREGATOR_CMD="./bin/run.js aggregator:create"
        AGGREGATOR_PARAMS="--groupId org.example --artifactId maven-aggregator --yes --no-parallel"
        AGGREGATOR_FULL_CMD="${AGGREGATOR_CMD} ${MAVEN_REPOS} ${AGGREGATOR_PARAMS}"

        run_command "3" "Create aggregator POM" "${AGGREGATOR_FULL_CMD}"

        # Verify the aggregator POM was created
        if [ -f "${MAVEN_REPOS}/pom.xml" ]; then
            echo ""
            echo "📄 Successfully created aggregator POM at: ${MAVEN_REPOS}/pom.xml"
            echo ""
            echo "Preview of generated pom.xml:"
            head -20 "${MAVEN_REPOS}/pom.xml"
        else
            echo ""
            echo "⚠️  Aggregator POM was not created as expected"
        fi
    else
        echo ""
        echo "⚠️  No repositories with 'maven' topic found. Run 'just find-validate-repos' first."
    fi

    echo ""
    echo "✅ Create aggregator workflow completed!"

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

# Run a complete workflow test demonstrating the full process
workflow-test CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    echo "🧪 Running complete workflow test"
    echo ""
    echo "This will run both workflows in sequence:"
    echo "1. Find and validate Maven repositories"
    echo "2. Create aggregator from tagged repositories"
    echo ""

    # Run find-validate-repos workflow
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: just find-validate-repos"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    just find-validate-repos "{{CLEAN}}"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: just create-aggregator-from-tagged"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    just create-aggregator-from-tagged "{{CLEAN}}"

    echo ""
    echo "🎉 Complete workflow test finished!"

# Run everything
precommit: build lint-fix format test
    @echo "✅ All checks and steps completed successfully."
