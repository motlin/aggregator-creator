# aggregator-creator

CLI tool that creates Maven aggregator POMs from a set of repositories. Maven aggregators combine multiple Maven projects into a single build, allowing you to compile and test related modules together.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-24292e.svg)](https://github.com/motlin/aggregator-creator)

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
* [Clone all repositories but only tag Java repositories](#clone-all-repositories-but-only-tag-java-repositories)
* [See what would be tagged without making changes](#see-what-would-be-tagged-without-making-changes)
* [Directory Structure](#directory-structure)
* [License](#license)
* [Commands](#commands)
<!-- tocstop -->

# Overview

The aggregator-creator CLI tool helps you manage Maven repositories and create Maven aggregator POMs:

1. Find Maven repositories on GitHub using various filters
2. Clone repositories to your local machine
3. Validate which repositories contain valid Maven projects
4. Tag repositories on GitHub to categorize them
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
- `repo:tag` - Tag a single GitHub repository with a topic
- `repo:process` - Process a single repository (clone, validate, and tag)

**Multiple Repository Commands:**
- `repo:list` - Find GitHub repositories matching specific criteria
- `repo:clone-many` - Clone multiple repositories from a list provided via stdin
- `repo:validate-many` - Check if repositories contain valid Maven projects
- `repo:tag-many` - Add GitHub topics to validated repositories

**Aggregator Commands:**
- `aggregator:create` - Generate a Maven aggregator POM from a directory of repositories

For detailed usage information on each command, see the [Commands](#commands) section below.

# Complete Workflow

There are two approaches to process repositories:

## Approach 1: Using Individual Processing (Recommended)

This approach uses `repo:process` to handle each repository individually:

1. **Find repositories:** Use `repo:list` to find repositories with specific criteria
2. **Process each repository:** Pipe each repository to `repo:process` which handles cloning, validation, and tagging
3. **Create aggregator:** Use `aggregator:create` to generate an aggregator POM from the processed repositories

Example:
```bash
# Process repositories individually
./bin/run.js repo:list --user motlin --language Java --json | jq -c '.[]' | while read repo; do
  echo "$repo" | ./bin/run.js repo:process ./repos --tag maven --json
done

# Then create the aggregator
./bin/run.js aggregator:create ./repos --groupId org.example
```

## Approach 2: Using Batch Processing (Legacy)

This approach uses the `-many` commands to process repositories in batches:

1. **Find repositories:** Use `repo:list` to find repositories with specific criteria
2. **Clone repositories:** Pipe the results to `repo:clone-many` to download them
3. **Validate repositories:** Use `repo:validate-many` to check which ones are valid Maven projects
4. **Tag repositories:** Use `repo:tag-many` to add relevant topics to valid repositories
5. **Create aggregator:** Use `aggregator:create` to generate an aggregator POM

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
./bin/run.js repo:list --user motlin --json | jq -c '.[]' | while read repo; do
  if echo "$repo" | ./bin/run.js repo:process ./repos --tag maven --json 2>/dev/null; then
    echo "Processed valid repository"
  fi
done
```

### Selective processing with custom logic
```bash
# Clone all repositories but only tag Java repositories
./bin/run.js repo:list --user motlin --json | jq -c '.[]' | while read repo; do
  REPO_NAME=$(echo "$repo" | jq -r '.name')
  REPO_OWNER=$(echo "$repo" | jq -r '.owner.login')
  LANGUAGE=$(echo "$repo" | jq -r '.language // empty')

  # Always clone
  echo "$repo" | ./bin/run.js repo:clone --output-directory ./repos

  # Validate
  if ./bin/run.js repo:validate "./repos/$REPO_OWNER/$REPO_NAME"; then
    # Only tag if it's a Java repository
    if [ "$LANGUAGE" = "Java" ]; then
      ./bin/run.js repo:tag --owner "$REPO_OWNER" --name "$REPO_NAME" --topic maven
    fi
  fi
done
```

### Dry run to preview changes
```bash
# See what would be tagged without making changes
./bin/run.js repo:list --user motlin --topic java --json | jq -c '.[]' | while read repo; do
  echo "$repo" | ./bin/run.js repo:process ./repos --tag maven --dryRun --json
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
* [`aggregator repo clone-many TARGETDIRECTORY`](#aggregator-repo-clone-many-targetdirectory)
* [`aggregator repo list`](#aggregator-repo-list)
* [`aggregator repo process OUTPUT-DIRECTORY`](#aggregator-repo-process-output-directory)
* [`aggregator repo tag`](#aggregator-repo-tag)
* [`aggregator repo tag-many`](#aggregator-repo-tag-many)
* [`aggregator repo validate REPOPATH`](#aggregator-repo-validate-repopath)
* [`aggregator repo validate-many [REPOPATH]`](#aggregator-repo-validate-many-repopath)

## `aggregator aggregator create [DIRECTORY]`

Create Maven aggregator POM from a directory of repositories

```
USAGE
  $ aggregator aggregator create [DIRECTORY] [--json] [-g <value>] [-a <value>] [-v <value>] [-y] [--parallel]

ARGUMENTS
  DIRECTORY  Directory containing final Maven repos (or omit to read from stdin)

FLAGS
  -a, --artifactId=<value>  [default: aggregator] ArtifactId for aggregator POM
  -g, --groupId=<value>     [default: com.example] GroupId for aggregator POM
  -v, --pomVersion=<value>  [default: 1.0.0-SNAPSHOT] Version for aggregator POM
  -y, --yes                 Automatically answer "yes" to all prompts
      --[no-]parallel       Enable parallel processing

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

  $ aggregator repo:list --user someuser --json | aggregator repo:validate-many --json | aggregator aggregator create ./output-dir
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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.30/src/commands/help.ts)_

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

  $ aggregator repo:list --user motlin --limit 1 --json | jq -c '.[0]' | aggregator repo clone --output-directory ./repos
```

_See code: [src/commands/repo/clone.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/clone.ts)_

## `aggregator repo clone-many TARGETDIRECTORY`

Clone multiple GitHub repositories listed from stdin

```
USAGE
  $ aggregator repo clone-many TARGETDIRECTORY

ARGUMENTS
  TARGETDIRECTORY  Directory to clone repositories into

DESCRIPTION
  Clone multiple GitHub repositories listed from stdin

EXAMPLES
  echo "owner/repo" | aggregator repo clone-many ./target-dir

  cat repos.txt | aggregator repo clone-many ./target-dir

  $ aggregator repo:list --user someuser --limit 100 --json | aggregator repo clone-many ./target-dir
```

_See code: [src/commands/repo/clone-many.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/clone-many.ts)_

## `aggregator repo list`

List GitHub repositories based on filters

```
USAGE
  $ aggregator repo list [--json] [-u <value>...] [-t <value>...] [-g <value>...] [--include-forks]
    [--include-archived] [--visibility public|private|all] [-l <value>]

FLAGS
  -g, --language=<value>...  Language filter
  -l, --limit=<value>        Max repositories
  -t, --topic=<value>...     Topic filter
  -u, --user=<value>...      GitHub username/org to filter by
      --include-archived     Include archived repositories
      --include-forks        Include forked repositories
      --visibility=<option>  [default: public] Repository visibility filter
                             <options: public|private|all>

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List GitHub repositories based on filters

EXAMPLES
  $ aggregator repo list --limit 100

  $ aggregator repo list --user motlin --limit 100

  $ aggregator repo list --user motlin --user liftwizard --limit 100

  $ aggregator repo list --user motlin --language Java --limit 100

  $ aggregator repo list --user motlin --topic maven --language Java --json

  $ aggregator repo list --user motlin --limit 100 --json

  $ aggregator repo list --include-forks --include-archived

  $ aggregator repo list --visibility public
```

_See code: [src/commands/repo/list.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/list.ts)_

## `aggregator repo process OUTPUT-DIRECTORY`

Process a single repository: clone, validate, and tag if valid

```
USAGE
  $ aggregator repo process OUTPUT-DIRECTORY -t <value> [--json] [-o <value>] [-n <value>] [-d] [-v]

ARGUMENTS
  OUTPUT-DIRECTORY  Directory where the repository will be cloned

FLAGS
  -d, --dryRun         Show what would be done without making actual changes
  -n, --name=<value>   Repository name
  -o, --owner=<value>  GitHub username or organization
  -t, --tag=<value>    (required) GitHub topic to add to validated Maven repositories
  -v, --verbose        Show verbose output during operation

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Process a single repository: clone, validate, and tag if valid

EXAMPLES
  $ aggregator repo process ./repos --owner motlin --name JUnit-Java-8-Runner --tag maven

  $ aggregator repo process ./repos --owner motlin --name example-repo --tag maven --dryRun --json

  echo '{"name": "repo", "owner": {"login": "user"}}' | aggregator repo process ./repos --tag maven --json

  $ aggregator repo:list --user motlin --json | jq -c '.[]' | while read repo; do
    echo "$repo" | aggregator repo process ./repos --tag maven --json
  done
```

_See code: [src/commands/repo/process.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/process.ts)_

## `aggregator repo tag`

Tag a single GitHub repository with a topic

```
USAGE
  $ aggregator repo tag -t <value> [--json] [-o <value>] [-n <value>] [-d]

FLAGS
  -d, --dryRun         Show what would be done without making changes
  -n, --name=<value>   Repository name (required when not using stdin)
  -o, --owner=<value>  GitHub username or organization (required when not using stdin)
  -t, --topic=<value>  (required) Topic to add to the repository

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Tag a single GitHub repository with a topic

EXAMPLES
  $ aggregator repo tag --owner motlin --name JUnit-Java-8-Runner --topic maven

  $ aggregator repo tag --owner motlin --name JUnit-Java-8-Runner --topic maven --dryRun

  echo '{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}' | aggregator repo tag --topic maven

  $ aggregator repo:list --user motlin --limit 1 --json | jq -c '.[0]' | aggregator repo tag --topic maven
```

_See code: [src/commands/repo/tag.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/tag.ts)_

## `aggregator repo tag-many`

Tag multiple valid Maven repositories with GitHub topics

```
USAGE
  $ aggregator repo tag-many -t <value> [--json] [--directory <value>] [-d] [-y]

FLAGS
  -d, --dryRun             Show changes without applying them
  -t, --topic=<value>      (required) Topic to synchronize
  -y, --yes                Automatically answer "yes" to all prompts
      --directory=<value>  Directory containing cloned repos

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Tag multiple valid Maven repositories with GitHub topics

EXAMPLES
  $ aggregator repo tag-many --directory ./repos-dir --topic maven

  $ aggregator repo tag-many --directory ./repos-dir --topic maven --dryRun

  $ aggregator repo:validate-many ./repos --json | aggregator repo tag-many --topic maven
```

_See code: [src/commands/repo/tag-many.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/tag-many.ts)_

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

## `aggregator repo validate-many [REPOPATH]`

Validates multiple Maven repositories from a directory or stdin

```
USAGE
  $ aggregator repo validate-many [REPOPATH] [--json] [-v] [-o <value>]

ARGUMENTS
  REPOPATH  Path to the repository or directory of repositories to validate (or omit to read from stdin)

FLAGS
  -o, --output=<value>  Output file to write validated repository list
  -v, --verbose         Show verbose output during validation

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validates multiple Maven repositories from a directory or stdin

EXAMPLES
  $ aggregator repo validate-many ./path/to/repo

  $ aggregator repo validate-many /path/to/repos-dir

  $ aggregator repo validate-many ./repos-dir --output ./validated-repos.txt

  $ aggregator repo validate-many ./repos-dir --json

  $ aggregator repo:list --user someuser --json | aggregator repo validate-many --json
```

_See code: [src/commands/repo/validate-many.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/validate-many.ts)_
<!-- commandsstop -->
