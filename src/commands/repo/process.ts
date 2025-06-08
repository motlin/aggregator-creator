import {Args, Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import {repositorySchema} from '../../types/repository.js';
import {cloneSingleRepo} from '../../utils/clone-single-repo.js';
import {type MavenValidationResult, validateMavenRepo} from '../../utils/maven-validation.js';
import RepoTag from './tag.js';

export default class RepoProcess extends Command {
	static override args = {
		'output-directory': Args.string({
			description: 'Directory where the repository will be cloned',
			required: true,
		}),
	};

	static override description = 'Process a single repository: clone, validate, and tag if valid';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./repos --owner motlin --name JUnit-Java-8-Runner --tag maven',
		'<%= config.bin %> <%= command.id %> ./repos --owner motlin --name example-repo --tag maven --dryRun --json',
		'echo \'{"name": "repo", "owner": {"login": "user"}}\' | <%= config.bin %> <%= command.id %> ./repos --tag maven --json',
		`<%= config.bin %> repo:list --user motlin --json | jq -c '.[]' | while read repo; do
  echo "$repo" | <%= config.bin %> <%= command.id %> ./repos --tag maven --json
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
		tag: Flags.string({
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
		tagged: boolean;
		error: string | null;
	}> {
		const {args, flags} = await this.parse(RepoProcess);
		const outputDir = args['output-directory'];
		const {tag, dryRun} = flags;

		// Get repository info from flags or stdin
		const repoInfo = await this.getRepoInfo(flags);

		try {
			if (!flags.json) {
				this.log(
					`╭─── 🔄 Processing repository ${chalk.yellow(repoInfo.owner.login)}/${chalk.yellow(repoInfo.name)}...`,
				);
				this.log(`│`);
			}

			// 1. Clone repository using cloneSingleRepo utility
			if (!flags.json) {
				this.log(`├──╮ 📥 Cloning repository...`);
			}

			const logger = flags.json ? undefined : this;
			const cloneResult = await cloneSingleRepo(repoInfo.owner.login, repoInfo.name, outputDir, execa_, logger);

			if (!cloneResult.cloned && !cloneResult.skipped) {
				if (!flags.json) {
					this.log(`├──╯ ❌ Failed to clone repository`);
					this.log(`├──╯`);
					this.log(`│`);
					this.log(`╰─── ❌ Processing failed`);
				}

				const result = {
					...repoInfo,
					path: cloneResult.path,
					cloned: false,
					valid: false,
					tagged: false,
					error: cloneResult.error,
				};

				if (flags.json) {
					this.logJson(result);
				}

				this.exit(1);
				return result;
			}

			if (!flags.json) {
				if (cloneResult.cloned) {
					this.log(`├──╯ ✅ Repository cloned to ${chalk.cyan(cloneResult.path)}`);
				} else if (cloneResult.skipped) {
					this.log(`├──╯ ⏩ Repository already exists at ${chalk.cyan(cloneResult.path)}`);
				}
			}

			// 2. Validate repository using validateMavenRepo utility
			if (!flags.json) {
				this.log(`│`);
				this.log(`├──╮ 🔍 Validating repository...`);
			}

			const validateResult: MavenValidationResult = await validateMavenRepo(
				cloneResult.path,
				execa_,
				flags.json ? undefined : this,
			);

			if (!validateResult.valid) {
				if (!flags.json) {
					this.log(`├──╯ ❌ Repository is not a valid Maven project`);
					this.log(`├──╯`);
					this.log(`│`);
					this.log(`╰─── ❌ Processing complete (repository not valid)`);
				}

				const result = {
					...repoInfo,
					path: cloneResult.path,
					cloned: true,
					valid: false,
					tagged: false,
					error: 'Not a valid Maven repository',
				};

				if (flags.json) {
					this.logJson(result);
				}

				this.exit(1);
				return result;
			}

			if (!flags.json) {
				this.log(`├──╯ ✅ Repository is a valid Maven project`);
			}

			// 3. Tag repository using RepoTag command (only if valid)
			if (!flags.json) {
				this.log(`│`);
				this.log(`├──╮ 🏷️ Tagging repository with topic: ${chalk.cyan(tag)}...`);
			}

			const tagArgs = [
				'--owner',
				repoInfo.owner.login,
				'--name',
				repoInfo.name,
				'--topic',
				tag,
				...(dryRun ? ['--dryRun'] : []),
				'--json',
			];

			const tagCommand = new RepoTag(tagArgs, this.config);

			let tagResult;
			if (flags.json) {
				try {
					const originalExit = tagCommand.exit;
					tagCommand.exit = (code?: number) => {
						throw new Error(`Command exited with code ${code || 0}`);
					};

					tagResult = await tagCommand.run();
					tagCommand.exit = originalExit;
				} catch (error) {
					if (error instanceof Error && error.message.includes('Command exited with code 1')) {
						tagResult = {
							owner: repoInfo.owner.login,
							name: repoInfo.name,
							topics: repoInfo.topics || [],
							tagged: false,
						};
					} else {
						throw error;
					}
				}
			} else {
				// Suppress the command's own logging
				const originalTagLog = tagCommand.log;
				const originalTagWarn = tagCommand.warn;
				const originalTagError = tagCommand.error;
				const originalTagExit = tagCommand.exit;

				tagCommand.log = () => {}; // Suppress all log output
				tagCommand.warn = (input: string | Error) => input; // Suppress all warnings
				tagCommand.error = (message: string | Error) => {
					throw new Error(typeof message === 'string' ? message : message.message);
				};
				tagCommand.exit = (code?: number) => {
					throw new Error(`Command exited with code ${code || 0}`);
				};

				try {
					tagResult = await tagCommand.run();
				} catch (error) {
					// Handle the case where the command exits with code 1
					if (error instanceof Error && error.message.includes('Command exited with code 1')) {
						tagResult = {
							owner: repoInfo.owner.login,
							name: repoInfo.name,
							topics: repoInfo.topics || [],
							tagged: false,
						};
					} else {
						throw error;
					}
				} finally {
					// Restore original methods
					tagCommand.log = originalTagLog;
					tagCommand.warn = originalTagWarn;
					tagCommand.error = originalTagError;
					tagCommand.exit = originalTagExit;
				}
			}

			if (!flags.json) {
				if (tagResult.tagged) {
					this.log(`├──╯ ✅ Repository tagged with topic: ${chalk.cyan(tag)}`);
				} else if (dryRun) {
					this.log(`├──╯ 🔵 [DRY RUN] Would tag repository with topic: ${chalk.cyan(tag)}`);
				} else {
					this.log(`├──╯ ℹ️ Repository already has topic: ${chalk.cyan(tag)}`);
				}

				this.log(`├──╯`);
				this.log(`│`);
				this.log(`╰─── ✅ Processing complete`);
			}

			// 4. Output combined result
			const result = {
				...repoInfo,
				path: cloneResult.path,
				cloned: cloneResult.cloned || cloneResult.skipped,
				valid: true,
				tagged: tagResult.tagged,
				topics: tagResult.topics,
				error: null,
			};

			if (flags.json) {
				this.logJson(result);
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			if (!flags.json) {
				this.error(`Failed to process repository: ${errorMessage}`, {exit: 1});
			}

			// Return error result in JSON mode
			const result = {
				name: flags.name || 'unknown',
				owner: {login: flags.owner || 'unknown'},
				language: null,
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'unknown',
				path: '',
				cloned: false,
				valid: false,
				tagged: false,
				error: errorMessage,
			};

			if (flags.json) {
				this.logJson(result);
			}

			this.exit(1);
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
							'Example: echo \'{"name": "repo", "owner": {"login": "user"}}\' | aggregator repo:process ./output --tag maven',
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
				'Example: aggregator repo:process ./output --owner motlin --name JUnit-Java-8-Runner --tag maven',
			],
		});
	}
}
