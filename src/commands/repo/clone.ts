import {Args, Command} from '@oclif/core'
import * as fs from 'fs-extra'
import path from 'node:path'
import {execa as execa_} from 'execa'
import {z} from 'zod'
import chalk from 'chalk'
import {repositoriesSchema, repositorySchema} from '../../types/repository.js'

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

  public async run(): Promise<void> {
    const {args} = await this.parse(RepoClone)
    const {targetDirectory} = args

    const execa = execa_({
      verbose: (verboseLine: string, {type}: {type: string}) => {
        switch (type) {
          case 'command': {
            this.log(`│  │  │ ${verboseLine}`)
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

    if (process.stdin.isTTY) {
      this.error('No input provided. This command expects repository data from stdin.', {
        exit: 1,
        code: 'NO_INPUT',
        suggestions: [
          'Pipe repository data into this command',
          'Example: echo "owner/repo" | aggregator repo:clone ./target-dir',
          'Example: aggregator repo:list --user someuser --json | aggregator repo:clone ./target-dir',
        ],
      })
    } else {
      this.log(`╭─── 📦 Cloning repositories...`)
      this.log(`│`)
      this.log(`├──╮ 🔍 Prerequisites`)

      try {
        this.log(`│  ├──╮ Check gh CLI`)
        await execa('gh', ['--version'])
        this.log(`│  │`)
      } catch {
        this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {
          exit: 1,
          code: 'GH_NOT_FOUND',
          suggestions: [
            'Install GitHub CLI from https://cli.github.com/',
            'On macOS: brew install gh',
            'On Linux: See installation instructions at https://cli.github.com/manual/installation',
          ],
        })
      }

      try {
        this.log(`│  ├──╮ Check gh auth status`)
        await execa('gh', ['auth', 'status'])
        this.log(`│  │`)
      } catch {
        this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {
          exit: 1,
          code: 'GH_AUTH_REQUIRED',
          suggestions: [
            'Run: gh auth login',
            'Follow the prompts to authenticate with GitHub',
            'Ensure you have the necessary permissions for the repositories',
          ],
        })
      }

      this.log(`├──╯ ✅ Prerequisites complete`)
      this.log(`│`)

      await fs.ensureDir(targetDirectory)
      let fullInput = ''
      for await (const chunk of process.stdin) {
        fullInput += chunk
      }

      try {
        const jsonData = JSON.parse(fullInput)
        if (Array.isArray(jsonData)) {
          const validRepos = repositoriesSchema.parse(jsonData)
          const total = validRepos.length

          this.log(`├──╮ 🚀 Cloning ${chalk.yellow(total)} repositories`)

          for (const [i, repo] of validRepos.entries()) {
            const repoFullName = `${repo.owner.login}/${repo.name}`
            await this.cloneRepository(repoFullName, targetDirectory, i + 1, total, execa)
          }

          this.log(`├──╯ Cloning complete`)
          this.log(`│`)
          this.log(`╰─── ✅ All done`)
        } else {
          const validRepo = repositorySchema.parse(jsonData)
          const total = 1
          this.log(`├──╮ 🚀 Cloning ${chalk.yellow(1)} repository`)

          const repoFullName = `${validRepo.owner.login}/${validRepo.name}`
          await this.cloneRepository(repoFullName, targetDirectory, 1, total, execa)

          this.log(`├──╯ Cloning complete`)
          this.log(`│`)
          this.log(`╰─── ✅ All done`)
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Fall through to handle as plain text input
        } else if (error instanceof SyntaxError) {
          // Fall through to handle as plain text input
        } else {
          throw error
        }
        const lines = fullInput.split('\n')
        const validLines = lines.map((line) => line.trim()).filter((line) => line.length > 0)

        const total = validLines.length

        this.log(`├──╮ 🚀 Cloning ${chalk.yellow(total)} ${total === 1 ? 'repository' : 'repositories'}`)

        for (const [i, trimmedLine] of validLines.entries()) {
          try {
            this.repoNameSchema.parse(trimmedLine)
          } catch (error: unknown) {
            if (error instanceof z.ZodError) {
              this.error(`Invalid repository format: ${trimmedLine} - must be in format "owner/repo"`, {
                exit: 1,
                code: 'INVALID_REPO_FORMAT',
                suggestions: [
                  'Repository must be in format "owner/repo"',
                  'Example: facebook/react',
                  'Example: microsoft/typescript',
                ],
              })
            }
            throw error
          }

          await this.cloneRepository(trimmedLine, targetDirectory, i + 1, total, execa)
        }

        this.log(`├──╯ Cloning complete`)
        this.log(`│`)
        this.log(`╰── ✅ All done`)
      }
    }
  }

  private async cloneRepository(
    repoName: string,
    targetDirectory: string,
    index: number,
    total: number,
    execa: typeof execa_,
  ): Promise<void> {
    const [owner, repo] = repoName.split('/')
    const repoDir = path.join(targetDirectory, owner, repo)

    await fs.ensureDir(path.dirname(repoDir))

    try {
      const dirContents = await fs.readdir(repoDir)
      if (dirContents.length > 0) {
        this.log(`│  ├──╮ [${chalk.yellow(index)}/${total}] ${chalk.yellow(repoName)}`)
        this.log(`│  │  │ Skipped: Directory already exists and is not empty`)
        this.log(`│  ├──╯`)
        this.log(`│  │`)
        return
      }
    } catch {
      // Directory doesn't exist, which is fine
    }

    this.log(`│  ├──╮ [${chalk.yellow(index)}/${total}] ${chalk.yellow(repoName)}`)

    try {
      await execa('gh', ['repo', 'clone', repoName, repoDir])
    } catch (error: unknown) {
      this.log(`│  │  │ ❌ Failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`│  ├──╯`)
      this.log(`│  │`)
      this.error('Repository cloning failed', {
        exit: 1,
        code: 'CLONE_FAILED',
        suggestions: [
          'Check if the repository exists and is accessible',
          'Verify your GitHub authentication status: gh auth status',
          'Ensure you have permission to clone the repository',
        ],
      })
      throw error
    }
  }
}
