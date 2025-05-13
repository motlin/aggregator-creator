# aggregator-creator

CLI tool that creates Maven aggregator POMs from a set of repositories. Maven aggregators combine multiple Maven projects into a single build, allowing you to compile, test, and deploy related modules together while maintaining their separate repository structure.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-24292e.svg)](https://github.com/motlin/aggregator-creator)

<!-- toc -->

- [Overview](#overview)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Usage](#usage)
- [Repository Management](#repository-management)
  - [Listing Repositories](#listing-repositories)
  - [Cloning Repositories](#cloning-repositories)
  - [Validating Repositories](#validating-repositories)
  - [Tagging Repositories](#tagging-repositories)
- [Aggregator Creation](#aggregator-creation)
  - [Creating an Aggregator POM](#creating-an-aggregator-pom)
- [Complete Workflow](#complete-workflow)
- [Directory Structure](#directory-structure)
- [Development](#development)
- [License](#license)
- [Commands](#commands)
<!-- tocstop -->

# Overview

The aggregator-creator CLI tool helps you manage Maven repositories and create Maven aggregator POMs. It provides a complete workflow:

1. Find Maven repositories on GitHub using various filters
2. Clone repositories to your local machine
3. Validate which repositories contain valid Maven projects
4. Tag repositories on GitHub to categorize them
5. Create a Maven aggregator POM that combines multiple repositories

This tool is especially useful for organizations with many microservices or modular projects that need to be built together.

# Environment Setup

The project uses [mise](https://mise.jdx.dev/) to manage development dependencies. All required tools are installed automatically when you run commands through the project's justfile.

# Installation

## Local Installation

```sh
# Clone the repository
git clone https://github.com/motlin/aggregator-creator.git
cd aggregator-creator

# Set up with just
just install
just build

# Run commands
./bin/run.js COMMAND
```

## Using just

If you have the `just` command runner installed, you can use these shortcuts:

```sh
# List repositories
just repo-list USERNAME

# Examples with flags
just repo-list motlin --limit 100
just repo-list motlin --language Java
just repo-list motlin --topic maven

# Run a complete workflow test
just workflow-test
```

## Version and Help

```sh
# Check version
./bin/run.js --version
aggregator-creator/0.0.0 darwin-arm64 node-v23.11.0

# Get help
./bin/run.js --help [COMMAND]
```

# Usage

The aggregator-creator CLI provides commands for managing repositories and creating aggregator POMs. All commands follow the pattern:

```sh
./bin/run.js COMMAND [ARGUMENTS] [FLAGS]
```

# Repository Management

## Listing Repositories

The `repo:list` command helps you find GitHub repositories matching specific criteria.

**Command:** `./bin/run.js repo:list`

**Flags:**

- `-u, --user <username>` - GitHub username/organization (required)
- `-t, --topic <topic>` - Topic filter (can be used multiple times)
- `-g, --language <language>` - Language filter (can be used multiple times)
- `-l, --limit <number>` - Maximum number of repositories to return
- `--json` - Output results as JSON

**Examples:**

```sh
# List all repositories for a user
./bin/run.js repo:list --user motlin

# List with limit and language filter
./bin/run.js repo:list --user motlin --language Java --limit 100

# List with topic filter and JSON output
./bin/run.js repo:list --user motlin --topic maven --json

# Using short flags
./bin/run.js repo:list -u motlin -g Java -l 50
```

**Example output:**

```
Found 5 repositories:
- motlin/aggregator-creator (Java) Topics: [maven, java]
- motlin/reladomo (Java) Topics: [orm, maven]
- motlin/eclipse-collections (Java) Topics: [collections, maven]
- motlin/eclipse-collections-kata (Java) Topics: [java, maven]
- motlin/reladomo-kata (Java) Topics: [java, maven, orm]
```

## Cloning Repositories

The `repo:clone` command clones repositories from a list provided via stdin.

**Command:** `./bin/run.js repo:clone TARGETDIRECTORY`

**Arguments:**

- `TARGETDIRECTORY` - Directory to clone repositories into (required)

**Examples:**

```sh
# Clone a specific repository
echo "motlin/eclipse-collections" | ./bin/run.js repo:clone ./repos-dir

# Clone multiple repositories from a file
cat repos.txt | ./bin/run.js repo:clone ./repos-dir

# Chain with repo:list to clone filtered repositories
./bin/run.js repo:list --user motlin --topic maven --json | ./bin/run.js repo:clone ./maven-repos
```

**Example output:**

```
╭─── 🚀 Cloning 1 repository
│
├──╮ 📦 [1/1] motlin/eclipse-collections
│  │
│  │  ┏ gh repo clone motlin/eclipse-collections /path/to/repos-dir/motlin/eclipse-collections
│  │  ┣━ Cloning into '/path/to/repos-dir/motlin/eclipse-collections'...
│  │  ┗━ 1.80s
│  │
│  ╰ ✅ Done
│
╰─── 🏁 Cloning complete
```

## Validating Repositories

The `repo:validate` command checks if repositories contain valid Maven projects.

**Command:** `./bin/run.js repo:validate REPOPATH`

**Arguments:**

- `REPOPATH` - Path to repository or directory of repositories (required)

**Flags:**

- `-v, --verbose` - Show verbose output during validation
- `-o, --output <path>` - Output file to write validated repository list
- `-c, --copyTo <directory>` - Directory to copy validated repositories into

**Examples:**

```sh
# Validate a single repository
./bin/run.js repo:validate ./repos-dir/motlin/eclipse-collections

# Validate all repositories in a directory
./bin/run.js repo:validate ./repos-dir

# Validate and save list of valid repositories
./bin/run.js repo:validate ./repos-dir --output ./validated-repos.txt

# Validate and copy valid repositories to a new directory
./bin/run.js repo:validate ./repos-dir --copyTo ./validated-repos
```

**Example output:**

```
╭─── 🔍 Validating Maven repositories...
│
├──╮ 🔍 [1/3] motlin/eclipse-collections
│  ╰ ✅ Validation successful: motlin/eclipse-collections
│
├──╮ 🔍 [2/3] motlin/not-maven-repo
│  ╰ ⏩ Skipping non-Maven repository: motlin/not-maven-repo
│
├──╮ 🔍 [3/3] motlin/reladomo
│  ╰ ✅ Validation successful: motlin/reladomo
│
╰─── ✅ Found 2 validated Maven repositories
```

## Tagging Repositories

The `repo:tag` command adds GitHub topics to validated repositories.

**Command:** `./bin/run.js repo:tag DIRECTORY`

**Arguments:**

- `DIRECTORY` - Directory containing cloned repositories (required)

**Flags:**

- `-t, --topic <topic>` - Topic to add to repositories (required)
- `-d, --dryRun` - Show changes without applying them
- `-v, --verbose` - Show verbose output during operation
- `-y, --yes` - Automatically answer "yes" to all prompts

**Examples:**

```sh
# Tag repositories with the 'maven' topic
./bin/run.js repo:tag ./validated-repos --topic maven

# Dry run to see changes without applying them
./bin/run.js repo:tag ./validated-repos --topic maven --dryRun

# Add verbose output and auto-confirmation
./bin/run.js repo:tag ./validated-repos --topic maven --verbose --yes
```

**Example output:**

```
🏷️ Adding maven topic to validated repositories...
Scanning directory: /path/to/validated-repos for repositories to tag with topic: maven
Found 2 directories to check
Processing repository: eclipse-collections
✓ Valid Maven repository: eclipse-collections
Processing repository: reladomo
✓ Valid Maven repository: reladomo

Found 2 valid Maven repositories to tag:
  - motlin/eclipse-collections
  - motlin/reladomo
Do you want to tag these 2 repositories with the 'maven' topic? Yes

Tagging repositories...
✓ Tagged motlin/eclipse-collections with topic: maven
✓ Tagged motlin/reladomo with topic: maven
✅ Repository tagging process completed
```

# Aggregator Creation

## Creating an Aggregator POM

The `aggregator:create` command generates a Maven aggregator POM from a directory of repositories.

**Command:** `./bin/run.js aggregator:create DIRECTORY`

**Arguments:**

- `DIRECTORY` - Directory containing Maven repositories (required)

**Flags:**

- `-g, --groupId <id>` - GroupId for aggregator POM (default: com.example)
- `-a, --artifactId <id>` - ArtifactId for aggregator POM (default: aggregator)
- `-v, --pomVersion <version>` - Version for aggregator POM (default: 1.0.0-SNAPSHOT)
- `-y, --yes` - Automatically answer "yes" to all prompts
- `--json` - Output results as JSON

**Examples:**

```sh
# Create with default settings
./bin/run.js aggregator:create ./maven-repos

# Create with custom group ID
./bin/run.js aggregator:create ./maven-repos --groupId org.example

# Create with custom artifact ID and version
./bin/run.js aggregator:create ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0

# Auto-confirm and output as JSON
./bin/run.js aggregator:create ./maven-repos --yes --json
```

**Example output:**

```
🔍 Scanning for Maven repositories in /path/to/maven-repos...
Found 2 potential repository containers to scan
⏳ Examining: motlin
✅ Found valid Maven repository: motlin/eclipse-collections
✅ Found valid Maven repository: motlin/reladomo

📊 Repository scan summary:
✅ Found 2 valid Maven repositories

📋 Ready to create aggregator POM with the following settings:
  - groupId: com.example
  - artifactId: aggregator
  - version: 1.0.0-SNAPSHOT
  - modules: 2 Maven repositories
Do you want to create the aggregator POM? Yes

✅ Created aggregator POM at /path/to/maven-repos/pom.xml
📋 Included 2 modules
⏱️ Operation completed in 450ms
```

# Complete Workflow

The typical workflow combines all the commands to discover, clone, validate, tag, and create an aggregator:

1. **Find repositories:** Use `repo:list` to find repositories with specific criteria
2. **Clone repositories:** Pipe the results to `repo:clone` to download them
3. **Validate repositories:** Use `repo:validate` to check which ones are valid Maven projects
4. **Tag repositories:** Use `repo:tag` to add relevant topics to valid repositories
5. **Create aggregator:** Use `aggregator:create` to generate an aggregator POM

You can run this complete workflow with:

```sh
# Run the workflow test
just workflow-test

# Run workflow test and keep temporary files
just workflow-test false
```

**Example output:**

```
🧪 Running workflow test in /tmp/oclif-workflow-test-abcdef12
📂 Test Directory: /tmp/oclif-workflow-test-abcdef12

Step 1: List repositories using repo:list
🔍 Listing repositories for motlin with language=Java...
📋 Found 5 repositories

Step 2: Clone repositories using repo:clone
📦 Cloning repositories...

Step 3: Validate repositories using repo:validate
Validating Maven repositories...
✅ Found 3 validated Maven repositories

Step 4: Tag validated repositories using repo:tag
🏷️ Adding maven topic to validated repositories...

Step 5: List repositories with maven topic
🔍 Listing repositories with maven topic and language=Java...

Step 6: Clone maven-tagged repositories
📦 Cloning maven-tagged repositories...

Step 7: Create aggregator POM
📄 Creating aggregator POM...
📄 Successfully created aggregator POM at: /tmp/oclif-workflow-test-abcdef12/final-repos/pom.xml

✅ Workflow test completed successfully!
🧹 Cleaning up test directory...
🎉 Workflow test finished.
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

# Development

## Development Setup

To set up the project for development:

```sh
# Clone the repository
git clone https://github.com/motlin/aggregator-creator.git
cd aggregator-creator

# Install dependencies
just install
```

## Development Commands

The project uses a `justfile` to simplify common development tasks:

```sh
# List all available commands
just

# Run typecheck (also builds the project)
just typecheck

# Run linter
just lint

# Run linter with auto-fixing
just lint-fix

# Format code
just format

# Build the project
just build

# Generate oclif manifest
just manifest

# Run tests
just test

# Run all checks (install, build, lint-fix, format, test, manifest)
just precommit
```

## Testing Workflow

To test the complete workflow from repository listing to aggregator creation:

```sh
# Run the full workflow test (automatically cleans up after)
just workflow-test

# Run the workflow test and keep the files for inspection
just workflow-test false
```

# License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

# Commands

<!-- commands -->

- [`./bin/run.js aggregator:create DIRECTORY`](#binrunjs-aggregatorcreate-directory)
- [`./bin/run.js help [COMMAND]`](#binrunjs-help-command)
- [`./bin/run.js repo:clone TARGETDIRECTORY`](#binrunjs-repoclone-targetdirectory)
- [`./bin/run.js repo:list`](#binrunjs-repolist)
- [`./bin/run.js repo:tag DIRECTORY`](#binrunjs-repotag-directory)
- [`./bin/run.js repo:validate REPOPATH`](#binrunjs-repovalidate-repopath)

## `./bin/run.js aggregator:create DIRECTORY`

Create Maven aggregator POM from a directory of repositories

```
USAGE
  $ ./bin/run.js aggregator:create DIRECTORY [--json] [-g <value>] [-a <value>] [-v <value>] [-y]

ARGUMENTS
  DIRECTORY  Directory containing final Maven repos

FLAGS
  -a, --artifactId=<value>  [default: aggregator] ArtifactId for aggregator POM
  -g, --groupId=<value>     [default: com.example] GroupId for aggregator POM
  -v, --pomVersion=<value>  [default: 1.0.0-SNAPSHOT] Version for aggregator POM
  -y, --yes                 Automatically answer "yes" to all prompts
  --json                    Format output as JSON

DESCRIPTION
  Create Maven aggregator POM from a directory of repositories

EXAMPLES
  $ ./bin/run.js aggregator:create ./maven-repos

  $ ./bin/run.js aggregator:create ./maven-repos --groupId org.example

  $ ./bin/run.js aggregator:create ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0

  $ ./bin/run.js aggregator:create ./maven-repos --yes
```

## `./bin/run.js help [COMMAND]`

Display help for the CLI.

```
USAGE
  $ ./bin/run.js help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for the CLI.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.27/src/commands/help.ts)_

## `./bin/run.js repo:clone TARGETDIRECTORY`

Clone GitHub repositories listed from stdin

```
USAGE
  $ ./bin/run.js repo:clone TARGETDIRECTORY

ARGUMENTS
  TARGETDIRECTORY  Directory to clone repositories into

DESCRIPTION
  Clone GitHub repositories listed from stdin

EXAMPLES
  $ echo "owner/repo" | ./bin/run.js repo:clone ./target-dir

  $ cat repos.txt | ./bin/run.js repo:clone ./target-dir

  $ ./bin/run.js repo:list --user someuser --limit 100 --json | ./bin/run.js repo:clone ./target-dir
```

## `./bin/run.js repo:list`

List GitHub repositories based on filters

```
USAGE
  $ ./bin/run.js repo:list [--json] [-u <value>] [-t <value>] [-g <value>] [-l <value>]

FLAGS
  -g, --language=<value>  Language filter (e.g., Java, JavaScript)
  -l, --limit=<value>     Max repositories
  -t, --topic=<value>     Topic filter
  -u, --user=<value>      GitHub username/org
  --json                  Format output as JSON

DESCRIPTION
  List GitHub repositories based on filters

EXAMPLES
  $ ./bin/run.js repo:list --user motlin --limit 100

  $ ./bin/run.js repo:list --user motlin --language Java --limit 100

  $ ./bin/run.js repo:list --user motlin --topic maven --language Java --json

  $ ./bin/run.js repo:list --user motlin --limit 100 --json
```

## `./bin/run.js repo:tag DIRECTORY`

Tag valid Maven repositories with GitHub topics

```
USAGE
  $ ./bin/run.js repo:tag DIRECTORY -t <value> [-d] [-v] [-y]

ARGUMENTS
  DIRECTORY  Directory containing cloned repos

FLAGS
  -d, --dryRun         Show changes without applying them
  -t, --topic=<value>  (required) Topic to synchronize
  -v, --verbose        Show verbose output during operation
  -y, --yes            Automatically answer "yes" to all prompts

DESCRIPTION
  Tag valid Maven repositories with GitHub topics

EXAMPLES
  $ ./bin/run.js repo:tag ./repos-dir --topic maven

  $ ./bin/run.js repo:tag ./repos-dir --topic maven --dryRun
```

## `./bin/run.js repo:validate REPOPATH`

Validates if directories contain valid Maven repositories

```
USAGE
  $ ./bin/run.js repo:validate REPOPATH [-v] [-o <value>] [-c <value>]

ARGUMENTS
  REPOPATH  Path to the repository or directory of repositories to validate

FLAGS
  -c, --copyTo=<value>   Directory to copy validated repositories into
  -o, --output=<value>   Output file to write validated repository list
  -v, --verbose          Show verbose output during validation

DESCRIPTION
  Validates if directories contain valid Maven repositories

EXAMPLES
  $ ./bin/run.js repo:validate ./path/to/repo

  $ ./bin/run.js repo:validate /path/to/repos-dir

  $ ./bin/run.js repo:validate ./repos-dir --output ./validated-repos.txt

  $ ./bin/run.js repo:validate ./repos-dir --copyTo ./validated-repos
```

<!-- commandsstop -->
