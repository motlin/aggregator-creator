import {Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import {cloneSingleRepo} from '../../utils/clone-single-repo.js';
import {repositorySchema} from '../../types/repository.js';
import type {Repository} from '../../types/repository.js';

export default class RepoClone extends Command {
	static override args = {};

	static override description = 'Clone a single GitHub repository';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner',
		'echo \'{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}\' | <%= config.bin %> <%= command.id %> --output-directory ./repos',
		"<%= config.bin %> repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | <%= config.bin %> <%= command.id %> --output-directory ./repos",
		'<%= config.bin %> <%= command.id %> --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner --verbose',
	];

	static override flags = {
		'output-directory': Flags.string({
			description: 'Directory where the repository will be cloned',
			required: true,
		}),
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
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during cloning',
			default: false,
		}),
	};

	public async run(): Promise<{
		owner: string;
		name: string;
		path: string;
		cloned: boolean;
		alreadyExists?: boolean;
		error?: string;
	}> {
		const {flags} = await this.parse(RepoClone);
		const outputDirectory = flags['output-directory'];
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
						`Example: ${this.config.bin} ${this.id} --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner`,
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
						`Example: ${this.config.bin} ${this.id} --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner`,
					],
				});
			}

			repository = {
				name: flags.name,
				owner: {
					login: flags.owner,
					type: 'User', // Default type, not critical for cloning
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

		try {
			const result = await cloneSingleRepo(
				repository.owner.login,
				repository.name,
				outputDirectory,
				execa_,
				verbose ? this : undefined,
			);

			const response = {
				owner: repository.owner.login,
				name: repository.name,
				path: result.path,
				cloned: result.cloned,
				...(result.skipped && {alreadyExists: result.skipped}),
				...(result.error && {error: result.error}),
			};

			if (result.cloned) {
				if (verbose) {
					this.log(
						`Successfully cloned ${chalk.yellow(repository.owner.login)}/${chalk.yellow(repository.name)} to ${chalk.cyan(result.path)}`,
					);
				} else {
					this.log(`${repository.owner.login}/${repository.name}: cloned`);
				}
			} else if (result.skipped) {
				if (verbose) {
					this.log(
						`Repository ${chalk.yellow(repository.owner.login)}/${chalk.yellow(repository.name)} already exists at ${chalk.cyan(result.path)}`,
					);
				} else {
					this.log(`${repository.owner.login}/${repository.name}: already exists`);
				}
			} else if (result.error) {
				this.error(`Failed to clone repository: ${result.error}`, {exit: 1});
			}

			return response;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.error(`Failed to clone repository: ${errorMessage}`, {exit: 1});
		}
	}
}
