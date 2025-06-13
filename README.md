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
* [Run the workflow test](#run-the-workflow-test)
* [Run workflow test and keep temporary files](#run-workflow-test-and-keep-temporary-files)
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

- `repo:list` - Find GitHub repositories matching specific criteria
- `repo:clone` - Clone repositories from a list provided via stdin
- `repo:validate` - Check if repositories contain valid Maven projects
- `repo:tag` - Add GitHub topics to validated repositories
- `aggregator:create` - Generate a Maven aggregator POM from a directory of repositories

For detailed usage information on each command, see the [Commands](#commands) section below.

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
* [`aggregator repo clone TARGETDIRECTORY`](#aggregator-repo-clone-targetdirectory)
* [`aggregator repo list`](#aggregator-repo-list)
* [`aggregator repo tag [DIRECTORY]`](#aggregator-repo-tag-directory)
* [`aggregator repo validate [REPOPATH]`](#aggregator-repo-validate-repopath)

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

  $ aggregator repo:list --user someuser --json | aggregator repo:validate --json | aggregator aggregator create ./output-dir
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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.29/src/commands/help.ts)_

## `aggregator repo clone TARGETDIRECTORY`

Clone GitHub repositories listed from stdin

```
USAGE
  $ aggregator repo clone TARGETDIRECTORY

ARGUMENTS
  TARGETDIRECTORY  Directory to clone repositories into

DESCRIPTION
  Clone GitHub repositories listed from stdin

EXAMPLES
  echo "owner/repo" | aggregator repo clone ./target-dir

  cat repos.txt | aggregator repo clone ./target-dir

  $ aggregator repo:list --user someuser --limit 100 --json | aggregator repo clone ./target-dir
```

_See code: [src/commands/repo/clone.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/clone.ts)_

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

## `aggregator repo tag [DIRECTORY]`

Tag valid Maven repositories with GitHub topics

```
USAGE
  $ aggregator repo tag [DIRECTORY] -t <value> [--json] [-d] [-y]

ARGUMENTS
  DIRECTORY  Directory containing cloned repos

FLAGS
  -d, --dryRun         Show changes without applying them
  -t, --topic=<value>  (required) Topic to synchronize
  -y, --yes            Automatically answer "yes" to all prompts

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Tag valid Maven repositories with GitHub topics

EXAMPLES
  $ aggregator repo tag ./repos-dir --topic maven

  $ aggregator repo tag ./repos-dir --topic maven --dryRun
```

_See code: [src/commands/repo/tag.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/tag.ts)_

## `aggregator repo validate [REPOPATH]`

Validates if directories contain valid Maven repositories

```
USAGE
  $ aggregator repo validate [REPOPATH] [--json] [-v] [-o <value>]

ARGUMENTS
  REPOPATH  Path to the repository or directory of repositories to validate (or omit to read from stdin)

FLAGS
  -o, --output=<value>  Output file to write validated repository list
  -v, --verbose         Show verbose output during validation

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validates if directories contain valid Maven repositories

EXAMPLES
  $ aggregator repo validate ./path/to/repo

  $ aggregator repo validate /path/to/repos-dir

  $ aggregator repo validate ./repos-dir --output ./validated-repos.txt

  $ aggregator repo validate ./repos-dir --json

  $ aggregator repo:list --user someuser --json | aggregator repo validate --json
```

_See code: [src/commands/repo/validate.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/validate.ts)_
<!-- commandsstop -->
