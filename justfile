# `just --list --unsorted`
[group('default')]
default:
    @just --list --unsorted

ci := env("CI", "")

# Install dependencies
[group('setup')]
install:
    vp install
    vp fmt --no-error-on-unmatched-pattern CLAUDE.md

# Run linter
[group('dev')]
lint: install
    vp lint {{ if ci != "" { "--format github" } else { "--fix" } }}

# Run formatter
[group('dev')]
format: install
    vp fmt {{ if ci != "" { "--check" } else { "" } }}

# Run checks (format + lint + typecheck)
[group('dev')]
check: install
    vp check {{ if ci != "" { "" } else { "--fix" } }}

# Run tests
# Package-qualified task name avoids colliding with vp's built-in `test` task.
[group('dev')]
test *args: install
    CHAI_TRUNCATE_THRESHOLD=0 vp run aggregator-creator#test:run {{args}}

# Type-check the project
[group('dev')]
typecheck: install
    vp run typecheck

# Build the project
[group('dev')]
build: install
    vp run build

# `npm run prepack`
[group('dev')]
manifest: install
    vp run prepack

# Run fallow codebase intelligence (dead code, duplication, drift)
[group('dev')]
fallow: install
    vp run {{ if ci != "" { "fallow:ci" } else { "fallow" } }}

# Run pre-commit hooks on all files (same as CI's pre-commit job)
[group('dev')]
pre-commit: install
    pre-commit run --all-files

# Run all pre-commit checks
[arg("quick", long, value="true", help="Skip tests")]
[group('dev')]
precommit quick="": check build manifest fallow pre-commit
    {{ if quick != "true" { "just test" } else { "true" } }}
    @echo "All pre-commit checks passed!"

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
#   -o = --owner
[group('integration-test')]
repo-list OWNER *FLAGS="": build
    @echo "🔍 Listing GitHub repositories for {{OWNER}}..."
    ./bin/run.js repo:list --owner {{OWNER}} {{FLAGS}}

# Find and validate Maven repositories, then topic them
[group('integration-test')]
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
    LIST_CMD="./bin/run.js repo:list --owner motlin --owner liftwizard --language Java --visibility all --limit 100"

    # First, run without --json to show console output
    LIST_CMD_CONSOLE="${LIST_CMD}"
    run_command "1a" "List repositories (console output)" "${LIST_CMD_CONSOLE}"

    # Then run with --json for piping to next command
    LIST_CMD="${LIST_CMD} --json"
    LIST_OUTPUT="${TEST_DIR}/repos.json"

    run_command "1b" "List repositories (JSON output)" "${LIST_CMD}" "> ${LIST_OUTPUT}"
    cat "${LIST_OUTPUT}" | jq -r '.[] | .owner.login + "/" + .name' > "${TEST_DIR}/repos-to-clone.txt"
    echo "📋 Found $(wc -l < "${TEST_DIR}/repos-to-clone.txt") repositories"

    # Step 2: Process each repository individually using repo:process
    echo ""
    echo "Step 2: Process repositories (clone, validate, topic)"
    echo "📋 Manual command: cat ${LIST_OUTPUT} | jq -c '.[]' | while read repo; do echo \"\$repo\" | ./bin/run.js repo:process ${REPOS_DIR} --topic maven --json; done"

    # Store results for summary
    RESULTS_FILE="${TEST_DIR}/process-results.jsonl"
    > "${RESULTS_FILE}"

    # Process each repository
    cat "${LIST_OUTPUT}" | jq -c '.[]' | while read repo; do
        REPO_NAME=$(echo "$repo" | jq -r '.name')
        REPO_OWNER=$(echo "$repo" | jq -r '.owner.login')

        echo ""
        echo "🔄 Processing ${REPO_OWNER}/${REPO_NAME}..."

        # Run repo:process and capture the result
        if RESULT=$(echo "$repo" | ./bin/run.js repo:process "${REPOS_DIR}" --topic maven --json 2>&1); then
            # Save result to file
            echo "$RESULT" >> "${RESULTS_FILE}"

            # Parse the JSON result
            if echo "$RESULT" | jq -e '.valid == true' > /dev/null 2>&1; then
                if echo "$RESULT" | jq -e '.topicAdded == true' > /dev/null 2>&1; then
                    echo "  ✅ Valid Maven repository - topiced with 'maven'"
                else
                    echo "  ✅ Valid Maven repository - already topiced"
                fi
            else
                echo "  ❌ Not a valid Maven repository"
            fi
        else
            echo "  ❌ Failed to process repository"
            # Save error result
            echo '{"valid": false, "error": "Failed to process"}' >> "${RESULTS_FILE}"
        fi
    done

    # Calculate summary from results file
    TOTAL_COUNT=$(wc -l < "${RESULTS_FILE}")
    VALID_COUNT=$(cat "${RESULTS_FILE}" | jq -r 'select(.valid == true)' | wc -l)
    TOPICED_COUNT=$(cat "${RESULTS_FILE}" | jq -r 'select(.valid == true and .topicAdded == true)' | wc -l)

    echo ""
    echo "📊 Summary:"
    echo "  - Total repositories processed: ${TOTAL_COUNT}"
    echo "  - Valid Maven repositories: ${VALID_COUNT}"
    echo "  - Repositories topiced: ${TOPICED_COUNT}"

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

