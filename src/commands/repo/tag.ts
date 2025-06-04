import {Command, Flags} from '@oclif/core';
import {execa as execa_} from 'execa';
import {tagSingleRepository} from '../../utils/tag-single-repo.js';
import {repositorySchema} from '../../types/repository.js';
import type {Repository} from '../../types/repository.js';

export default class RepoTag extends Command {
	static override args = {};

	static override description = 'Tag a single GitHub repository with a topic';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> --owner motlin --name JUnit-Java-8-Runner --topic maven',
		'<%= config.bin %> <%= command.id %> --owner motlin --name JUnit-Java-8-Runner --topic maven --dryRun',
		'echo \'{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}\' | <%= config.bin %> <%= command.id %> --topic maven',
		"<%= config.bin %> repo:list --user motlin --limit 1 --json | jq -c '.[0]' | <%= config.bin %> <%= command.id %> --topic maven",
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
			description: 'Topic to add to the repository',
			required: true,
		}),
		dryRun: Flags.boolean({
			char: 'd',
			description: 'Show what would be done without making changes',
			default: false,
		}),
	};

	public async run(): Promise<{
		owner: string;
		name: string;
		topics: string[];
		tagged: boolean;
	}> {
		const {flags} = await this.parse(RepoTag);

		let repository: Repository;

		// Determine input source: stdin or flags
		const useStdin = !process.stdin.isTTY && (!flags.owner || !flags.name);

		if (useStdin) {
			this.log(`🔍 Reading repository information from stdin...`);

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
					type: 'User', // Default type, not critical for tagging
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

		const execa = execa_({
			verbose: (verboseLine: string, {type}: {type: string}) => {
				switch (type) {
					case 'command': {
						this.log(`├──╮ ${verboseLine}`);
						break;
					}
					case 'duration': {
						this.log(`├──╯ ${verboseLine}`);
						break;
					}
					case 'output': {
						const MAX_LENGTH = 120;
						const truncatedLine =
							verboseLine.length > MAX_LENGTH
								? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...`
								: verboseLine;
						this.log(`│  │ ${truncatedLine}`);
						break;
					}
					default: {
						this.debug(`${type} ${verboseLine}`);
					}
				}
			},
		});

		this.log(`╭─── 🏷️  Tagging repository: ${repository.owner.login}/${repository.name}`);
		this.log(`│`);

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

		const result = await tagSingleRepository({
			owner: repository.owner.login,
			name: repository.name,
			topic: flags.topic,
			dryRun: flags.dryRun,
			execa,
			logger,
		});

		if (result.success) {
			if (result.alreadyTagged) {
				this.log(`├──╯ ✅ Topic '${flags.topic}' already exists`);
			} else if (flags.dryRun) {
				this.log(`├──╯ 🔍 [DRY RUN] Would add topic '${flags.topic}'`);
			} else {
				this.log(`├──╯ ✅ Successfully added topic '${flags.topic}'`);
			}
		} else {
			this.log(`├──╯ ❌ Failed to tag repository: ${result.error || 'Unknown error'}`);
		}

		this.log(`│`);
		this.log(`╰─── 🏷️  Tagging complete`);

		const response = {
			owner: repository.owner.login,
			name: repository.name,
			topics: result.topics || [],
			tagged: result.success && !result.alreadyTagged,
		};

		if (!result.success) {
			this.exit(1);
		}

		return response;
	}
}
