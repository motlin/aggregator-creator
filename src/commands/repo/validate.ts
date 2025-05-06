import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'

export default class RepoValidate extends Command {
  static override args = {
    repoPath: Args.string({
      description: 'Path to the repository to validate',
      required: true,
    }),
  }
  static override description = 'Validates if a directory is a valid Maven repository'
  static override examples = [
    '<%= config.bin %> <%= command.id %> ./path/to/repo',
    '<%= config.bin %> <%= command.id %> /absolute/path/to/repo',
  ]
  static override flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output during validation',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoValidate)
    const {repoPath} = args

    this.log(`Validating Maven repository at: ${repoPath}`)

    const isValid = await this.validateMavenRepo(repoPath, flags.verbose)

    if (isValid) {
      this.log(chalk.green(`✅ Repository is a valid Maven project: ${repoPath}`))
    } else {
      this.error(chalk.red(`❌ Repository validation failed: ${repoPath}`), {exit: 1})
    }
  }

  public async validateMavenRepo(repoPath: string, verbose = false): Promise<boolean> {
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
