import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa as execa_} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'

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

    const execa = execa_({
      verbose: (verboseLine: string, {type}: {type: string}) => {
        switch (type) {
          case 'command': {
            this.log(`│  │  ├──╮ ${verboseLine}`)
            break
          }
          case 'duration': {
            this.log(`│  │  ├──╯ ${verboseLine}`)
            break
          }
          case 'output': {
            const MAX_LENGTH = 120
            const truncatedLine =
              verboseLine.length > MAX_LENGTH ? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...` : verboseLine
            this.log(`│  │  │  │ ${truncatedLine}`)
            break
          }
          default: {
            this.debug(`${type} ${verboseLine}`)
          }
        }
      },
    })

    const absolutePath = path.resolve(repoPath)
    const startTime = Date.now()

    try {
      const stats = await fs.stat(absolutePath)
      if (!stats.isDirectory()) {
        this.error(`Path is not a directory: ${absolutePath}`, {exit: 1})
      }

      const repos: RepoInfo[] = []

      const hasPom = await fs.pathExists(path.join(absolutePath, 'pom.xml'))

      if (hasPom) {
        const repoName = path.basename(absolutePath)
        const ownerName = path.basename(path.dirname(absolutePath))

        repos.push({
          path: absolutePath,
          owner: ownerName,
          name: repoName,
          hasPom: true,
          valid: false,
        })
      } else {
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
              valid: false,
            })
          }
        }
      }

      this.log(`╭─── 🔍 Validating Maven repositories...`)
      this.log(`│`)

      let validCount = 0
      const validRepos: RepoInfo[] = []

      for (const [i, repo] of repos.entries()) {
        const repoFullName = `${repo.owner}/${repo.name}`

        this.log(`├──╮ 🔍 [${chalk.yellow(i + 1)}/${repos.length}] ${chalk.yellow(repoFullName)}`)

        if (!repo.hasPom) {
          this.log(`├──╯ ⏩ Skipping non-Maven repository: ${chalk.yellow(repoFullName)}`)
          this.log(`│`)
          continue
        }

        const isValid = await this.validateMavenRepo(repo.path, execa, flags.verbose)
        repo.valid = isValid

        if (isValid) {
          this.log(`├──╯ ✅ Validation successful: ${chalk.green(repoFullName)}`)
          validCount++
          validRepos.push(repo)
        } else {
          this.log(`├──╯ ❌ Validation failed: ${chalk.red(repoFullName)}`)
        }

        this.log(`│`)
      }

      this.log(
        `╰─── ✅ Found ${chalk.green(validCount)} validated Maven ${validCount === 1 ? 'repository' : 'repositories'}`,
      )

      if (flags.output && validRepos.length > 0) {
        const outputPath = path.resolve(flags.output)
        await fs.ensureDir(path.dirname(outputPath))

        const validRepoNames = validRepos.map((repo) => `${repo.owner}/${repo.name}`).join('\n')
        await fs.writeFile(outputPath, validRepoNames)

        this.log(`├──╮ 📄 Validated repository list written to: ${chalk.cyan(outputPath)}`)
        this.log(`├──╯`)
      }

      if (flags.copyTo && validRepos.length > 0) {
        const copyPath = path.resolve(flags.copyTo)
        await fs.ensureDir(copyPath)

        this.log(`├──╮ 📦 Copying ${validRepos.length} validated repositories...`)

        for (const repo of validRepos) {
          const destPath = path.join(copyPath, repo.owner, repo.name)
          await fs.ensureDir(path.dirname(destPath))
          await fs.copy(repo.path, destPath)
          this.log(`│  │ ${chalk.green(`✓ Copied ${repo.owner}/${repo.name}`)}`)
        }

        this.log(`├──╯ ${chalk.green(`✅ Successfully copied repositories to: ${copyPath}`)}`)
      }

      const elapsedMs = Date.now() - startTime
      this.debug(`Validation completed in ${elapsedMs}ms`)
    } catch (error) {
      this.error(`Error validating repositories: ${error}`, {exit: 1})
    }
  }

  public async validateMavenRepo(repoPath: string, execa: typeof execa_, _verbose = false): Promise<boolean> {
    const absolutePath = path.resolve(repoPath)

    try {
      const stats = await fs.stat(absolutePath)
      if (!stats.isDirectory()) {
        return false
      }
    } catch {
      return false
    }

    const pomPath = path.join(absolutePath, 'pom.xml')
    try {
      const pomExists = await fs.pathExists(pomPath)
      if (!pomExists) {
        return false
      }
    } catch {
      return false
    }

    try {
      await execa('mvn', ['help:effective-pom', '--quiet', '--file', pomPath])
      return true
    } catch (execError) {
      if (execError instanceof Error && execError.message.includes('ENOENT')) {
        this.log(`│  │ ${chalk.yellow('Maven (mvn) command not found. Please install Maven.')}`)
      }
      return false
    }
  }
}
