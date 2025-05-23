import {Command, Flags} from '@oclif/core'
import {execa as execa_} from 'execa'
import {z} from 'zod'
import chalk from 'chalk'

export default class RepoList extends Command {
  static override description = 'List GitHub repositories based on filters'

  static override examples = [
    '<%= config.bin %> <%= command.id %> --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --user liftwizard --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --language Java --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --topic maven --language Java --json',
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100 --json',
    '<%= config.bin %> <%= command.id %> --include-forks --include-archived',
  ]

  static override enableJsonFlag = true

  static override flags = {
    user: Flags.string({char: 'u', description: 'GitHub username/org to filter by', multiple: true}),
    topic: Flags.string({char: 't', description: 'Topic filter', multiple: true}),
    language: Flags.string({char: 'g', description: 'Language filter', multiple: true}),
    'include-forks': Flags.boolean({description: 'Include forked repositories', default: false}),
    'include-archived': Flags.boolean({description: 'Include archived repositories', default: false}),
    visibility: Flags.string({
      description: 'Repository visibility filter',
      options: ['public', 'private', 'all'],
      default: 'public',
    }),
    limit: Flags.integer({char: 'l', description: 'Max repositories'}),
  }

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
    private: z.boolean(),
    visibility: z.string(),
  })

  private repositoriesSchema = z.array(this.repoSchema)

  private async fetchRepositories(
    usernames: string[] = [],
    topics: string[] = [],
    languages: string[] = [],
    limit: number | undefined,
    includeForks: boolean,
    includeArchived: boolean,
    visibility: string,
    execa: typeof execa_,
  ): Promise<z.infer<typeof this.repositoriesSchema>> {
    this.log(
      `├──╮ 🔍 Fetching GitHub repositories${usernames.length > 0 ? ` for users: ${chalk.yellow(usernames.join(', '))}` : ''}`,
    )

    try {
      this.log(`│  ├──╮ Building search query`)
      const topicQueries = topics.map((topic) => `topic:${topic}`).join(' ')
      const languageQueries = languages.map((language) => `language:${language}`).join(' ')
      let query = ''

      if (usernames.length > 0) {
        const userQueries = usernames.map((username) => `user:${username}`).join(' ')
        query += `${userQueries} `
      }

      if (visibility !== 'all') {
        query += `is:${visibility} `
      }

      query += `${topicQueries} ${languageQueries}`

      if (!includeForks) {
        query += ' fork:false'
      }

      if (!includeArchived) {
        query += ' archived:false'
      }

      this.log(`│  │  │ Query: ${chalk.yellow(query)}`)
      this.log(`│  ├──╯`)

      this.log(`│  ├──╮ Executing GitHub API search`)

      const args = ['api', '-X', 'GET', 'search/repositories', '-f', `q=${query}`, '--jq', '.items']

      if (limit) {
        args.splice(6, 0, '-f', `per_page=${limit}`)
        this.log(`│  │  │ Limit: ${chalk.yellow(limit)}`)
      }

      const {stdout} = await execa('gh', args)

      const repositories = JSON.parse(stdout)
      return this.repositoriesSchema.parse(repositories)
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error('Invalid repository data format received from GitHub API', {
          exit: 1,
          code: 'INVALID_DATA_FORMAT',
          suggestions: ['GitHub API response format may have changed', 'Try updating the CLI to the latest version'],
        })
      }

      let errorMessage = 'Unknown error'
      let errorCode: string | undefined

      if (error instanceof Error) {
        errorMessage = error.message
        errorCode = 'code' in error ? (error.code as string) : undefined
      }

      this.error(`Failed to fetch repositories: ${errorMessage}`, {
        exit: 1,
        code: errorCode,
        suggestions: [errorMessage, 'Check your GitHub authentication with: gh auth status'],
      })
      throw error
    }
  }

  public async run(): Promise<z.infer<typeof this.repositoriesSchema>> {
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

    try {
      this.log(`│  ├──╮ Check gh CLI`)
      await execa('gh', ['--version'])
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

    try {
      const repositories = await this.fetchRepositories(
        flags.user ? (Array.isArray(flags.user) ? flags.user : [flags.user]) : [],
        flags.topic ? (Array.isArray(flags.topic) ? flags.topic : [flags.topic]) : [],
        flags.language ? (Array.isArray(flags.language) ? flags.language : [flags.language]) : [],
        flags.limit,
        flags['include-forks'],
        flags['include-archived'],
        flags.visibility,
        execa,
      )

      if (repositories.length === 0) {
        this.log(`├──╯ ℹ️ No repositories found matching the criteria.`)
        this.log(`│`)
        return []
      }

      this.log(`│  ├──╮ 📋 Results: ${chalk.yellow(repositories.length)} repositories`)

      for (const repo of repositories) {
        const language = repo.language || 'No language'
        const topics = repo.topics && repo.topics.length > 0 ? `Topics: [${repo.topics.join(', ')}]` : 'No topics'

        const visibilityTag =
          repo.visibility === 'public' ? chalk.green(`[${repo.visibility}]`) : chalk.red(`[${repo.visibility}]`)

        this.log(
          `│  │  │ ${chalk.yellow(repo.owner.login)}/${chalk.yellow(repo.name)} ${visibilityTag} (${chalk.yellow(language)}) ${topics}`,
        )
      }
      this.log(`│  ├──╯ ✅`)
      this.log(`├──╯ 🔍`)

      this.log(`│`)
      this.log(`╰─── ✅ Repository listing complete`)
      return repositories
    } catch (error) {
      let errorMessage = 'Unknown error'
      let errorCode: string | undefined

      if (error instanceof Error) {
        errorMessage = error.message
        errorCode = 'code' in error ? (error.code as string) : undefined
      }

      this.error(`Error: ${errorMessage}`, {
        exit: 1,
        code: errorCode,
        suggestions: [errorMessage],
      })
      return []
    }
  }
}
