import {Args, Command} from '@oclif/core'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as readline from 'readline'
import {execa} from 'execa'
import {z} from 'zod'

export default class RepoClone extends Command {
  static override description = 'Clone GitHub repositories listed from stdin'

  static override examples = [
    'echo "owner/repo" | <%= config.bin %> <%= command.id %> ./target-dir',
    'cat repos.txt | <%= config.bin %> <%= command.id %> ./target-dir',
    '<%= config.bin %> repo:list --user someuser --limit 10 --json | <%= config.bin %> <%= command.id %> ./target-dir',
  ]

  static override args = {
    targetDirectory: Args.string({description: 'Directory to clone repositories into', required: true})
  }

  // Schema for validating repository format
  private repoNameSchema = z.string().regex(/^[^/]+\/[^/]+$/, 'Repository must be in format "owner/repo"')

  private async execute(command: string, args: string[] = [], options: any = {}): Promise<any> {
    const silent = options.silent === true
    
    if (!silent) {
      this.log(`Executing: ${command} ${args.join(' ')}`)
    }
    
    try {
      return await execa(command, args, options)
    } catch (error) {
      if (!silent) {
        this.error(`Command failed: ${command} ${args.join(' ')}`)
        this.error(`${(error as any).stderr || (error as Error).message}`)
      }
      throw error
    }
  }

  public async run(): Promise<void> {
    const {args} = await this.parse(RepoClone)
    const targetDirectory = args.targetDirectory
    
    // Validate GitHub CLI is installed
    try {
      await execa('gh', ['--version'])
    } catch (error) {
      this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {exit: 1})
    }
    
    // Validate GitHub CLI authentication
    try {
      await execa('gh', ['auth', 'status'])
    } catch (error) {
      this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {exit: 1})
    }
    
    // Ensure target directory exists
    await fs.ensureDir(targetDirectory)
    
    // Check if stdin is available (being piped)
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      })
      
      let successCount = 0
      let errorCount = 0
      const errors: {repo: string; error: string}[] = []
      
      this.log(`Cloning repositories into ${path.resolve(targetDirectory)}...`)
      
      // Process input line by line
      for await (const line of rl) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue
        
        try {
          // Check if the input is JSON
          try {
            const jsonData = JSON.parse(trimmedLine)
            
            // Handle JSON array from repo:list command
            if (Array.isArray(jsonData)) {
              for (const repo of jsonData) {
                if (repo.owner?.login && repo.name) {
                  const repoFullName = `${repo.owner.login}/${repo.name}`
                  await this.cloneRepository(repoFullName, targetDirectory)
                  successCount++
                }
              }
              continue
            } else if (jsonData.owner?.login && jsonData.name) {
              // Handle single JSON object
              const repoFullName = `${jsonData.owner.login}/${jsonData.name}`
              await this.cloneRepository(repoFullName, targetDirectory)
              successCount++
              continue
            }
          } catch (e) {
            // Not JSON, continue with normal processing
          }
          
          // Validate repository format
          try {
            this.repoNameSchema.parse(trimmedLine)
          } catch (error) {
            if (error instanceof z.ZodError) {
              this.warn(`Invalid repository format: ${trimmedLine} - must be in format "owner/repo"`)
              errorCount++
              errors.push({repo: trimmedLine, error: 'Invalid format'})
              continue
            }
            throw error
          }
          
          await this.cloneRepository(trimmedLine, targetDirectory)
          successCount++
        } catch (error) {
          errorCount++
          errors.push({
            repo: trimmedLine,
            error: (error as Error).message
          })
        }
      }
      
      // Output summary
      this.log('\nCloning summary:')
      this.log(`✅ Successfully cloned: ${successCount}`)
      
      if (errorCount > 0) {
        this.log(`❌ Failed to clone: ${errorCount}`)
        this.log('\nErrors:')
        for (const {repo, error} of errors) {
          this.log(`- ${repo}: ${error}`)
        }
      }
    } else {
      this.error('No input provided. This command expects repository data from stdin.', {exit: 1})
    }
  }
  
  private async cloneRepository(repoName: string, targetDirectory: string): Promise<void> {
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
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    
    this.log(`📦 Cloning ${repoName} into ${repoDir}...`)
    
    try {
      await this.execute('gh', ['repo', 'clone', repoName, repoDir])
      this.log(`✅ Successfully cloned ${repoName}`)
    } catch (error) {
      this.error(`❌ Failed to clone ${repoName}: ${(error as Error).message}`)
      throw error
    }
  }
}
