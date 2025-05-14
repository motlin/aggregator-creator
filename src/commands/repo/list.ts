import {Command, Flags} from '@oclif/core'
import {execa as execa_} from 'execa'
import {z} from 'zod'

export default class RepoList extends Command {
  static override description = 'List GitHub repositories based on filters'

  static override examples = [
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --language Java --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --topic maven --language Java --json',
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100 --json',
  ]

  static override enableJsonFlag = true

  static override flags = {
    user: Flags.string({char: 'u', description: 'GitHub username/org'}),
    topic: Flags.string({char: 't', description: 'Topic filter', multiple: true}),
    language: Flags.string({char: 'g', description: 'Language filter', multiple: true}),
    limit: Flags.integer({char: 'l', description: 'Max repositories'}),
  }

  // Repository schema for validation
  private repoSchema = z.object({
    name: z.string(),
    owner: z.object({
      login: z.string(),
      type: z.string(),
    }),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
    fork: z.boolean(),
    archived: z.boolean(),
    disabled: z.boolean(),
    is_template: z.boolean(),
  })

  private repositoriesSchema = z.array(this.repoSchema)

  private async fetchRepositories(
    username: string,
    topics: string[] = [],
    languages: string[] = [],
    limit: number | undefined,
    execa: typeof execa_,
  ): Promise<z.infer<typeof this.repositoriesSchema>> {
    this.log(`├──╮ 🔍 Fetching GitHub repositories for user: ${username}`)

    try {
      this.log(`│  ├──╮ Building search query`)
      // Build the GitHub API search query
      const topicQueries = topics.map((topic) => `topic:${topic}`).join(' ')
      const languageQueries = languages.map((language) => `language:${language}`).join(' ')
      const query = `user:${username} ${topicQueries} ${languageQueries}`.trim()
      this.log(`│  │  │ Query: ${query}`)
      this.log(`│  ├──╯`)

      // Use the execa instance from the run method
      this.log(`│  ├──╮ Executing GitHub API search`)

      // Execute GitHub search API call
      const args = ['api', '-X', 'GET', 'search/repositories', '-f', `q=${query}`, '--jq', '.items']

      // Add per_page parameter only if limit is specified
      if (limit) {
        args.splice(6, 0, '-f', `per_page=${limit}`)
        this.log(`│  │  │ Limit: ${limit}`)
      }

      const {stdout} = await execa('gh', args)

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

  public async run(): Promise<Record<string, unknown>[] | z.infer<typeof this.repositoriesSchema>> {
    const {flags} = await this.parse(RepoList)

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

    this.log(`╭─── 🔍 Listing GitHub repositories...`)
    this.log(`│`)
    this.log(`├──╮ 🔍 Prerequisites`)

    // Validate that GitHub CLI is installed
    try {
      this.log(`│  ├──╮ Check gh CLI`)
      await execa('gh', ['--version'])
    } catch {
      this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {
        exit: 1,
      })
    }

    // Validate GitHub CLI authentication
    try {
      this.log(`│  ├──╮ Check gh auth status`)
      await execa('gh', ['auth', 'status'])
    } catch {
      this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {exit: 1})
    }

    this.log(`├──╯ ✅ Prerequisites complete`)
    this.log(`│`)

    if (!flags.user) {
      this.error('GitHub username/organization is required. Use --user flag.', {exit: 1})
    }

    try {
      const repositories = await this.fetchRepositories(
        flags.user,
        flags.topic ? (Array.isArray(flags.topic) ? flags.topic : [flags.topic]) : [],
        flags.language ? (Array.isArray(flags.language) ? flags.language : [flags.language]) : [],
        flags.limit,
        execa,
      )

      if (repositories.length === 0) {
        this.log(`├──╯ ℹ️ No repositories found matching the criteria.`)
        this.log(`│`)
        return []
      }

      // Display human-readable output if not in JSON mode
      this.log(`│  ├──╮ 📋 Results: ${repositories.length} repositories`)

      for (const repo of repositories) {
        const language = repo.language || 'No language'
        const topics = repo.topics && repo.topics.length > 0 ? `Topics: [${repo.topics.join(', ')}]` : 'No topics'

        this.log(`│  │  │ ${repo.owner.login}/${repo.name} (${language}) ${topics}`)
      }
      this.log(`│  ├──╯ ✅`)
      this.log(`├──╯ 🔍`)

      // Return the repositories which will be output as JSON when --json flag is used
      this.log(`│`)
      this.log(`╰─── ✅ Repository listing complete`)
      return repositories
    } catch (error) {
      this.error(`Error: ${(error as Error).message}`, {exit: 1})
      return [] // TypeScript needs this even though we'll never reach here
    }
  }
}
