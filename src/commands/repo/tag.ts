import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa as execa_} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'
import inquirer from 'inquirer'

export default class RepoTag extends Command {
  static override args = {
    directory: Args.string({
      description: 'Directory containing cloned repos',
      required: true,
    }),
  }

  static override description = 'Tag valid Maven repositories with GitHub topics'

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./repos-dir --topic maven',
    '<%= config.bin %> <%= command.id %> ./repos-dir --topic maven --dryRun',
  ]

  static override flags = {
    topic: Flags.string({
      char: 't',
      description: 'Topic to synchronize',
      required: true,
    }),
    dryRun: Flags.boolean({
      char: 'd',
      description: 'Show changes without applying them',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output during operation',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Automatically answer "yes" to all prompts',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoTag)
    const {directory} = args
    const {topic, dryRun, verbose, yes} = flags

    // Configure execa with verbose logging similar to other commands
    const execa = execa_({
      verbose: (verboseLine: string, {type}: {type: string}) => {
        switch (type) {
          case 'command': {
            this.log(`│  ├──╮ ${verboseLine}`)
            break
          }
          case 'duration': {
            this.log(`│  ├──╯ ${verboseLine}`)
            break
          }
          case 'output': {
            const MAX_LENGTH = 120
            const truncatedLine =
              verboseLine.length > MAX_LENGTH ? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...` : verboseLine
            this.log(`│  │  │ ${truncatedLine}`)
            break
          }
          default: {
            this.debug(`${type} ${verboseLine}`)
          }
        }
      },
    })

    this.log(`╭─── 🏷️ Adding ${chalk.cyan(topic)} topic to validated repositories...`)
    this.log(`│`)
    this.log(
      `├──╮ 🔍 Scanning directory: ${chalk.cyan(directory)} for repositories to tag with topic: ${chalk.cyan(topic)}`,
    )
    if (dryRun) {
      this.log(`│  │ ${chalk.yellow('Running in dry-run mode - no changes will be applied')}`)
    }

    try {
      const absolutePath = path.resolve(directory)
      const entries = await fs.readdir(absolutePath, {withFileTypes: true})

      // Filter for directories only - these will be owner directories
      const ownerDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

      this.log(`│  │ Found ${chalk.cyan(ownerDirs.length)} owner directories to check`)

      // First pass: validate repositories and collect valid ones
      const validRepos: Array<{
        path: string
        name: string
        owner: string
        repoName: string
      }> = []

      let totalRepos = 0

      // Process repositories with owner/repo structure
      for (const ownerDir of ownerDirs) {
        const ownerPath = path.join(absolutePath, ownerDir)

        // Get repositories in this owner directory
        const repoEntries = await fs.readdir(ownerPath, {withFileTypes: true})
        const repoDirs = repoEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

        for (const repoDir of repoDirs) {
          totalRepos++
          const repoPath = path.join(ownerPath, repoDir)
          const repoName = repoDir

          this.log(`│  ├──╮ Processing repository: ${chalk.cyan(`${ownerDir}/${repoName}`)}`)

          // Check if it's a git repository
          if (!(await this.isGitRepository(repoPath))) {
            this.log(`│  │  │ ${chalk.yellow(`Skipping ${ownerDir}/${repoName} - not a git repository`)}`)
            this.log(`│  ├──╯`)
            continue
          }

          // Validate as Maven repository
          const isValid = await this.validateMavenRepo(repoPath, execa, verbose)

          if (isValid) {
            this.log(`│  │  │ ${chalk.green(`✓ Valid Maven repository: ${ownerDir}/${repoName}`)}`)

            // Get repository owner and name from remote URL
            const {owner, name} = await this.getRepoOwnerAndName(repoPath, execa)

            if (owner && name) {
              validRepos.push({
                path: repoPath,
                name: repoName,
                owner,
                repoName: name,
              })
            } else {
              this.log(`│  │  │ ${chalk.yellow(`Could not determine GitHub owner/name for ${ownerDir}/${repoName}`)}`)
            }
          } else {
            this.log(`│  │  │ ${chalk.yellow(`Skipping ${ownerDir}/${repoName} - not a valid Maven repository`)}`)
          }
          this.log(`│  ├──╯`)
        }
      }

      // Log total repositories found
      this.log(`│  │`)
      this.log(`│  ├──╮ 📊 Summary:`)
      this.log(
        `│  │  │ ${chalk.cyan(`Checked ${totalRepos} total repositories across ${ownerDirs.length} owner directories`)}`,
      )

      // Show confirmation with list of repositories to tag
      if (validRepos.length === 0) {
        this.log(`│  │  │ ${chalk.yellow('No valid Maven repositories found to tag.')}`)
        this.log(`│  ├──╯`)
        return
      }

      this.log(`│  │  │ ${chalk.green(`Found ${validRepos.length} valid Maven repositories to tag:`)}`)

      for (const repo of validRepos) {
        this.log(`│  │  │ - ${chalk.cyan(repo.owner + '/' + repo.repoName)}`)
      }
      this.log(`│  ├──╯`)

      // Ask for confirmation unless in dry run mode or yes flag is used
      let proceed = dryRun || yes

      if (!proceed) {
        this.log(`│  │`)
        this.log(`│  ├──╮ 🤔 Confirmation`)
        this.log(`│  │  │ Do you want to tag these ${validRepos.length} repositories with the '${topic}' topic?`)

        const {confirmed} = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Proceed with tagging?`,
            default: false,
          },
        ])
        proceed = confirmed

        if (!proceed) {
          this.log(`│  │  │ ${chalk.yellow('Operation canceled by user.')}`)
          this.log(`│  ├──╯`)
          return
        }
        this.log(`│  ├──╯`)
      }

      // Second pass: tag repositories
      this.log(`│  │`)
      this.log(`│  ├──╮ 🏷️ ${chalk.cyan('Tagging repositories...')}`)

      for (const repo of validRepos) {
        if (dryRun) {
          this.log(`│  │  │ ${chalk.blue(`[DRY RUN] Would tag ${repo.owner}/${repo.repoName} with topic: ${topic}`)}`)
        } else {
          await this.tagRepository(repo.owner, repo.repoName, topic, execa)
          this.log(`│  │  │ ${chalk.green(`✓ Tagged ${repo.owner}/${repo.repoName} with topic: ${topic}`)}`)
        }
      }
      this.log(`│  ├──╯`)

      this.log(`│`)
      this.log(`╰─── ${chalk.green('✅ Repository tagging process completed')}`)
    } catch (error) {
      this.error(`Failed to process repositories: ${error}`, {exit: 1})
    }
  }

  private async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(repoPath, '.git')
      return await fs.pathExists(gitDir)
    } catch {
      return false
    }
  }

  private async getRepoOwnerAndName(
    repoPath: string,
    execa: typeof execa_ = execa_,
  ): Promise<{owner: string; name: string}> {
    try {
      const {stdout} = await execa('git', ['-C', repoPath, 'remote', 'get-url', 'origin'])

      // Handle SSH and HTTPS remote URLs
      const sshMatch = stdout.match(/git@github\.[^/]+\.com:([^/]+)\/([^/]+)(\.git)?$/)
      const httpsMatch = stdout.match(/https:\/\/github\.[^/]+\.com\/([^/]+)\/([^/]+)(\.git)?$/)

      const match = sshMatch || httpsMatch

      if (match && match.length >= 3) {
        return {
          owner: match[1],
          name: match[2],
        }
      }

      return {owner: '', name: ''}
    } catch {
      return {owner: '', name: ''}
    }
  }

  private async tagRepository(
    owner: string,
    name: string,
    topic: string,
    execa: typeof execa_ = execa_,
  ): Promise<void> {
    try {
      await execa('gh', ['api', `repos/${owner}/${name}/topics`, '--method', 'GET'], {
        reject: false,
      }).then(async (result) => {
        if (result.exitCode === 0) {
          try {
            const topicsData = JSON.parse(result.stdout)
            const topics = topicsData.names || []

            if (topics.includes(topic)) {
              this.log(`│  │  │ ${chalk.blue(`Topic ${topic} already exists on ${owner}/${name}`)}`)
            } else {
              topics.push(topic)
              await execa('gh', [
                'api',
                `repos/${owner}/${name}/topics`,
                '--method',
                'PUT',
                '-f',
                `names[]=${topics.join('&names[]=')}`,
              ])
            }
          } catch (error) {
            this.log(`│  │  │ ${chalk.red(`Error updating topics: ${error}`)}`)
          }
        } else {
          this.log(`│  │  │ ${chalk.yellow(`Failed to get topics for ${owner}/${name}: ${result.stderr}`)}`)
        }
      })
    } catch (error) {
      this.log(`│  │  │ ${chalk.red(`Failed to tag repository ${owner}/${name}: ${error}`)}`)
    }
  }

  private async validateMavenRepo(repoPath: string, execa: typeof execa_ = execa_, verbose = false): Promise<boolean> {
    const absolutePath = path.resolve(repoPath)
    if (verbose) this.log(`Validating Maven repo at: ${absolutePath}`)

    // Check if directory exists
    try {
      const stats = await fs.stat(absolutePath)
      if (!stats.isDirectory()) {
        return false
      }
    } catch {
      return false
    }

    // Check for pom.xml
    const pomPath = path.join(absolutePath, 'pom.xml')
    try {
      const pomExists = await fs.pathExists(pomPath)
      if (!pomExists) {
        if (verbose) this.log(chalk.yellow(`No pom.xml found at: ${pomPath}`))
        return false
      }
    } catch {
      return false
    }

    // Run Maven validation using help:effective-pom
    try {
      // The verbose listener configured in run() will handle showing the command and output
      await execa('mvn', ['help:effective-pom', '--quiet', '--file', pomPath])
      return true
    } catch (execError) {
      // The verbose listener will show the error output
      if (execError instanceof Error && execError.message.includes('ENOENT')) {
        this.log(`│  │ ${chalk.yellow('Maven (mvn) command not found. Please install Maven.')}`)
      }
      return false
    }
  }
}
