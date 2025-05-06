import {Args, Command} from '@oclif/core'
import * as fs from 'fs-extra'
import path from 'node:path'
import {execa, type Options, type Result} from 'execa'
import {z} from 'zod'

export default class RepoClone extends Command {
  static override description = 'Clone GitHub repositories listed from stdin'

  static override examples = [
    'echo "owner/repo" | <%= config.bin %> <%= command.id %> ./target-dir',
    'cat repos.txt | <%= config.bin %> <%= command.id %> ./target-dir',
    '<%= config.bin %> repo:list --user someuser --limit 10 --json | <%= config.bin %> <%= command.id %> ./target-dir',
  ]

  static override args = {
    targetDirectory: Args.string({description: 'Directory to clone repositories into', required: true}),
  }

  // Schema for validating repository format
  private repoNameSchema = z.string().regex(/^[^/]+\/[^/]+$/, 'Repository must be in format "owner/repo"')

  private async execute(
    command: string,
    args: string[] = [],
    options: Options & {silent?: boolean} = {},
  ): Promise<Result> {
    const silent = options.silent === true

    if (!silent) {
      this.log(`Executing: ${command} ${args.join(' ')}`)
    }

    try {
      return await execa(command, args, options)
    } catch (error: unknown) {
      if (!silent) {
        this.error(`Command failed: ${command} ${args.join(' ')}`)
        const errorObj = error as Error & {stderr?: string}
        this.error(`${errorObj.stderr || errorObj.message}`)
      }
      throw error
    }
  }

  public async run(): Promise<void> {
    const {args} = await this.parse(RepoClone)
    const {targetDirectory} = args

    // Validate GitHub CLI is installed
    try {
      await execa('gh', ['--version'])
    } catch {
      this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {
        exit: 1,
      })
    }

    // Validate GitHub CLI authentication
    try {
      await execa('gh', ['auth', 'status'])
    } catch {
      this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {exit: 1})
    }

    // Ensure target directory exists
    await fs.ensureDir(targetDirectory)

    // Check if stdin is available (being piped)
    if (process.stdin.isTTY) {
      this.error('No input provided. This command expects repository data from stdin.', {exit: 1})
    } else {
      const resolvedPath = path.resolve(targetDirectory)
      this.log(`Cloning repositories into ${resolvedPath}...`)

      let successCount = 0

      // Collect all input first
      let fullInput = ''
      for await (const chunk of process.stdin) {
        fullInput += chunk
      }

      // Try to parse as JSON first (for the case of --json output from repo:list)
      try {
        const jsonData = JSON.parse(fullInput)

        // Handle JSON array from repo:list command
        if (Array.isArray(jsonData)) {
          // Filter out only valid repositories with owner and name
          const validRepos = jsonData.filter((repo) => repo.owner?.login && repo.name)
          const total = validRepos.length

          for (const [i, repo] of validRepos.entries()) {
            const repoFullName = `${repo.owner.login}/${repo.name}`
            await this.cloneRepository(repoFullName, targetDirectory, i + 1, total)
            successCount++
          }

          // Output summary (this will only be reached if no error occurred)
          this.log('\nCloning summary:')
          this.log(`✅ Successfully cloned: ${successCount}`)
        } else if (jsonData.owner?.login && jsonData.name) {
          // Handle single JSON object
          const repoFullName = `${jsonData.owner.login}/${jsonData.name}`
          await this.cloneRepository(repoFullName, targetDirectory, 1, 1)

          this.log('\nCloning summary:')
          this.log(`✅ Successfully cloned: 1`)
        }
      } catch {
        // Not valid JSON, process line by line
        const lines = fullInput.split('\n')
        // Filter out empty lines and collect valid repos
        const validLines = lines.map((line) => line.trim()).filter((line) => line.length > 0)

        const total = validLines.length

        for (const [i, trimmedLine] of validLines.entries()) {
          // Validate repository format
          try {
            this.repoNameSchema.parse(trimmedLine)
          } catch (error: unknown) {
            if (error instanceof z.ZodError) {
              this.error(`Invalid repository format: ${trimmedLine} - must be in format "owner/repo"`, {exit: 1})
            }
            throw error
          }

          await this.cloneRepository(trimmedLine, targetDirectory, i + 1, total)
          successCount++
        }

        // Output summary (only reached if all operations succeeded)
        this.log('\nCloning summary:')
        this.log(`✅ Successfully cloned: ${successCount}`)
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

    // Ensure the parent directory exists
    await fs.ensureDir(path.dirname(repoDir))

    // Check if directory already exists and is not empty
    try {
      const dirContents = await fs.readdir(repoDir)
      if (dirContents.length > 0) {
        this.log(`⚠️  Repository directory already exists and is not empty: ${repoDir}. Skipping.`)
        return
      }
    } catch {
      // Directory doesn't exist, which is fine
    }

    const relativeRepoDir = path.relative(targetDirectory, repoDir)
    this.log(`📦 Cloning ${repoName} into ${relativeRepoDir}... (${index}/${total})`)

    try {
      await this.execute('gh', ['repo', 'clone', repoName, repoDir])
      this.log(`✅ Successfully cloned ${repoName}`)
    } catch (error: unknown) {
      this.error(`❌ Failed to clone ${repoName}: ${error instanceof Error ? error.message : String(error)}`, {exit: 1})
      // With exit: 1, we won't reach here, but TypeScript needs this for type safety
      throw error
    }
  }
}
