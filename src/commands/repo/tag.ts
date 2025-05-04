import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'

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
    '<%= config.bin %> <%= command.id %> ./repos-dir --topic maven --dry-run',
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
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoTag)
    const {directory} = args
    const {topic, dryRun, verbose} = flags

    this.log(`Scanning directory: ${directory} for repositories to tag with topic: ${topic}`)
    if (dryRun) {
      this.log(chalk.yellow('Running in dry-run mode - no changes will be applied'))
    }

    try {
      const absolutePath = path.resolve(directory)
      const entries = await fs.readdir(absolutePath, {withFileTypes: true})
      
      // Filter for directories only
      const dirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
      
      this.log(`Found ${dirs.length} directories to check`)

      for (const repoDir of dirs) {
        const repoPath = path.join(absolutePath, repoDir)
        await this.processRepository(repoPath, topic, dryRun, verbose)
      }
      
      this.log(chalk.green('✅ Repository tagging process completed'))
    } catch (error) {
      this.error(`Failed to process repositories: ${error}`, {exit: 1})
    }
  }

  private async processRepository(
    repoPath: string, 
    topic: string, 
    dryRun: boolean, 
    verbose: boolean
  ): Promise<void> {
    try {
      this.log(`Processing repository: ${path.basename(repoPath)}`)
      
      // Check if it's a git repository
      if (!await this.isGitRepository(repoPath)) {
        this.log(chalk.yellow(`Skipping ${path.basename(repoPath)} - not a git repository`))
        return
      }
      
      // Validate as Maven repository
      const isValid = await this.validateMavenRepo(repoPath, verbose)
      
      if (isValid) {
        this.log(chalk.green(`✓ Valid Maven repository: ${path.basename(repoPath)}`))
        
        // Get repository owner and name from remote URL
        const {owner, name} = await this.getRepoOwnerAndName(repoPath)
        
        if (owner && name) {
          if (dryRun) {
            this.log(chalk.blue(`[DRY RUN] Would tag ${owner}/${name} with topic: ${topic}`))
          } else {
            await this.tagRepository(owner, name, topic)
            this.log(chalk.green(`✓ Tagged ${owner}/${name} with topic: ${topic}`))
          }
        } else {
          this.log(chalk.yellow(`Could not determine GitHub owner/name for ${path.basename(repoPath)}`))
        }
      } else {
        this.log(chalk.yellow(`Skipping ${path.basename(repoPath)} - not a valid Maven repository`))
      }
    } catch (error) {
      this.log(chalk.red(`Error processing ${path.basename(repoPath)}: ${error}`))
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
      }).then(async result => {
        if (result.exitCode === 0) {
          try {
            const topicsData = JSON.parse(result.stdout)
            const topics = topicsData.names || []

            if (!topics.includes(topic)) {
              topics.push(topic)
              await execa('gh', [
                'api', 
                `repos/${owner}/${name}/topics`, 
                '--method', 'PUT', 
                '-f', `names[]=${topics.join('&names[]=')}`
              ])
            } else {
              this.log(chalk.blue(`Topic ${topic} already exists on ${owner}/${name}`))
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
        this.error(`Path is not a directory: ${absolutePath}`, {exit: false})
        return false
      }
    } catch {
      this.error(`Directory does not exist: ${absolutePath}`, {exit: false})
      return false
    }

    // Check for pom.xml
    const pomPath = path.join(absolutePath, 'pom.xml')
    try {
      const pomExists = await fs.pathExists(pomPath)
      if (!pomExists) {
        this.warn(`No pom.xml found at: ${pomPath}`)
        return false
      }
    } catch (error) {
      this.error(`Error checking for pom.xml: ${error}`, {exit: false})
      return false
    }

    // Run Maven validation using help:effective-pom
    try {
      if (verbose) this.log(`Running mvn help:effective-pom on: ${pomPath}`)

      try {
        if (verbose) {
          const result = await execa('mvn', ['help:effective-pom', '-f', pomPath])
          this.log(result.stdout)
        } else {
          await execa('mvn', ['help:effective-pom', '-f', pomPath, '-q'])
        }

        return true
      } catch (execError) {
        if (execError instanceof Error && execError.message.includes('ENOENT')) {
          this.log(chalk.yellow('Maven (mvn) command not found. Please install Maven.'))
        } else {
          this.log(chalk.yellow(`Maven validation failed for: ${absolutePath}`))
          if (verbose) this.debug(`Validation error: ${execError}`)
        }

        return false
      }
    } catch (error) {
      this.error(`Unexpected error during validation: ${error}`, {exit: false})
      return false
    }
  }
}