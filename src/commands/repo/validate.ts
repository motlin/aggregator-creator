import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'
import logUpdate from 'log-update'

type RepoInfo = {
  path: string
  owner: string
  name: string
  hasPom: boolean
  valid: boolean
}

export default class RepoValidate extends Command {
  static override args = {
    repoPath: Args.string({
      description: 'Path to the repository or directory of repositories to validate',
      required: true,
    }),
  }

  static override description = 'Validates if directories contain valid Maven repositories'

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./path/to/repo',
    '<%= config.bin %> <%= command.id %> /path/to/repos-dir',
    '<%= config.bin %> <%= command.id %> ./repos-dir --output ./validated-repos.txt',
    '<%= config.bin %> <%= command.id %> ./repos-dir --copyTo ./validated-repos',
  ]

  static override flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output during validation',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file to write validated repository list',
    }),
    copyTo: Flags.string({
      char: 'c',
      description: 'Directory to copy validated repositories into',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoValidate)
    const {repoPath} = args

    const absolutePath = path.resolve(repoPath)
    const startTime = Date.now()

    try {
      // Check if path exists and is a directory
      const stats = await fs.stat(absolutePath)
      if (!stats.isDirectory()) {
        this.error(`Path is not a directory: ${absolutePath}`, {exit: 1})
      }

      // Gather repositories to validate
      const repos: RepoInfo[] = []

      // Check if this path is a specific repo or a collection of owner directories
      const hasPom = await fs.pathExists(path.join(absolutePath, 'pom.xml'))

      if (hasPom) {
        // This is a single repository
        const repoName = path.basename(absolutePath)
        const ownerName = path.basename(path.dirname(absolutePath))

        repos.push({
          path: absolutePath,
          owner: ownerName,
          name: repoName,
          hasPom: true,
          valid: false, // Will update during validation
        })
      } else {
        // This is potentially a directory of owner directories
        const ownerDirs = await fs.readdir(absolutePath, {withFileTypes: true})

        for (const ownerDir of ownerDirs.filter((entry) => entry.isDirectory())) {
          const ownerPath = path.join(absolutePath, ownerDir.name)
          const repoDirs = await fs.readdir(ownerPath, {withFileTypes: true})

          for (const repoDir of repoDirs.filter((entry) => entry.isDirectory())) {
            const repoPath = path.join(ownerPath, repoDir.name)
            const repoHasPom = await fs.pathExists(path.join(repoPath, 'pom.xml'))

            repos.push({
              path: repoPath,
              owner: ownerDir.name,
              name: repoDir.name,
              hasPom: repoHasPom,
              valid: false, // Will update during validation
            })
          }
        }
      }

      // Begin validation process
      this.log(`╭─── 🔍 Validating Maven repositories...`)
      this.log(`│`)

      let validCount = 0
      const validRepos: RepoInfo[] = []

      for (const [i, repo] of repos.entries()) {
        const repoFullName = `${repo.owner}/${repo.name}`

        this.log(`├──╮ 🔍 [${chalk.yellow(i + 1)}/${repos.length}] ${chalk.yellow(repoFullName)}`)

        if (!repo.hasPom) {
          this.log(`│  ╰ ⏩ Skipping non-Maven repository: ${chalk.yellow(repoFullName)}`)
          this.log(`│`)
          continue
        }

        const isValid = await this.validateMavenRepo(repo.path, flags.verbose)
        repo.valid = isValid

        if (isValid) {
          this.log(`│  ╰ ✅ Validation successful: ${chalk.green(repoFullName)}`)
          validCount++
          validRepos.push(repo)
        } else {
          this.log(`│  ╰ ❌ Validation failed: ${chalk.red(repoFullName)}`)
        }

        this.log(`│`)
      }

      this.log(
        `╰─── ✅ Found ${chalk.green(validCount)} validated Maven ${validCount === 1 ? 'repository' : 'repositories'}`,
      )

      // Handle output file
      if (flags.output && validRepos.length > 0) {
        const outputPath = path.resolve(flags.output)
        await fs.ensureDir(path.dirname(outputPath))

        const validRepoNames = validRepos.map((repo) => `${repo.owner}/${repo.name}`).join('\n')
        await fs.writeFile(outputPath, validRepoNames)

        this.log(`📄 Validated repository list written to: ${chalk.cyan(outputPath)}`)
      }

      // Handle copying repositories
      if (flags.copyTo && validRepos.length > 0) {
        const copyPath = path.resolve(flags.copyTo)
        await fs.ensureDir(copyPath)

        this.log(`📦 Copying ${validRepos.length} validated repositories...`)

        for (const repo of validRepos) {
          const destPath = path.join(copyPath, repo.owner, repo.name)
          await fs.ensureDir(path.dirname(destPath))
          await fs.copy(repo.path, destPath)
        }

        this.log(`✅ Successfully copied validated repositories to: ${chalk.cyan(copyPath)}`)
      }

      // Show elapsed time
      const elapsedMs = Date.now() - startTime
      this.debug(`Validation completed in ${elapsedMs}ms`)
    } catch (error) {
      this.error(`Error validating repositories: ${error}`, {exit: 1})
    }
  }

  public async validateMavenRepo(repoPath: string, verbose = false): Promise<boolean> {
    const absolutePath = path.resolve(repoPath)

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
        return false
      }
    } catch {
      return false
    }

    // Run Maven validation using help:effective-pom
    try {
      let spinnerInterval: NodeJS.Timeout | null = null

      if (verbose) {
        // Set up spinner for verbose mode
        const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        let spinIdx = 0
        const startTime = Date.now()

        spinnerInterval = setInterval(() => {
          const spinner = spinChars[spinIdx]
          spinIdx = (spinIdx + 1) % spinChars.length
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

          logUpdate(`│  │ ${spinner} Running: mvn help:effective-pom -f ${pomPath} (${elapsed}s)`)
        }, 100)
      }

      try {
        if (verbose) {
          const result = await execa('mvn', ['help:effective-pom', '-f', pomPath])
          if (spinnerInterval) {
            clearInterval(spinnerInterval)
            logUpdate.clear()
          }
          if (verbose) {
            this.log(`│  │ Maven validation output:`)
            this.log(
              result.stdout
                .split('\n')
                .slice(0, 5)
                .map((line) => `│  │ ${line}`)
                .join('\n'),
            )
            this.log(`│  │ ...`)
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
            this.log(`│  │ ${chalk.yellow('Maven (mvn) command not found. Please install Maven.')}`)
          }
        } else if (verbose) {
          this.log(`│  │ ${chalk.yellow(`Maven validation failed`)}`)
          this.debug(`Validation error: ${execError}`)
        }

        return false
      }
    } catch {
      return false
    }
  }
}
