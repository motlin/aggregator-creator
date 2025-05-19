import {Command, Flags} from '@oclif/core'
import {execa as execa_} from 'execa'
import {z} from 'zod'
import chalk from 'chalk'

export default class RepoList extends Command {
  static override description = 'List GitHub repositories based on filters'

  static override examples = [
    '<%= config.bin %> <%= command.id %> --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --language Java --limit 100',
    '<%= config.bin %> <%= command.id %> --user motlin --topic maven --language Java --json',
    '<%= config.bin %> <%= command.id %> --user motlin --limit 100 --json',
    '<%= config.bin %> <%= command.id %> --include-forks --include-archived',
  ]

  static override enableJsonFlag = true

  static override flags = {
    user: Flags.string({char: 'u', description: 'GitHub username/org to filter by'}),
    topic: Flags.string({char: 't', description: 'Topic filter', multiple: true}),
    language: Flags.string({char: 'g', description: 'Language filter', multiple: true}),
    'include-forks': Flags.boolean({description: 'Include forked repositories', default: false}),
    'include-archived': Flags.boolean({description: 'Include archived repositories', default: false}),
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
  })

  private repositoriesSchema = z.array(this.repoSchema)

  private async fetchRepositories(
    username: string | undefined,
    topics: string[] = [],
    languages: string[] = [],
    limit: number | undefined,
    includeForks: boolean,
    includeArchived: boolean,
    execa: typeof execa_,
  ): Promise<z.infer<typeof this.repositoriesSchema>> {
    this.log(`├──╮ 🔍 Fetching GitHub repositories${username ? ` for user: ${chalk.yellow(username)}` : ''}`)

    try {
      this.log(`│  ├──╮ Building search query`)
      const topicQueries = topics.map((topic) => `topic:${topic}`).join(' ')
      const languageQueries = languages.map((language) => `language:${language}`).join(' ')
      let query = ''

      if (username) {
        query += `user:${username} `
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
        this.error('Invalid repository data format received from GitHub API', {exit: 1})
      }

      this.error(`Failed to fetch repositories: ${(error as Error).message}`, {exit: 1})
      throw error
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

    try {
      this.log(`│  ├──╮ Check gh CLI`)
      await execa('gh', ['--version'])
    } catch {
      this.error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/', {
        exit: 1,
      })
    }

    try {
      this.log(`│  ├──╮ Check gh auth status`)
      await execa('gh', ['auth', 'status'])
    } catch {
      this.error('Not authenticated with GitHub. Please run `gh auth login` first.', {exit: 1})
    }

    this.log(`├──╯ ✅ Prerequisites complete`)
    this.log(`│`)

    try {
      const repositories = await this.fetchRepositories(
        flags.user,
        flags.topic ? (Array.isArray(flags.topic) ? flags.topic : [flags.topic]) : [],
        flags.language ? (Array.isArray(flags.language) ? flags.language : [flags.language]) : [],
        flags.limit,
        flags['include-forks'],
        flags['include-archived'],
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

        this.log(
          `│  │  │ ${chalk.yellow(repo.owner.login)}/${chalk.yellow(repo.name)} (${chalk.yellow(language)}) ${topics}`,
        )
      }
      this.log(`│  ├──╯ ✅`)
      this.log(`├──╯ 🔍`)

      this.log(`│`)
      this.log(`╰─── ✅ Repository listing complete`)
      return repositories
    } catch (error) {
      this.error(`Error: ${(error as Error).message}`, {exit: 1})
      return []
    }
  }
}
