import {Args, Command} from '@oclif/core'
import * as fs from 'fs-extra'
import path from 'node:path'
import {execa, type Options, type Result} from 'execa'
import {z} from 'zod'
import chalk from 'chalk'

export default class RepoClone extends Command {
  static override description = 'Clone GitHub repositories listed from stdin'

  static override examples = [
    'echo "owner/repo" | <%= config.bin %> <%= command.id %> ./target-dir',
    'cat repos.txt | <%= config.bin %> <%= command.id %> ./target-dir',
    '<%= config.bin %> repo:list --user someuser --limit 100 --json | <%= config.bin %> <%= command.id %> ./target-dir',
  ]

  static override args = {
    targetDirectory: Args.string({description: 'Directory to clone repositories into', required: true}),
  }

  private repoNameSchema = z.string().regex(/^[^/]+\/[^/]+$/, 'Repository must be in format "owner/repo"')

  private async execute(
    command: string,
    args: string[] = [],
    options: Options & {silent?: boolean} = {},
  ): Promise<Result> {
    const silent = options.silent === true

    if (!silent) {
      this.log(`├─ Executing: ${command} ${args.join(' ')}`)
    }

    try {
      return await execa(command, args, options)
    } catch (error: unknown) {
      if (!silent) {
        this.error(`├─ Command failed: ${command} ${args.join(' ')}`)
        const errorObj = error as Error & {stderr?: string}
        this.error(`└─ ${errorObj.stderr || errorObj.message}`)
      }
      throw error
    }
  }

  public async run(): Promise<void> {
    const {args} = await this.parse(RepoClone)
    const {targetDirectory} = args

    try {
      await execa('gh', ['--version'])
    } catch {
      this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {
        exit: 1,
      })
    }

    try {
      await execa('gh', ['auth', 'status'])
    } catch {
      this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {exit: 1})
    }

    await fs.ensureDir(targetDirectory)

    if (process.stdin.isTTY) {
      this.error('No input provided. This command expects repository data from stdin.', {exit: 1})
    } else {
      let fullInput = ''
      for await (const chunk of process.stdin) {
        fullInput += chunk
      }

      try {
        const jsonData = JSON.parse(fullInput)
        if (Array.isArray(jsonData)) {
          const validRepos = jsonData.filter((repo) => repo.owner?.login && repo.name)
          const total = validRepos.length

          this.log(`╭─── 🚀 [0/${total}] Cloning All Repositories `)
          this.log(`│     `)

          for (const [i, repo] of validRepos.entries()) {
            const repoFullName = `${repo.owner.login}/${repo.name}`
            await this.cloneRepository(repoFullName, targetDirectory, i + 1, total)
            this.log(`│     `)
          }

          this.log(`╰─── 🏁 All repositories cloned successfully`)
        } else if (jsonData.owner?.login && jsonData.name) {
          const total = 1
          this.log(`╭─── 🚀 [0/${total}] Cloning All Repositories `)
          this.log(`│     `)

          const repoFullName = `${jsonData.owner.login}/${jsonData.name}`
          await this.cloneRepository(repoFullName, targetDirectory, 1, total)
          this.log(`│     `)

          this.log(`╰─── 🏁 All repositories cloned successfully`)
        }
      } catch {
        const lines = fullInput.split('\n')
        const validLines = lines.map((line) => line.trim()).filter((line) => line.length > 0)

        const total = validLines.length

        this.log(`╭─── 🚀 [0/${total}] Cloning All Repositories `)
        this.log(`│     `)

        for (const [i, trimmedLine] of validLines.entries()) {
          try {
            this.repoNameSchema.parse(trimmedLine)
          } catch (error: unknown) {
            if (error instanceof z.ZodError) {
              this.error(`Invalid repository format: ${trimmedLine} - must be in format "owner/repo"`, {exit: 1})
            }
            throw error
          }

          await this.cloneRepository(trimmedLine, targetDirectory, i + 1, total)
          this.log(`│     `)
        }

        this.log(`╰─── 🏁 All repositories cloned successfully`)
      }
    }
  }

  private async cloneRepository(
    repoName: string,
    targetDirectory: string,
    index: number,
    total: number,
  ): Promise<void> {
    const [owner, repo] = repoName.split('/')
    const repoDir = path.join(targetDirectory, owner, repo)

    await fs.ensureDir(path.dirname(repoDir))

    try {
      const dirContents = await fs.readdir(repoDir)
      if (dirContents.length > 0) {
        this.log(`⚠️  Repository directory already exists and is not empty: ${repoDir}. Skipping.`)
        return
      }
    } catch {
      // Directory doesn't exist, which is fine
    }

    this.log(`├──╮ 📦 [${chalk.yellow(index)}/${total}] Cloning ${chalk.yellow(repoName)}`)

    try {
      this.log(`│  │ 🔄 Running gh clone for ${repoName}`)
      await this.execute('gh', ['repo', 'clone', repoName, repoDir], {silent: true})
      this.log(`│  ╰ ✅ Successfully cloned ${repoName}`)
    } catch (error: unknown) {
      this.error(`│  ╰ ❌ Failed to clone ${repoName}: ${error instanceof Error ? error.message : String(error)}`, {
        exit: 1,
      })
      throw error
    }
  }
}
