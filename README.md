# aggregator-creator

CLI tool that creates Maven aggregator POMs from a set of repositories. Maven aggregators combine multiple Maven projects into a single build, allowing you to compile and test related modules together.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-24292e.svg)](https://github.com/motlin/aggregator-creator)

<!-- toc -->

- [aggregator-creator](#aggregator-creator)
- [Overview](#overview)
- [Environment Setup](#environment-setup)
- [Usage](#usage)
- [Complete Workflow](#complete-workflow)
- [Run the workflow test](#run-the-workflow-test)
- [Run workflow test and keep temporary files](#run-workflow-test-and-keep-temporary-files)
- [Directory Structure](#directory-structure)
- [License](#license)
- [Commands](#commands)
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

- [`aggregator aggregator create DIRECTORY`](#aggregator-aggregator-create-directory)
- [`aggregator hello PERSON`](#aggregator-hello-person)
- [`aggregator hello world`](#aggregator-hello-world)
- [`aggregator help [COMMAND]`](#aggregator-help-command)
- [`aggregator plugins`](#aggregator-plugins)
- [`aggregator plugins add PLUGIN`](#aggregator-plugins-add-plugin)
- [`aggregator plugins:inspect PLUGIN...`](#aggregator-pluginsinspect-plugin)
- [`aggregator plugins install PLUGIN`](#aggregator-plugins-install-plugin)
- [`aggregator plugins link PATH`](#aggregator-plugins-link-path)
- [`aggregator plugins remove [PLUGIN]`](#aggregator-plugins-remove-plugin)
- [`aggregator plugins reset`](#aggregator-plugins-reset)
- [`aggregator plugins uninstall [PLUGIN]`](#aggregator-plugins-uninstall-plugin)
- [`aggregator plugins unlink [PLUGIN]`](#aggregator-plugins-unlink-plugin)
- [`aggregator plugins update`](#aggregator-plugins-update)
- [`aggregator repo clone TARGETDIRECTORY`](#aggregator-repo-clone-targetdirectory)
- [`aggregator repo list`](#aggregator-repo-list)
- [`aggregator repo tag DIRECTORY`](#aggregator-repo-tag-directory)
- [`aggregator repo validate REPOPATH`](#aggregator-repo-validate-repopath)

## `aggregator aggregator create DIRECTORY`

Create Maven aggregator POM from a directory of repositories

```
USAGE
  $ aggregator aggregator create DIRECTORY [--json] [-g <value>] [-a <value>] [-v <value>] [-y]

ARGUMENTS
  DIRECTORY  Directory containing final Maven repos

FLAGS
  -a, --artifactId=<value>  [default: aggregator] ArtifactId for aggregator POM
  -g, --groupId=<value>     [default: com.example] GroupId for aggregator POM
  -v, --pomVersion=<value>  [default: 1.0.0-SNAPSHOT] Version for aggregator POM
  -y, --yes                 Automatically answer "yes" to all prompts

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
```

_See code: [src/commands/aggregator/create.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/aggregator/create.ts)_

## `aggregator hello PERSON`

Say hello

```
USAGE
  $ aggregator hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ aggregator hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/hello/index.ts)_

## `aggregator hello world`

Say hello world

```
USAGE
  $ aggregator hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ aggregator hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/hello/world.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.27/src/commands/help.ts)_

## `aggregator plugins`

List installed plugins.

```
USAGE
  $ aggregator plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ aggregator plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/index.ts)_

## `aggregator plugins add PLUGIN`

Installs a plugin into aggregator.

```
USAGE
  $ aggregator plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into aggregator.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the AGGREGATOR_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the AGGREGATOR_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ aggregator plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ aggregator plugins add myplugin

  Install a plugin from a github url.

    $ aggregator plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ aggregator plugins add someuser/someplugin
```

## `aggregator plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ aggregator plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ aggregator plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/inspect.ts)_

## `aggregator plugins install PLUGIN`

Installs a plugin into aggregator.

```
USAGE
  $ aggregator plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into aggregator.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the AGGREGATOR_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the AGGREGATOR_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ aggregator plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ aggregator plugins install myplugin

  Install a plugin from a github url.

    $ aggregator plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ aggregator plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/install.ts)_

## `aggregator plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ aggregator plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ aggregator plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/link.ts)_

## `aggregator plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aggregator plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aggregator plugins unlink
  $ aggregator plugins remove

EXAMPLES
  $ aggregator plugins remove myplugin
```

## `aggregator plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ aggregator plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/reset.ts)_

## `aggregator plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aggregator plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aggregator plugins unlink
  $ aggregator plugins remove

EXAMPLES
  $ aggregator plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/uninstall.ts)_

## `aggregator plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aggregator plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aggregator plugins unlink
  $ aggregator plugins remove

EXAMPLES
  $ aggregator plugins unlink myplugin
```

## `aggregator plugins update`

Update installed plugins.

```
USAGE
  $ aggregator plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.36/src/commands/plugins/update.ts)_

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
  $ aggregator repo list [--json] [-u <value>] [-t <value>...] [-g <value>...] [-l <value>]

FLAGS
  -g, --language=<value>...  Language filter
  -l, --limit=<value>        Max repositories
  -t, --topic=<value>...     Topic filter
  -u, --user=<value>         GitHub username/org

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List GitHub repositories based on filters

EXAMPLES
  $ aggregator repo list --user motlin --limit 100

  $ aggregator repo list --user motlin --language Java --limit 100

  $ aggregator repo list --user motlin --topic maven --language Java --json

  $ aggregator repo list --user motlin --limit 100 --json
```

_See code: [src/commands/repo/list.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/list.ts)_

## `aggregator repo tag DIRECTORY`

Tag valid Maven repositories with GitHub topics

```
USAGE
  $ aggregator repo tag DIRECTORY -t <value> [-d] [-v] [-y]

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
  $ aggregator repo tag ./repos-dir --topic maven

  $ aggregator repo tag ./repos-dir --topic maven --dryRun
```

_See code: [src/commands/repo/tag.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/tag.ts)_

## `aggregator repo validate REPOPATH`

Validates if directories contain valid Maven repositories

```
USAGE
  $ aggregator repo validate REPOPATH [-v] [-o <value>] [-c <value>]

ARGUMENTS
  REPOPATH  Path to the repository or directory of repositories to validate

FLAGS
  -c, --copyTo=<value>  Directory to copy validated repositories into
  -o, --output=<value>  Output file to write validated repository list
  -v, --verbose         Show verbose output during validation

DESCRIPTION
  Validates if directories contain valid Maven repositories

EXAMPLES
  $ aggregator repo validate ./path/to/repo

  $ aggregator repo validate /path/to/repos-dir

  $ aggregator repo validate ./repos-dir --output ./validated-repos.txt

  $ aggregator repo validate ./repos-dir --copyTo ./validated-repos
```

_See code: [src/commands/repo/validate.ts](https://github.com/motlin/aggregator-creator/blob/v0.0.0/src/commands/repo/validate.ts)_

<!-- commandsstop -->
