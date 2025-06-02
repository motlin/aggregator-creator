import {Args, Command} from '@oclif/core';
import * as fs from 'fs-extra';
import {execa as execa_} from 'execa';
import {z} from 'zod';
import chalk from 'chalk';
import {repositoriesSchema, repositorySchema} from '../../types/repository.js';
import {cloneSingleRepo} from '../../utils/clone-single-repo.js';

export default class RepoCloneMany extends Command {
	static override description = 'Clone multiple GitHub repositories listed from stdin';

	static override examples = [
		'echo "owner/repo" | <%= config.bin %> <%= command.id %> ./target-dir',
		'cat repos.txt | <%= config.bin %> <%= command.id %> ./target-dir',
		'<%= config.bin %> repo:list --user someuser --limit 100 --json | <%= config.bin %> <%= command.id %> ./target-dir',
	];

	static override args = {
		targetDirectory: Args.string({description: 'Directory to clone repositories into', required: true}),
	};

	private repoNameSchema = z.string().regex(/^[^/]+\/[^/]+$/, 'Repository must be in format "owner/repo"');

	public async run(): Promise<void> {
		const {args} = await this.parse(RepoCloneMany);
		const {targetDirectory} = args;

		const execa = execa_;

		if (process.stdin.isTTY) {
			this.error('No input provided. This command expects repository data from stdin.', {
				exit: 1,
				code: 'NO_INPUT',
				suggestions: [
					'Pipe repository data into this command',
					'Example: echo "owner/repo" | aggregator repo:clone-many ./target-dir',
					'Example: aggregator repo:list --user someuser --json | aggregator repo:clone-many ./target-dir',
				],
			});
		} else {
			this.log(`╭─── 📦 Cloning repositories...`);
			this.log(`│`);
			this.log(`├──╮ 🔍 Prerequisites`);

			try {
				this.log(`│  ├──╮ Check gh CLI`);
				await execa('gh', ['--version']);
				this.log(`│  │`);
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

			await fs.ensureDir(targetDirectory);
			let fullInput = '';
			for await (const chunk of process.stdin) {
				fullInput += chunk;
			}

			try {
				const jsonData = JSON.parse(fullInput);
				if (Array.isArray(jsonData)) {
					const validRepos = repositoriesSchema.parse(jsonData);
					const total = validRepos.length;

					this.log(`├──╮ 🚀 Cloning ${chalk.yellow(total)} repositories`);

					for (const [i, repo] of validRepos.entries()) {
						await this.cloneRepository(repo.owner.login, repo.name, targetDirectory, i + 1, total, execa);
					}

					this.log(`├──╯ Cloning complete`);
					this.log(`│`);
					this.log(`╰─── ✅ All done`);
				} else {
					const validRepo = repositorySchema.parse(jsonData);
					const total = 1;
					this.log(`├──╮ 🚀 Cloning ${chalk.yellow(1)} repository`);

					await this.cloneRepository(validRepo.owner.login, validRepo.name, targetDirectory, 1, total, execa);

					this.log(`├──╯ Cloning complete`);
					this.log(`│`);
					this.log(`╰─── ✅ All done`);
				}
			} catch (error) {
				if (error instanceof z.ZodError) {
					// Fall through to handle as plain text input
				} else if (error instanceof SyntaxError) {
					// Fall through to handle as plain text input
				} else {
					throw error;
				}
				const lines = fullInput.split('\n');
				const validLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);

				const total = validLines.length;

				this.log(`├──╮ 🚀 Cloning ${chalk.yellow(total)} ${total === 1 ? 'repository' : 'repositories'}`);

				for (const [i, trimmedLine] of validLines.entries()) {
					try {
						this.repoNameSchema.parse(trimmedLine);
					} catch (error: unknown) {
						if (error instanceof z.ZodError) {
							this.error(`Invalid repository format: ${trimmedLine} - must be in format "owner/repo"`, {
								exit: 1,
								code: 'INVALID_REPO_FORMAT',
								suggestions: [
									'Repository must be in format "owner/repo"',
									'Example: facebook/react',
									'Example: microsoft/typescript',
								],
							});
						}
						throw error;
					}

					const [owner, name] = trimmedLine.split('/');
					await this.cloneRepository(owner, name, targetDirectory, i + 1, total, execa);
				}

				this.log(`├──╯ Cloning complete`);
				this.log(`│`);
				this.log(`╰── ✅ All done`);
			}
		}
	}

	private async cloneRepository(
		owner: string,
		name: string,
		targetDirectory: string,
		index: number,
		total: number,
		execa: typeof execa_,
	): Promise<void> {
		const repoFullName = `${owner}/${name}`;
		this.log(`│  ├──╮ [${chalk.yellow(index)}/${total}] ${chalk.yellow(repoFullName)}`);

		const logger = {
			log: (message: string) => this.log(`│  │  │ ${message}`),
		};

		const result = await cloneSingleRepo(owner, name, targetDirectory, execa, logger);

		if (result.error) {
			this.log(`│  │  │ ❌ Failed: ${result.error}`);
			this.log(`│  ├──╯`);
			this.log(`│  │`);
			this.error('Repository cloning failed', {
				exit: 1,
				code: 'CLONE_FAILED',
				suggestions: [
					'Check if the repository exists and is accessible',
					'Verify your GitHub authentication status: gh auth status',
					'Ensure you have permission to clone the repository',
				],
			});
		} else if (result.skipped) {
			this.log(`│  │`);
		} else {
			this.log(`│  │`);
		}
	}
}
