import {Command, Flags} from '@oclif/core';
import {execa as execa_} from 'execa';

import chalk from 'chalk';
import {z} from 'zod';
import {repositoriesSchema} from '../../types/repository.js';

export default class RepoList extends Command {
	static override description = 'List GitHub repositories based on filters';

	static override examples = [
		'<%= config.bin %> <%= command.id %> --limit 100',
		'<%= config.bin %> <%= command.id %> --owner motlin --limit 100',
		'<%= config.bin %> <%= command.id %> --owner motlin --owner liftwizard --limit 100',
		'<%= config.bin %> <%= command.id %> --owner motlin --language Java --limit 100',
		'<%= config.bin %> <%= command.id %> --owner motlin --topic maven --language Java --json',
		'<%= config.bin %> <%= command.id %> --owner motlin --topic maven --exclude-topic patched --json',
		'<%= config.bin %> <%= command.id %> --owner motlin --limit 100 --json',
		'<%= config.bin %> <%= command.id %> --include-forks --include-archived',
		'<%= config.bin %> <%= command.id %> --visibility public',
	];

	static override enableJsonFlag = true;

	static override flags = {
		owner: Flags.string({char: 'o', description: 'GitHub username/org to filter by', multiple: true}),
		topic: Flags.string({char: 't', description: 'Topic filter', multiple: true}),
		'exclude-topic': Flags.string({char: 'x', description: 'Exclude repositories with this topic', multiple: true}),
		language: Flags.string({char: 'g', description: 'Language filter', multiple: true}),
		'include-forks': Flags.boolean({description: 'Include forked repositories', default: false}),
		'include-archived': Flags.boolean({description: 'Include archived repositories', default: false}),
		visibility: Flags.string({
			description: 'Repository visibility filter',
			options: ['public', 'private', 'all'],
			default: 'public',
		}),
		limit: Flags.integer({char: 'l', description: 'Max repositories'}),
	};

	private async fetchRepositories(
		usernames: string[] = [],
		topics: string[] = [],
		excludeTopics: string[] = [],
		languages: string[] = [],
		limit: number | undefined,
		includeForks: boolean,
		includeArchived: boolean,
		visibility: string,
		execa: typeof execa_,
	): Promise<z.infer<typeof repositoriesSchema>> {
		this.log(
			`├──╮ 🔍 Fetching GitHub repositories${usernames.length > 0 ? ` for users: ${chalk.yellow(usernames.join(', '))}` : ''}`,
		);

		try {
			this.log(`│  ├──╮ Building search query`);
			const topicQueries = topics.map((topic) => `topic:${topic}`).join(' ');
			const excludeTopicQueries = excludeTopics.map((topic) => `-topic:${topic}`).join(' ');
			const languageQueries = languages.map((language) => `language:${language}`).join(' ');
			let query = '';

			if (usernames.length > 0) {
				const userQueries = usernames.map((username) => `user:${username}`).join(' ');
				query += `${userQueries} `;
			}

			if (visibility !== 'all') {
				query += `is:${visibility} `;
			}

			query += `${topicQueries} ${excludeTopicQueries} ${languageQueries}`;

			if (!includeForks) {
				query += ' fork:false';
			}

			if (!includeArchived) {
				query += ' archived:false';
			}

			this.log(`│  │  │ Query: ${chalk.yellow(query)}`);
			this.log(`│  ├──╯`);

			this.log(`│  ├──╮ Executing GitHub API search`);

			const args = ['api', '-X', 'GET', 'search/repositories', '-f', `q=${query}`, '--jq', '.items'];

			if (limit) {
				args.splice(6, 0, '-f', `per_page=${limit}`);
				this.log(`│  │  │ Limit: ${chalk.yellow(limit)}`);
			}

			// Add sorting to ensure consistent results
			args.splice(6, 0, '-f', 'sort=created', '-f', 'order=asc');

			const {stdout} = await execa('gh', args);

			this.log(`│  ├──╯`);
			this.log(`├──╯`);

			const repositories = JSON.parse(stdout);
			return repositoriesSchema.parse(repositories);
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.error('Invalid repository data format received from GitHub API', {
					exit: 1,
					code: 'INVALID_DATA_FORMAT',
					suggestions: [
						'GitHub API response format may have changed',
						'Try updating the CLI to the latest version',
					],
				});
			}

			let errorMessage = 'Unknown error';
			let errorCode: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorCode = 'code' in error ? (error.code as string) : undefined;
			}

			this.error(`Failed to fetch repositories: ${errorMessage}`, {
				exit: 1,
				code: errorCode,
				suggestions: [errorMessage, 'Check your GitHub authentication with: gh auth status'],
			});
			throw error;
		}
	}

	public async run(): Promise<z.infer<typeof repositoriesSchema>> {
		const {flags} = await this.parse(RepoList);

		const execa = execa_;

		this.log(`╭─── 🔍 Listing GitHub repositories...`);
		this.log(`│`);
		this.log(`├──╮ 🔍 Prerequisites`);

		try {
			this.log(`│  ├──╮ Check gh CLI`);
			await execa('gh', ['--version']);
		} catch {
			this.error(
				'GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/',
				{
					exit: 1,
					code: 'GH_NOT_FOUND',
					suggestions: [
						'Install GitHub CLI from https://cli.github.com/',
						'On macOS: brew install gh',
						'On Linux: See installation instructions at https://cli.github.com/manual/installation',
					],
				},
			);
		}

		this.log(`├──╯ ✅ Prerequisites complete`);
		this.log(`│`);

		try {
			const repositories = await this.fetchRepositories(
				flags.owner ? (Array.isArray(flags.owner) ? flags.owner : [flags.owner]) : [],
				flags.topic ? (Array.isArray(flags.topic) ? flags.topic : [flags.topic]) : [],
				flags['exclude-topic']
					? Array.isArray(flags['exclude-topic'])
						? flags['exclude-topic']
						: [flags['exclude-topic']]
					: [],
				flags.language ? (Array.isArray(flags.language) ? flags.language : [flags.language]) : [],
				flags.limit,
				flags['include-forks'],
				flags['include-archived'],
				flags.visibility,
				execa,
			);

			if (repositories.length === 0) {
				this.log(`├──╯ ℹ️ No repositories found matching the criteria.`);
				this.log(`│`);
				return repositoriesSchema.parse([]);
			}

			this.log(`├──╮ 📋 Results: ${chalk.yellow(repositories.length)} repositories`);

			for (const repo of repositories) {
				const language = repo.language || 'No language';
				const topics =
					repo.topics && repo.topics.length > 0 ? `Topics: [${repo.topics.join(', ')}]` : 'No topics';

				const visibilityTag =
					repo.visibility === 'public'
						? chalk.green(`[${repo.visibility}]`)
						: chalk.red(`[${repo.visibility}]`);

				this.log(
					`│  │ ${chalk.yellow(repo.owner.login)}/${chalk.yellow(repo.name)} ${visibilityTag} (${chalk.yellow(language)}) ${topics}`,
				);
			}
			this.log(`├──╯ ✅`);

			this.log(`│`);
			this.log(`╰─── ✅ Repository listing complete`);
			return repositories;
		} catch (error) {
			let errorMessage = 'Unknown error';
			let errorCode: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorCode = 'code' in error ? (error.code as string) : undefined;
			}

			this.error(`Error: ${errorMessage}`, {
				exit: 1,
				code: errorCode,
				suggestions: [errorMessage],
			});
			return [];
		}
	}
}
