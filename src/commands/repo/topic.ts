import {Command, Flags} from '@oclif/core';
import {execa as execa_} from 'execa';
import {topicSingleRepository} from '../../utils/topic-single-repo.js';
import {repositorySchema} from '../../types/repository.js';
import type {Repository} from '../../types/repository.js';

export default class RepoTopic extends Command {
	static override args = {};

	static override description = 'Add a github topic to a single GitHub repository';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> --owner motlin --name JUnit-Java-8-Runner --topic maven',
		'<%= config.bin %> <%= command.id %> --owner motlin --name JUnit-Java-8-Runner --topic maven --dryRun',
		'echo \'{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}\' | <%= config.bin %> <%= command.id %> --topic maven',
		"<%= config.bin %> repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | <%= config.bin %> <%= command.id %> --topic maven",
	];

	static override flags = {
		owner: Flags.string({
			char: 'o',
			description: 'GitHub username or organization (required when not using stdin)',
			required: false,
		}),
		name: Flags.string({
			char: 'n',
			description: 'Repository name (required when not using stdin)',
			required: false,
		}),
		topic: Flags.string({
			char: 't',
			description: 'Github topic to add to the repository',
			required: true,
		}),
		dryRun: Flags.boolean({
			char: 'd',
			description: 'Show what would be done without making changes',
			default: false,
		}),
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during topic addition',
			default: false,
		}),
	};

	public async run(): Promise<{
		owner: string;
		name: string;
		topics: string[];
		topicAdded: boolean;
	}> {
		const {flags} = await this.parse(RepoTopic);
		const {verbose} = flags;

		let repository: Repository;

		// Determine input source: stdin or flags
		const useStdin = !process.stdin.isTTY && (!flags.owner || !flags.name);

		if (useStdin) {
			if (verbose) {
				this.log(`Reading repository information from stdin...`);
			}

			let fullInput = '';
			for await (const chunk of process.stdin) {
				fullInput += chunk;
			}

			if (!fullInput.trim()) {
				this.error('No input provided', {
					exit: 1,
					code: 'NO_INPUT',
					suggestions: [
						'Provide both --owner and --name flags',
						'Or pipe repository JSON to stdin',
						`Example: ${this.config.bin} ${this.id} --owner motlin --name JUnit-Java-8-Runner --topic maven`,
					],
				});
			}

			try {
				const jsonData = JSON.parse(fullInput);
				repository = repositorySchema.parse(jsonData);
			} catch {
				this.error('Invalid JSON input from stdin', {
					exit: 1,
					code: 'INVALID_JSON',
					suggestions: [
						'Ensure the input is valid JSON',
						'The input should contain "name" and "owner.login" fields',
						'Example: {"name": "repo", "owner": {"login": "user"}}',
					],
				});
			}
		} else {
			// Use flags
			if (!flags.owner || !flags.name) {
				this.error('Both --owner and --name flags are required when not reading from stdin', {
					exit: 1,
					code: 'MISSING_FLAGS',
					suggestions: [
						'Provide both --owner and --name flags',
						'Or pipe repository JSON to stdin',
						`Example: ${this.config.bin} ${this.id} --owner motlin --name JUnit-Java-8-Runner --topic maven`,
					],
				});
			}

			repository = {
				name: flags.name,
				owner: {
					login: flags.owner,
					type: 'User', // Default type, not critical for topic operations
				},
				language: null,
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			};
		}

		if (verbose) {
			this.log(`╭─── Adding github topic to repository: ${repository.owner.login}/${repository.name}`);
			this.log(`│`);
		}

		const logger = {
			log: (message: string) => this.log(message),
			warn: (message: string) => this.warn(message),
			error: (message: string, options?: {exit?: boolean}) => {
				if (options?.exit === false) {
					this.warn(message);
				} else {
					this.error(message);
				}
			},
		};

		const result = await topicSingleRepository({
			owner: repository.owner.login,
			name: repository.name,
			topic: flags.topic,
			dryRun: flags.dryRun,
			verbose,
			execa: execa_,
			logger,
		});

		if (result.success) {
			if (result.alreadyAdded) {
				if (verbose) {
					this.log(`├──╯ Github topic '${flags.topic}' already exists`);
				} else {
					this.log(`${repository.owner.login}/${repository.name}: topic '${flags.topic}' already exists`);
				}
			} else if (flags.dryRun) {
				if (verbose) {
					this.log(`├──╯ [DRY RUN] Would add github topic '${flags.topic}'`);
				} else {
					this.log(`${repository.owner.login}/${repository.name}: would add topic '${flags.topic}'`);
				}
			} else if (verbose) {
				this.log(`├──╯ Successfully added github topic '${flags.topic}'`);
			} else {
				this.log(`${repository.owner.login}/${repository.name}: added topic '${flags.topic}'`);
			}
		} else if (verbose) {
			this.log(`├──╯ Failed to add github topic to repository: ${result.error || 'Unknown error'}`);
		} else {
			this.log(`${repository.owner.login}/${repository.name}: failed (${result.error || 'Unknown error'})`);
		}

		if (verbose) {
			this.log(`│`);
			this.log(`╰─── Github topic operation complete`);
		}

		const response = {
			owner: repository.owner.login,
			name: repository.name,
			topics: result.topics || [],
			topicAdded: result.success && !result.alreadyAdded && !flags.dryRun,
		};

		if (!result.success) {
			this.exit(1);
		}

		return response;
	}
}
