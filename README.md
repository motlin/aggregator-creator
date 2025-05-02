# aggregator-creator

CLI for managing Maven repositories and creating aggregator POMs

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/aggregator-creator.svg)](https://npmjs.org/package/aggregator-creator)
[![Downloads/week](https://img.shields.io/npm/dw/aggregator-creator.svg)](https://npmjs.org/package/aggregator-creator)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g aggregator-creator
$ aggregator COMMAND
running command...
$ aggregator (--version)
aggregator-creator/0.0.0 darwin-arm64 node-v23.11.0
$ aggregator --help [COMMAND]
USAGE
  $ aggregator COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

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

<!-- commandsstop -->
