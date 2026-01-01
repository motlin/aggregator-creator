import {Args, Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import {repositorySchema} from '../../types/repository.js';
import {cloneSingleRepo} from '../../utils/clone-single-repo.js';
import {type MavenValidationResult, validateMavenRepo} from '../../utils/maven-validation.js';
import {type TopicSingleRepoResult, topicSingleRepository} from '../../utils/topic-single-repo.js';

export default class RepoProcess extends Command {
	static override args = {
		'output-directory': Args.string({
			description: 'Directory where the repository will be cloned',
			required: true,
		}),
	};

	static override description = 'Process a single repository: clone, validate, and add github topic if valid';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./repos --owner motlin --name JUnit-Java-8-Runner --topic maven',
		'<%= config.bin %> <%= command.id %> ./repos --owner motlin --name example-repo --topic maven --dryRun --json',
		'echo \'{"name": "repo", "owner": {"login": "user"}}\' | <%= config.bin %> <%= command.id %> ./repos --topic maven --json',
		`<%= config.bin %> repo:list --owner motlin --json | jq -c '.[]' | while read repo; do
  echo "$repo" | <%= config.bin %> <%= command.id %> ./repos --topic maven --json
done`,
	];

	static override flags = {
		owner: Flags.string({
			char: 'o',
			description: 'GitHub username or organization',
			required: false,
		}),
		name: Flags.string({
			char: 'n',
			description: 'Repository name',
			required: false,
		}),
		topic: Flags.string({
			char: 't',
			description: 'GitHub topic to add to validated Maven repositories',
			required: true,
		}),
		dryRun: Flags.boolean({
			char: 'd',
			description: 'Show what would be done without making actual changes',
			default: false,
		}),
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during operation',
			default: false,
		}),
	};

	public async run(): Promise<{
		name: string;
		owner: {login: string; type?: string};
		language?: string | null;
		topics?: string[];
		fork?: boolean;
		archived?: boolean;
		disabled?: boolean;
		is_template?: boolean;
		private?: boolean;
		visibility?: string;
		path: string;
		cloned: boolean;
		valid: boolean;
		topicAdded: boolean;
		error: string | null;
	}> {
		const {args, flags} = await this.parse(RepoProcess);
		const outputDir = args['output-directory'];
		const {topic, dryRun, verbose} = flags;

		// Get repository info from flags or stdin
		const repoInfo = await this.getRepoInfo(flags);
		const repoName = `${repoInfo.owner.login}/${repoInfo.name}`;

		try {
			if (verbose) {
				this.log(
					`╭─── Processing repository ${chalk.yellow(repoInfo.owner.login)}/${chalk.yellow(repoInfo.name)}...`,
				);
				this.log(`│`);
				this.log(`├──╮ Cloning repository...`);
			}

			const cloneResult = await cloneSingleRepo(
				repoInfo.owner.login,
				repoInfo.name,
				outputDir,
				execa_,
				verbose ? this : undefined,
			);

			if (!cloneResult.cloned && !cloneResult.skipped) {
				if (verbose) {
					this.log(`├──╯ Failed to clone repository`);
					this.log(`├──╯`);
					this.log(`│`);
					this.log(`╰─── Processing failed`);
				} else {
					this.log(`${repoName}: clone failed`);
				}

				const result = {
					...repoInfo,
					path: cloneResult.path,
					cloned: false,
					valid: false,
					topicAdded: false,
					error: cloneResult.error,
				};

				return result;
			}

			if (verbose) {
				if (cloneResult.cloned) {
					this.log(`├──╯ Repository cloned to ${chalk.cyan(cloneResult.path)}`);
				} else if (cloneResult.skipped) {
					this.log(`├──╯ Repository already exists at ${chalk.cyan(cloneResult.path)}`);
				}

				this.log(`│`);
				this.log(`├──╮ Validating repository...`);
			}

			const validateResult: MavenValidationResult = await validateMavenRepo(
				cloneResult.path,
				execa_,
				verbose ? this : undefined,
			);

			if (!validateResult.valid) {
				if (verbose) {
					this.log(`├──╯ Repository is not a valid Maven project`);
					this.log(`├──╯`);
					this.log(`│`);
					this.log(`╰─── Processing complete (repository not valid)`);
				} else {
					this.log(`${repoName}: not a valid Maven project`);
				}

				const result = {
					...repoInfo,
					path: cloneResult.path,
					cloned: true,
					valid: false,
					topicAdded: false,
					error: 'Not a valid Maven repository',
				};

				return result;
			}

			if (verbose) {
				this.log(`├──╯ Repository is a valid Maven project`);
				this.log(`│`);
				this.log(`├──╮ Adding github topic to repository: ${chalk.cyan(topic)}...`);
			}

			const topicSingleResult: TopicSingleRepoResult = await topicSingleRepository({
				owner: repoInfo.owner.login,
				name: repoInfo.name,
				topic,
				dryRun,
				verbose,
				execa: execa_,
				logger: {
					log: this.log.bind(this),
					warn: this.warn.bind(this),
					error: (message: string, options?: {exit?: boolean}) => {
						if (options?.exit) {
							this.error(message);
						} else {
							this.error(message, {exit: false});
						}
					},
				},
			});

			if (!topicSingleResult.success) {
				if (verbose) {
					this.log(
						`├──╯ Failed to add github topic to repository: ${topicSingleResult.error || 'Unknown error'}`,
					);
					this.log(`├──╯`);
					this.log(`│`);
					this.log(`╰─── Processing failed`);
				} else {
					this.log(`${repoName}: topic add failed (${topicSingleResult.error || 'Unknown error'})`);
				}

				const result = {
					...repoInfo,
					path: cloneResult.path,
					cloned: true,
					valid: true,
					topicAdded: false,
					error: `Failed to add github topic to repository: ${topicSingleResult.error || 'Unknown error'}`,
				};

				return result;
			}

			const topicResult = {
				owner: topicSingleResult.owner,
				name: topicSingleResult.name,
				topics: topicSingleResult.topics || [],
				topicAdded: topicSingleResult.success && !topicSingleResult.alreadyAdded,
			};

			if (verbose) {
				if (topicResult.topicAdded) {
					this.log(`├──╯ Repository github topic added: ${chalk.cyan(topic)}`);
				} else if (dryRun) {
					this.log(`├──╯ [DRY RUN] Would add github topic to repository: ${chalk.cyan(topic)}`);
				} else {
					this.log(`├──╯ Repository already has github topic: ${chalk.cyan(topic)}`);
				}

				this.log(`├──╯`);
				this.log(`│`);
				this.log(`╰─── Processing complete`);
			} else if (topicResult.topicAdded) {
				this.log(`${repoName}: processed, topic added`);
			} else if (dryRun) {
				this.log(`${repoName}: processed, would add topic`);
			} else {
				this.log(`${repoName}: processed, topic exists`);
			}

			const result = {
				...repoInfo,
				path: cloneResult.path,
				cloned: cloneResult.cloned || cloneResult.skipped,
				valid: true,
				topicAdded: topicResult.topicAdded,
				topics: topicResult.topics,
				error: null,
			};

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.error(`Failed to process repository: ${errorMessage}`, {exit: 1});
		}
	}

	private async getRepoInfo(flags: {owner?: string; name?: string}): Promise<{
		name: string;
		owner: {login: string; type?: string};
		language?: string | null;
		topics?: string[];
		fork?: boolean;
		archived?: boolean;
		disabled?: boolean;
		is_template?: boolean;
		private?: boolean;
		visibility?: string;
	}> {
		// If owner and name are provided via flags, use them
		if (flags.owner && flags.name) {
			return {
				name: flags.name,
				owner: {login: flags.owner},
			};
		}

		// If either flag is missing but we have stdin input, try to read from stdin
		if (!process.stdin.isTTY) {
			let fullInput = '';
			for await (const chunk of process.stdin) {
				fullInput += chunk;
			}

			if (fullInput.trim()) {
				try {
					const jsonData = JSON.parse(fullInput);
					const validatedRepo = repositorySchema.parse(jsonData);
					return validatedRepo;
				} catch {
					this.error('Invalid JSON input from stdin', {
						exit: 1,
						code: 'INVALID_JSON',
						suggestions: [
							'Ensure the input is valid JSON',
							'The input should contain "name" and "owner.login" fields',
							'Example: echo \'{"name": "repo", "owner": {"login": "user"}}\' | aggregator repo:process ./output --topic maven',
						],
					});
				}
			}
		}

		// No input provided
		this.error('No input provided. Provide --owner and --name flags or pipe JSON data from stdin.', {
			exit: 1,
			code: 'NO_INPUT',
			suggestions: [
				'Provide --owner and --name flags',
				'Or pipe repository JSON from stdin',
				'Example: aggregator repo:process ./output --owner motlin --name JUnit-Java-8-Runner --topic maven',
			],
		});
	}
}
