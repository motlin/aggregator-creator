# aggregator-creator

CLI tool that creates Maven aggregator POMs from a set of repositories. Maven aggregators combine multiple Maven projects into a single build, allowing you to compile and test related modules together.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) [![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-24292e.svg)](https://github.com/motlin/aggregator-creator)

<!-- toc -->
* [aggregator-creator](#aggregator-creator)
* [Overview](#overview)
* [Environment Setup](#environment-setup)
* [Usage](#usage)
* [Complete Workflow](#complete-workflow)
* [Process repositories individually](#process-repositories-individually)
* [Then create the aggregator](#then-create-the-aggregator)
* [Run the workflow test](#run-the-workflow-test)
* [Run workflow test and keep temporary files](#run-workflow-test-and-keep-temporary-files)
* [Use exit codes to filter - only process repositories that validate successfully](#use-exit-codes-to-filter---only-process-repositories-that-validate-successfully)
* [Clone all repositories but only topic Java repositories](#clone-all-repositories-but-only-topic-java-repositories)
* [See what would be topiced without making changes](#see-what-would-be-topiced-without-making-changes)
* [Directory Structure](#directory-structure)
* [License](#license)
* [Commands](#commands)
<!-- tocstop -->

# Overview

The aggregator-creator CLI tool helps you manage Maven repositories and create Maven aggregator POMs:

1. Find Maven repositories on GitHub using various filters
2. Clone repositories to your local machine
3. Validate which repositories contain valid Maven projects
4. Topic repositories on GitHub to categorize them
5. Create a Maven aggregator POM that combines multiple repositories

This tool is especially useful for organizations with modular projects that need to be built together.

# Environment Setup

The project uses [mise](https://mise.jdx.dev/) to manage development dependencies. All required tools are installed automatically when you run commands through the project's justfile.

# Usage

The aggregator-creator CLI provides commands for managing repositories and creating aggregator POMs. All commands follow the pattern:

```sh
./bin/run.js COMMAND [ARGUMENTS] [FLAGS]
```

The main command groups include:

**Single Repository Commands:**

- `repo:clone` - Clone a single GitHub repository
- `repo:validate` - Validate a single Maven repository
- `repo:topic` - Topic a single GitHub repository with a topic
- `repo:process` - Process a single repository (clone, validate, and topic)

**Multiple Repository Commands:**

- `repo:list` - Find GitHub repositories matching specific criteria

**Aggregator Commands:**

- `aggregator:create` - Generate a Maven aggregator POM from a directory of repositories

For detailed usage information on each command, see the [Commands](#commands) section below.

# Complete Workflow

There are two approaches to process repositories:

## Processing Repositories

Use `repo:process` to handle each repository individually:

1. **Find repositories:** Use `repo:list` to find repositories with specific criteria
2. **Process each repository:** Pipe each repository to `repo:process` which handles cloning, validation, and topicing
3. **Create aggregator:** Use `aggregator:create` to generate an aggregator POM from the processed repositories

Example:

```bash
# Process repositories individually
./bin/run.js repo:list --owner motlin --language Java --json | jq -c '.[]' | while read repo; do
  echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json
done

# Then create the aggregator
./bin/run.js aggregator:create ./repos --groupId org.example
```

You can run this complete workflow with:

```sh
# Run the workflow test
just workflow-test

# Run workflow test and keep temporary files
just workflow-test false
```

## Command Composition

The single-repository commands can be composed in various ways for different use cases:

### Process only valid Maven repositories

```bash
# Use exit codes to filter - only process repositories that validate successfully
./bin/run.js repo:list --owner motlin --json | jq -c '.[]' | while read repo; do
  if echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json 2>/dev/null; then
    echo "Processed valid repository"
  fi
done
```

### Selective processing with custom logic

```bash
# Clone all repositories but only topic Java repositories
./bin/run.js repo:list --owner motlin --json | jq -c '.[]' | while read repo; do
  REPO_NAME=$(echo "$repo" | jq -r '.name')
  REPO_OWNER=$(echo "$repo" | jq -r '.owner.login')
  LANGUAGE=$(echo "$repo" | jq -r '.language // empty')

  # Always clone
  echo "$repo" | ./bin/run.js repo:clone --output-directory ./repos

  # Validate
  if ./bin/run.js repo:validate "./repos/$REPO_OWNER/$REPO_NAME"; then
    # Only topic if it's a Java repository
    if [ "$LANGUAGE" = "Java" ]; then
      ./bin/run.js repo:topic --owner "$REPO_OWNER" --name "$REPO_NAME" --topic maven
    fi
  fi
done
```

### Dry run to preview changes

```bash
# See what would be topiced without making changes
./bin/run.js repo:list --owner motlin --topic java --json | jq -c '.[]' | while read repo; do
  echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --dryRun --json
done | jq -s 'map(select(.valid == true))'
```

# Directory Structure

The aggregator-creator CLI expects and creates specific directory structures for different operations:

- **For cloning repositories:** Creates an `owner/repo` directory structure

    ```
    target-directory/
    ├── owner1/
    │   ├── repo1/
    │   └── repo2/
    └── owner2/
        └── repo3/
    ```

- **For validating repositories:** Expects either a single repository or an `owner/repo` structure

    ```
    repos-directory/
    ├── owner1/
    │   ├── repo1/  # Must contain pom.xml to be valid
    │   └── repo2/
    └── owner2/
        └── repo3/
    ```

- **For creating an aggregator:** Creates a pom.xml in the specified directory
    ```
    maven-repos/
    ├── pom.xml  # Created aggregator POM
    ├── owner1/
    │   ├── repo1/
    │   └── repo2/
    └── owner2/
        └── repo3/
    ```

# License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

# Commands

<!-- commands -->
* [`aggregator aggregator create [DIRECTORY]`](#aggregator-aggregator-create-directory)
* [`aggregator help [COMMAND]`](#aggregator-help-command)
* [`aggregator repo clone`](#aggregator-repo-clone)
* [`aggregator repo list`](#aggregator-repo-list)
* [`aggregator repo process OUTPUT-DIRECTORY`](#aggregator-repo-process-output-directory)
* [`aggregator repo topic`](#aggregator-repo-topic)
* [`aggregator repo validate REPOPATH`](#aggregator-repo-validate-repopath)

## `aggregator aggregator create [DIRECTORY]`

Create Maven aggregator POM from a directory of repositories

```
USAGE
  $ aggregator aggregator create [DIRECTORY] [--json] [-g <value>] [-a <value>] [-v <value>] [-y] [--parallel]
    [--rewriteDependencies]

ARGUMENTS
  DIRECTORY  Directory containing final Maven repos (or omit to read from stdin)

FLAGS
  -a, --artifactId=<value>        [default: aggregator] ArtifactId for aggregator POM
  -g, --groupId=<value>           [default: com.example] GroupId for aggregator POM
  -v, --pomVersion=<value>        [default: 1.0.0-SNAPSHOT] Version for aggregator POM
  -y, --yes                       Automatically answer "yes" to all prompts
      --[no-]parallel             Enable parallel processing
      --[no-]rewriteDependencies  Rewrite child pom dependencies to use versions from dependencyManagement

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create Maven aggregator POM from a directory of repositories

EXAMPLES
  $ aggregator aggregator create ./maven-repos

  $ aggregator aggregator create ./maven-repos --groupId org.example

  $ aggregator aggregator create ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0

  $ aggregator aggregator create ./maven-repos --force

  $ aggregator aggregator create ./maven-repos --json

  $ aggregator aggregator create ./maven-repos --no-rewrite-dependencies

  $ aggregator repo:list --owner someuser --json | aggregator aggregator create ./output-dir
```

_See code: [src/commands/aggregator/create.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/aggregator/create.ts)_

## `aggregator help [COMMAND]`

Display help for aggregator.

```
USAGE
  $ aggregator help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for aggregator.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.33/src/commands/help.ts)_

## `aggregator repo clone`

Clone a single GitHub repository

```
USAGE
  $ aggregator repo clone --output-directory <value> [--json] [-o <value>] [-n <value>]

FLAGS
  -n, --name=<value>              Repository name (required when not using stdin)
  -o, --owner=<value>             GitHub username or organization (required when not using stdin)
      --output-directory=<value>  (required) Directory where the repository will be cloned

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Clone a single GitHub repository

EXAMPLES
  $ aggregator repo clone --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner

  echo '{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}' | aggregator repo clone --output-directory ./repos

  $ aggregator repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | aggregator repo clone --output-directory ./repos
```

_See code: [src/commands/repo/clone.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/clone.ts)_

## `aggregator repo list`

List GitHub repositories based on filters

```
USAGE
  $ aggregator repo list [--json] [-o <value>...] [-t <value>...] [-x <value>...] [-g <value>...]
    [--include-forks] [--include-archived] [--visibility public|private|all] [-l <value>]

FLAGS
  -g, --language=<value>...       Language filter
  -l, --limit=<value>             Max repositories
  -o, --owner=<value>...          GitHub username/org to filter by
  -t, --topic=<value>...          Topic filter
  -x, --exclude-topic=<value>...  Exclude repositories with this topic
      --include-archived          Include archived repositories
      --include-forks             Include forked repositories
      --visibility=<option>       [default: public] Repository visibility filter
                                  <options: public|private|all>

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List GitHub repositories based on filters

EXAMPLES
  $ aggregator repo list --limit 100

  $ aggregator repo list --owner motlin --limit 100

  $ aggregator repo list --owner motlin --owner liftwizard --limit 100

  $ aggregator repo list --owner motlin --language Java --limit 100

  $ aggregator repo list --owner motlin --topic maven --language Java --json

  $ aggregator repo list --owner motlin --topic maven --exclude-topic patched --json

  $ aggregator repo list --owner motlin --limit 100 --json

  $ aggregator repo list --include-forks --include-archived

  $ aggregator repo list --visibility public
```

_See code: [src/commands/repo/list.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/list.ts)_

## `aggregator repo process OUTPUT-DIRECTORY`

Process a single repository: clone, validate, and add github topic if valid

```
USAGE
  $ aggregator repo process OUTPUT-DIRECTORY -t <value> [--json] [-o <value>] [-n <value>] [-d] [-v]

ARGUMENTS
  OUTPUT-DIRECTORY  Directory where the repository will be cloned

FLAGS
  -d, --dryRun         Show what would be done without making actual changes
  -n, --name=<value>   Repository name
  -o, --owner=<value>  GitHub username or organization
  -t, --topic=<value>  (required) GitHub topic to add to validated Maven repositories
  -v, --verbose        Show verbose output during operation

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Process a single repository: clone, validate, and add github topic if valid

EXAMPLES
  $ aggregator repo process ./repos --owner motlin --name JUnit-Java-8-Runner --topic maven

  $ aggregator repo process ./repos --owner motlin --name example-repo --topic maven --dryRun --json

  echo '{"name": "repo", "owner": {"login": "user"}}' | aggregator repo process ./repos --topic maven --json

  $ aggregator repo:list --owner motlin --json | jq -c '.[]' | while read repo; do
    echo "$repo" | aggregator repo process ./repos --topic maven --json
  done
```

_See code: [src/commands/repo/process.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/process.ts)_

## `aggregator repo topic`

Add a github topic to a single GitHub repository

```
USAGE
  $ aggregator repo topic -t <value> [--json] [-o <value>] [-n <value>] [-d]

FLAGS
  -d, --dryRun         Show what would be done without making changes
  -n, --name=<value>   Repository name (required when not using stdin)
  -o, --owner=<value>  GitHub username or organization (required when not using stdin)
  -t, --topic=<value>  (required) Github topic to add to the repository

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Add a github topic to a single GitHub repository

EXAMPLES
  $ aggregator repo topic --owner motlin --name JUnit-Java-8-Runner --topic maven

  $ aggregator repo topic --owner motlin --name JUnit-Java-8-Runner --topic maven --dryRun

  echo '{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}' | aggregator repo topic --topic maven

  $ aggregator repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | aggregator repo topic --topic maven
```

_See code: [src/commands/repo/topic.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/topic.ts)_

## `aggregator repo validate REPOPATH`

Validate a single Maven repository

```
USAGE
  $ aggregator repo validate REPOPATH [--json]

ARGUMENTS
  REPOPATH  Path to the repository to validate

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validate a single Maven repository

EXAMPLES
  $ aggregator repo validate ./path/to/repo

  $ aggregator repo validate /repos/owner/repo-name

  $ aggregator repo validate ./my-maven-project --json
```

_See code: [src/commands/repo/validate.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/validate.ts)_
<!-- commandsstop -->
