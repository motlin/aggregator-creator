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
* [JSON output structure](#json-output-structure)
* [Clone a single repository](#clone-a-single-repository)
* [Only process Java repositories](#only-process-java-repositories)
* [Skip archived repositories](#skip-archived-repositories)
* [Process repositories and collect results](#process-repositories-and-collect-results)
* [Preview what would be done without making changes](#preview-what-would-be-done-without-making-changes)
* [Clone only non-forked Java repos and create aggregator](#clone-only-non-forked-java-repos-and-create-aggregator)
* [Create aggregator from cloned repos](#create-aggregator-from-cloned-repos)
* [Process repos and handle errors gracefully](#process-repos-and-handle-errors-gracefully)
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

## Command Output Reference

Each command returns structured output that can be used for chaining and automation. All commands support a `--json` flag for machine-readable output.

### repo:list Output

Lists repositories with metadata that can be filtered and piped to other commands:

```bash
# JSON output structure
./bin/run.js repo:list --owner motlin --limit 3 --json
```

```json
[
	{
		"name": "JUnit-Java-8-Runner",
		"owner": {"login": "motlin", "type": "User"},
		"language": "Java",
		"topics": ["junit", "maven"],
		"visibility": "public",
		"fork": false,
		"archived": false
	}
]
```

### repo:clone Output

Returns the clone status and path to the cloned repository:

```bash
# Clone a single repository
echo '{"name": "example", "owner": {"login": "user"}}' | ./bin/run.js repo:clone --output-directory ./repos --json
```

```json
{
	"owner": "user",
	"name": "example",
	"path": "/absolute/path/to/repos/user/example",
	"cloned": true
}
```

When the repository already exists:

```json
{
	"owner": "user",
	"name": "example",
	"path": "/absolute/path/to/repos/user/example",
	"cloned": false,
	"alreadyExists": true
}
```

### repo:validate Output

Checks if a directory contains a valid Maven project:

```bash
./bin/run.js repo:validate ./repos/owner/repo-name --json
```

```json
{
	"path": "/absolute/path/to/repos/owner/repo-name",
	"hasPom": true,
	"valid": true,
	"error": null
}
```

When validation fails:

```json
{
	"path": "/absolute/path/to/repos/owner/repo-name",
	"hasPom": true,
	"valid": false,
	"error": "Maven validation failed"
}
```

### repo:topic Output

Adds a GitHub topic to a repository:

```bash
echo '{"name": "example", "owner": {"login": "user"}}' | ./bin/run.js repo:topic --topic maven --json
```

```json
{
	"owner": "user",
	"name": "example",
	"topics": ["java", "maven"],
	"topicAdded": true
}
```

When the topic already exists:

```json
{
	"owner": "user",
	"name": "example",
	"topics": ["java", "maven"],
	"topicAdded": false
}
```

### repo:process Output

Combines clone, validate, and topic operations with comprehensive results:

```bash
echo '{"name": "example", "owner": {"login": "user"}}' | ./bin/run.js repo:process ./repos --topic maven --json
```

```json
{
	"name": "example",
	"owner": {"login": "user", "type": "User"},
	"language": "Java",
	"topics": ["maven", "java"],
	"path": "/absolute/path/to/repos/user/example",
	"cloned": true,
	"valid": true,
	"topicAdded": true,
	"error": null
}
```

When processing fails:

```json
{
	"name": "example",
	"owner": {"login": "user"},
	"path": "/absolute/path/to/repos/user/example",
	"cloned": true,
	"valid": false,
	"topicAdded": false,
	"error": "Not a valid Maven repository"
}
```

### aggregator:create Output

Returns details about the created aggregator POM:
```bash
./bin/run.js aggregator:create ./maven-repos --groupId com.example --json
```

```json
{
	"success": true,
	"pomPath": "/absolute/path/to/maven-repos/pom.xml",
	"modules": [
		{"path": "owner/repo1", "valid": true},
		{"path": "owner/repo2", "valid": false, "reason": "Missing pom.xml"}
	],
	"stats": {
		"totalScanned": 10,
		"validRepositories": 8,
		"skippedRepositories": 2
	},
	"mavenCoordinates": {
		"groupId": "com.example",
		"artifactId": "aggregator",
		"version": "1.0.0-SNAPSHOT"
	}
}
```

## Command Composition Examples

The JSON outputs enable powerful command composition using tools like `jq`:

### Filter and Process by Language

```bash
# Only process Java repositories
./bin/run.js repo:list --owner motlin --json | \
  jq -c '.[] | select(.language == "Java")' | \
  while read repo; do
    echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json
  done
```

### Process Only Non-Archived Repositories
```bash
# Skip archived repositories
./bin/run.js repo:list --owner motlin --include-archived --json | \
  jq -c '.[] | select(.archived == false)' | \
  while read repo; do
    echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json
  done
```

### Collect Processing Results

```bash
# Process repositories and collect results
./bin/run.js repo:list --owner motlin --limit 10 --json | jq -c '.[]' | \
  while read repo; do
    echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json
  done | jq -s '{
  total: length,
  cloned: map(select(.cloned == true)) | length,
  valid: map(select(.valid == true)) | length,
  tagged: map(select(.topicAdded == true)) | length,
  repositories: map({name: .name, owner: .owner.login, valid: .valid})
}'
```

### Dry Run Analysis
```bash
# Preview what would be done without making changes
./bin/run.js repo:list --owner motlin --topic java --json | jq -c '.[]' | \
  while read repo; do
    echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --dryRun --json
  done | jq -s 'map(select(.valid == true)) | \
  {
    wouldTag: length,
    repositories: map(.name)
  }'
```

### Create Aggregator from Filtered Repos

```bash
# Clone only non-forked Java repos and create aggregator
./bin/run.js repo:list --owner motlin --language Java --json | \
  jq -c '.[] | select(.fork == false)' | \
  while read repo; do
    echo "$repo" | ./bin/run.js repo:clone --output-directory ./maven-repos --json
  done

# Create aggregator from cloned repos
./bin/run.js aggregator:create ./maven-repos --groupId com.example --json | \
  jq '{
    created: .success,
    pomPath: .pomPath,
    validModules: .stats.validRepositories,
    totalScanned: .stats.totalScanned
  }'
```

### Pipeline with Error Handling

```bash
# Process repos and handle errors gracefully
./bin/run.js repo:list --owner motlin --json | jq -c '.[]' | \
  while read repo; do
    if result=$(echo "$repo" | ./bin/run.js repo:process ./repos --topic maven --json 2>&1); then
      echo "$result" | jq -c '{name: .name, status: "success", valid: .valid}'
    else
      repo_name=$(echo "$repo" | jq -r '.name')
      echo "{\"name\": \"$repo_name\", \"status\": \"failed\", \"error\": true}" | jq -c .
    fi
  done | jq -s '{
    processed: length,
    succeeded: map(select(.status == "success")) | length,
    failed: map(select(.status == "failed")) | length,
    validRepos: map(select(.valid == true)) | map(.name)
  }'
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
  $ aggregator aggregator create [DIRECTORY] [--json] [-g <value>] [-a <value>] [--pomVersion <value>] [-y]
    [--parallel] [--rewriteDependencies] [-v]

ARGUMENTS
  [DIRECTORY]  Directory containing final Maven repos (or omit to read from stdin)

FLAGS
  -a, --artifactId=<value>        [default: aggregator] ArtifactId for aggregator POM
  -g, --groupId=<value>           [default: com.example] GroupId for aggregator POM
  -v, --verbose                   Show verbose output during aggregator creation
  -y, --yes                       Automatically answer "yes" to all prompts
      --[no-]parallel             Enable parallel processing
      --pomVersion=<value>        [default: 1.0.0-SNAPSHOT] Version for aggregator POM
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

  $ aggregator aggregator create ./maven-repos --verbose
```

_See code: [src/commands/aggregator/create.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/aggregator/create.ts)_

## `aggregator help [COMMAND]`

Display help for aggregator.

```
USAGE
  $ aggregator help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for aggregator.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.36/src/commands/help.ts)_

## `aggregator repo clone`

Clone a single GitHub repository

```
USAGE
  $ aggregator repo clone --output-directory <value> [--json] [-o <value>] [-n <value>] [-v]

FLAGS
  -n, --name=<value>              Repository name (required when not using stdin)
  -o, --owner=<value>             GitHub username or organization (required when not using stdin)
  -v, --verbose                   Show verbose output during cloning
      --output-directory=<value>  (required) Directory where the repository will be cloned

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Clone a single GitHub repository

EXAMPLES
  $ aggregator repo clone --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner

  echo '{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}' | aggregator repo clone --output-directory ./repos

  $ aggregator repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | aggregator repo clone --output-directory ./repos

  $ aggregator repo clone --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner --verbose
```

_See code: [src/commands/repo/clone.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/clone.ts)_

## `aggregator repo list`

List GitHub repositories based on filters

```
USAGE
  $ aggregator repo list [--json] [-o <value>...] [-t <value>...] [-x <value>...] [-g <value>...]
    [--include-forks] [--include-archived] [--visibility public|private|all] [-l <value>] [-v]

FLAGS
  -g, --language=<value>...       Language filter
  -l, --limit=<value>             Max repositories
  -o, --owner=<value>...          GitHub username/org to filter by
  -t, --topic=<value>...          Topic filter
  -v, --verbose                   Show verbose output during listing
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
  $ aggregator repo topic -t <value> [--json] [-o <value>] [-n <value>] [-d] [-v]

FLAGS
  -d, --dryRun         Show what would be done without making changes
  -n, --name=<value>   Repository name (required when not using stdin)
  -o, --owner=<value>  GitHub username or organization (required when not using stdin)
  -t, --topic=<value>  (required) Github topic to add to the repository
  -v, --verbose        Show verbose output during topic addition

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
  $ aggregator repo validate REPOPATH [--json] [-v]

ARGUMENTS
  REPOPATH  Path to the repository to validate

FLAGS
  -v, --verbose  Show verbose output during validation

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validate a single Maven repository

EXAMPLES
  $ aggregator repo validate ./path/to/repo

  $ aggregator repo validate /repos/owner/repo-name

  $ aggregator repo validate ./my-maven-project --json

  $ aggregator repo validate ./my-maven-project --verbose
```

_See code: [src/commands/repo/validate.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/validate.ts)_
<!-- commandsstop -->