# Create aggregator from repositories already topiced with 'maven' topic
[group('integration-test')]
create-aggregator-from-topiced CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    # Set up test directories
    TEST_DIR="$(mktemp -d -t oclif-create-aggregator-XXXXXXXX)"
    MAVEN_REPOS="${TEST_DIR}/maven-repos"

    echo "🏗️  Creating aggregator from maven-topiced repositories"
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
    MAVEN_LIST_CMD="./bin/run.js repo:list --owner motlin --owner liftwizard --topic maven --language Java --visibility public --limit 100 --exclude-topic jni --json"
    MAVEN_LIST_OUTPUT="${TEST_DIR}/maven-repos.json"

    run_command "1" "List repositories with 'maven' topic" "${MAVEN_LIST_CMD}" "> ${MAVEN_LIST_OUTPUT}"

    REPO_COUNT=$(cat "${MAVEN_LIST_OUTPUT}" | jq 'length')
    echo "📋 Found ${REPO_COUNT} repositories topiced with 'maven'"

    if [ "${REPO_COUNT}" -gt 0 ]; then
        # Step 2: Clone maven-topiced repositories
        echo ""
        echo "Step 2: Clone maven-topiced repositories"
        echo "📋 Manual command: cat ${MAVEN_LIST_OUTPUT} | jq -c '.[]' | while read repo_json; do echo \"\$repo_json\" | ./bin/run.js repo:clone --output-directory ${MAVEN_REPOS}; done"

        # Clone each repository
        cat "${MAVEN_LIST_OUTPUT}" | jq -c '.[]' | while read repo_json; do
            REPO_NAME=$(echo "$repo_json" | jq -r '.name')
            REPO_OWNER=$(echo "$repo_json" | jq -r '.owner.login')
            echo "📥 Cloning ${REPO_OWNER}/${REPO_NAME}..."
            echo "$repo_json" | ./bin/run.js repo:clone --output-directory "${MAVEN_REPOS}"
        done

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
[group('integration-test')]
workflow-test CLEAN="true": build
    #!/usr/bin/env bash
    set -e

    echo "🧪 Running complete workflow test"
    echo ""
    echo "This will run both workflows in sequence:"
    echo "1. Find and validate Maven repositories"
    echo "2. Create aggregator from topiced repositories"
    echo ""

    # Run find-validate-repos workflow
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: just find-validate-repos"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    just find-validate-repos "{{CLEAN}}"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: just create-aggregator-from-topiced"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    just create-aggregator-from-topiced "{{CLEAN}}"

    echo ""
    echo "🎉 Complete workflow test finished!"
