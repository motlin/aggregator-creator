import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'
import logUpdate from 'log-update'
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

    this.log(`🏷️ Adding ${chalk.cyan(topic)} topic to validated repositories...`)
    this.log(`Scanning directory: ${chalk.cyan(directory)} for repositories to tag with topic: ${chalk.cyan(topic)}`)
    if (dryRun) {
      this.log(chalk.yellow('Running in dry-run mode - no changes will be applied'))
    }

    try {
      const absolutePath = path.resolve(directory)
      const entries = await fs.readdir(absolutePath, {withFileTypes: true})

      // Filter for directories only
      const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

      this.log(`Found ${chalk.cyan(dirs.length)} directories to check`)

      // First pass: validate repositories and collect valid ones
      const validRepos: Array<{
        path: string
        name: string
        owner: string
        repoName: string
      }> = []

      for (const repoDir of dirs) {
        const repoPath = path.join(absolutePath, repoDir)
        const repoName = path.basename(repoPath)

        this.log(`Processing repository: ${chalk.cyan(repoName)}`)

        // Check if it's a git repository
        if (!(await this.isGitRepository(repoPath))) {
          this.log(chalk.yellow(`Skipping ${repoName} - not a git repository`))
          continue
        }

        // Validate as Maven repository
        const isValid = await this.validateMavenRepo(repoPath, verbose)

        if (isValid) {
          this.log(chalk.green(`✓ Valid Maven repository: ${repoName}`))

          // Get repository owner and name from remote URL
          const {owner, name} = await this.getRepoOwnerAndName(repoPath)

          if (owner && name) {
            validRepos.push({
              path: repoPath,
              name: repoName,
              owner,
              repoName: name,
            })
          } else {
            this.log(chalk.yellow(`Could not determine GitHub owner/name for ${repoName}`))
          }
        } else {
          this.log(chalk.yellow(`Skipping ${repoName} - not a valid Maven repository`))
        }
      }

      // Show confirmation with list of repositories to tag
      if (validRepos.length === 0) {
        this.log(chalk.yellow('No valid Maven repositories found to tag.'))
        return
      }

      this.log(`\n${chalk.green(`Found ${validRepos.length} valid Maven repositories to tag:`)}`)

      for (const repo of validRepos) {
        this.log(`  - ${chalk.cyan(repo.owner + '/' + repo.repoName)}`)
      }

      // Ask for confirmation unless in dry run mode or yes flag is used
      let proceed = dryRun || yes

      if (!proceed) {
        const {confirmed} = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Do you want to tag these ${validRepos.length} repositories with the '${topic}' topic?`,
            default: false,
          },
        ])
        proceed = confirmed
      }

      if (!proceed) {
        this.log(chalk.yellow('Operation canceled by user.'))
        return
      }

      // Second pass: tag repositories
      this.log(chalk.cyan('\nTagging repositories...'))

      for (const repo of validRepos) {
        if (dryRun) {
          this.log(chalk.blue(`[DRY RUN] Would tag ${repo.owner}/${repo.repoName} with topic: ${topic}`))
        } else {
          await this.tagRepository(repo.owner, repo.repoName, topic)
          this.log(chalk.green(`✓ Tagged ${repo.owner}/${repo.repoName} with topic: ${topic}`))
        }
      }

      this.log(chalk.green('✅ Repository tagging process completed'))
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

  private async getRepoOwnerAndName(repoPath: string): Promise<{owner: string; name: string}> {
    try {
      const {stdout} = await execa('git', ['-C', repoPath, 'remote', 'get-url', 'origin'])

      // Handle SSH and HTTPS remote URLs
      const sshMatch = stdout.match(/git@github\.com:([^/]+)\/([^.]+)\.git/)
      const httpsMatch = stdout.match(/https:\/\/github\.com\/([^/]+)\/([^.]+)\.git/)

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

  private async tagRepository(owner: string, name: string, topic: string): Promise<void> {
    try {
      await execa('gh', ['api', `repos/${owner}/${name}/topics`, '--method', 'GET'], {
        reject: false,
      }).then(async (result) => {
        if (result.exitCode === 0) {
          try {
            const topicsData = JSON.parse(result.stdout)
            const topics = topicsData.names || []

            if (topics.includes(topic)) {
              this.log(chalk.blue(`Topic ${topic} already exists on ${owner}/${name}`))
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
            this.log(chalk.red(`Error updating topics: ${error}`))
          }
        } else {
          this.log(chalk.yellow(`Failed to get topics for ${owner}/${name}: ${result.stderr}`))
        }
      })
    } catch (error) {
      this.log(chalk.red(`Failed to tag repository ${owner}/${name}: ${error}`))
    }
  }

  private async validateMavenRepo(repoPath: string, verbose = false): Promise<boolean> {
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
    let spinnerInterval: NodeJS.Timeout | null = null

    try {
      if (verbose) {
        // Set up spinner for verbose mode
        const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        let spinIdx = 0
        const startTime = Date.now()

        spinnerInterval = setInterval(() => {
          const spinner = spinChars[spinIdx]
          spinIdx = (spinIdx + 1) % spinChars.length
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

          logUpdate(`${spinner} Validating Maven project (${elapsed}s)`)
        }, 100)
      }

      try {
        if (verbose) {
          await execa('mvn', ['help:effective-pom', '-f', pomPath])
          if (spinnerInterval) {
            clearInterval(spinnerInterval)
            logUpdate.clear()
          }
          if (verbose) {
            this.log(chalk.dim(`Maven validation successful`))
          }
        } else {
          await execa('mvn', ['help:effective-pom', '-f', pomPath, '-q'])
        }

        return true
      } catch (execError) {
        if (spinnerInterval) {
          clearInterval(spinnerInterval)
          logUpdate.clear()
        }

        if (execError instanceof Error && execError.message.includes('ENOENT')) {
          if (verbose) {
            this.log(chalk.yellow('Maven (mvn) command not found. Please install Maven.'))
          }
        } else if (verbose) {
          this.log(chalk.yellow(`Maven validation failed`))
        }

        return false
      }
    } catch {
      if (spinnerInterval) {
        clearInterval(spinnerInterval)
        logUpdate.clear()
      }
      return false
    }
  }
}
