import {Args, Command} from '@oclif/core';
import * as fs from 'fs-extra';
import {z} from 'zod';
import chalk from 'chalk';
import {repositoriesSchema, repositorySchema} from '../../types/repository.js';
import RepoClone from './clone.js';

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
		}

		this.log(`╭─── 📦 Cloning repositories...`);
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
					await this.cloneRepository(repo.owner.login, repo.name, targetDirectory, i + 1, total);
				}

				this.log(`├──╯ Cloning complete`);
				this.log(`│`);
				this.log(`╰─── ✅ All done`);
			} else {
				const validRepo = repositorySchema.parse(jsonData);
				const total = 1;
				this.log(`├──╮ 🚀 Cloning ${chalk.yellow(1)} repository`);

				await this.cloneRepository(validRepo.owner.login, validRepo.name, targetDirectory, 1, total);

				this.log(`├──╯ Cloning complete`);
				this.log(`│`);
				this.log(`╰─── ✅ All done`);
			}
		} catch (error) {
			if (error instanceof z.ZodError || error instanceof SyntaxError) {
				// Handle as plain text input
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
					await this.cloneRepository(owner, name, targetDirectory, i + 1, total);
				}

				this.log(`├──╯ Cloning complete`);
				this.log(`│`);
				this.log(`╰── ✅ All done`);
			} else {
				throw error;
			}
		}
	}

	private async cloneRepository(
		owner: string,
		name: string,
		targetDirectory: string,
		index: number,
		total: number,
	): Promise<void> {
		const repoFullName = `${owner}/${name}`;
		this.log(`│  ├──╮ [${chalk.yellow(index)}/${total}] ${chalk.yellow(repoFullName)}`);

		try {
			// Create a new instance of RepoClone command with proper arguments
			const cloneCommand = new RepoClone(
				['--output-directory', targetDirectory, '--owner', owner, '--name', name, '--json'],
				this.config,
			);

			// Run the command and get the result directly
			const result = await cloneCommand.run();

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
			} else if (result.alreadyExists) {
				this.log(`│  │  │ ⏩ Repository already exists`);
			} else if (result.cloned) {
				this.log(`│  │  │ ✅ Successfully cloned`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.log(`│  │  │ ❌ Failed: ${errorMessage}`);
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
		}

		this.log(`│  │`);
	}
}
