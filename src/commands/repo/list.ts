import {Command, Flags} from '@oclif/core'
import {execa} from 'execa'
import * as fs from 'fs-extra'
import {z} from 'zod'

export default class RepoList extends Command {
  static override description = 'List GitHub repositories based on filters'
  
  static override examples = [
    '<%= config.bin %> <%= command.id %> --user motlin --limit 10',
    '<%= config.bin %> <%= command.id %> --user motlin --topic maven --language Java --json',
  ]
  
  static override flags = {
    user: Flags.string({char: 'u', description: 'GitHub username/org'}),
    topic: Flags.string({char: 't', description: 'Topic filter', multiple: true}),
    language: Flags.string({char: 'g', description: 'Language filter', default: 'Java'}),
    limit: Flags.integer({char: 'l', description: 'Max repositories', required: true, default: 100}),
    json: Flags.boolean({description: 'Output result as JSON'})
  }

  // Repository schema for validation
  private repoSchema = z.object({
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
    html_url: z.string().url(),
    description: z.string().nullable(),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
  })

  private repositoriesSchema = z.array(this.repoSchema)

  private async fetchRepositories(
    username: string,
    topics: string[] = [],
    language: string,
    limit: number,
  ): Promise<z.infer<typeof this.repositoriesSchema>> {
    this.log(`🔍 Fetching GitHub repositories for user: ${username}`)
    
    try {
      // Build the GitHub API search query
      const topicQueries = topics.map(topic => `topic:${topic}`).join(' ')
      const languageQuery = language ? `language:${language}` : ''
      const query = `user:${username} ${topicQueries} ${languageQuery}`.trim()
      
      // Execute GitHub search API call
      const {stdout} = await execa('gh', [
        'api',
        '-X', 'GET',
        'search/repositories',
        '-f', `q=${query}`,
        '-f', `per_page=${Math.min(limit, 100)}`,
        '--jq', '.items',
      ])
      
      // Parse and validate the response
      const repositories = JSON.parse(stdout)
      return this.repositoriesSchema.parse(repositories)
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error('Invalid repository data format received from GitHub API', {exit: 1})
      }
      
      this.error(`Failed to fetch repositories: ${(error as Error).message}`, {exit: 1})
      throw error // TypeScript needs this even though we'll never reach here
    }
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(RepoList)
    
    // Validate that GitHub CLI is installed
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
    
    if (!flags.user) {
      this.error('GitHub username/organization is required. Use --user flag.', {exit: 1})
    }

    try {
      const repositories = await this.fetchRepositories(
        flags.user,
        flags.topic ? (Array.isArray(flags.topic) ? flags.topic : [flags.topic]) : [],
        flags.language,
        flags.limit,
      )
      
      if (repositories.length === 0) {
        this.log('No repositories found matching the criteria.')
        return
      }
      
      if (flags.json) {
        // Output as JSON to stdout
        process.stdout.write(JSON.stringify(repositories, null, 2))
      } else {
        // Format and display repositories
        this.log(`Found ${repositories.length} repositories:`)
        for (const repo of repositories) {
          const topicsStr = repo.topics && repo.topics.length > 0 
            ? `[${repo.topics.join(', ')}]` 
            : ''
          
          this.log(`- ${repo.owner.login}/${repo.name} (${repo.language || 'No language'}) ${topicsStr}`)
        }
      }
    } catch (error) {
      this.error(`Error: ${(error as Error).message}`, {exit: 1})
    }
  }
}
