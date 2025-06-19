import {Args, Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import {validateMavenRepo} from '../../utils/maven-validation.js';
import {repositoriesSchema, type ValidatedRepository} from '../../types/repository.js';

export default class RepoValidateMany extends Command {
	static override args = {
		repoPath: Args.string({
			description: 'Path to the repository or directory of repositories to validate (or omit to read from stdin)',
			required: false,
		}),
	};

	static override description = 'Validates multiple Maven repositories from a directory or stdin';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./path/to/repo',
		'<%= config.bin %> <%= command.id %> /path/to/repos-dir',
		'<%= config.bin %> <%= command.id %> ./repos-dir --output ./validated-repos.txt',
		'<%= config.bin %> <%= command.id %> ./repos-dir --json',
		'<%= config.bin %> repo:list --user someuser --json | <%= config.bin %> <%= command.id %> --json',
	];

	static override flags = {
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during validation',
		}),
		output: Flags.string({
			char: 'o',
			description: 'Output file to write validated repository list',
		}),
	};

	public async run(): Promise<{validRepos: ValidatedRepository[]; validCount: number}> {
		const {args, flags} = await this.parse(RepoValidateMany);
		const {repoPath} = args;

		const execa = execa_;

		const startTime = Date.now();
		const repos: ValidatedRepository[] = [];

		if (!repoPath && !process.stdin.isTTY) {
			let fullInput = '';
			for await (const chunk of process.stdin) {
				fullInput += chunk;
			}

			try {
				const jsonData = JSON.parse(fullInput);
				const repositories = repositoriesSchema.parse(jsonData);

				for (const repo of repositories) {
					const repoPath = path.join(process.cwd(), 'repos-dir', repo.owner.login, repo.name);
					const hasPom = await fs.pathExists(path.join(repoPath, 'pom.xml'));

					repos.push({
						...repo,
						path: repoPath,
						hasPom,
						valid: false,
					});
				}
			} catch {
				this.error('Invalid JSON input from stdin', {
					exit: 1,
					code: 'INVALID_JSON',
					suggestions: [
						'Ensure the input is valid JSON',
						'The input should match the output from repo:list --json',
					],
				});
			}
		} else if (repoPath) {
			const absolutePath = path.resolve(repoPath);

			try {
				const stats = await fs.stat(absolutePath);
				if (!stats.isDirectory()) {
					this.error(`Path is not a directory: ${chalk.yellow(absolutePath)}`, {
						exit: 1,
						code: 'ENOTDIR',
						suggestions: [
							'Ensure the path points to a directory, not a file',
							`Try: mkdir -p "${absolutePath}"`,
						],
					});
				}

				const hasPom = await fs.pathExists(path.join(absolutePath, 'pom.xml'));

				if (hasPom) {
					const repoName = path.basename(absolutePath);
					const ownerName = path.basename(path.dirname(absolutePath));

					repos.push({
						path: absolutePath,
						owner: {login: ownerName, type: 'User'},
						name: repoName,
						hasPom: true,
						valid: false,
						language: null,
						topics: [],
						fork: false,
						archived: false,
						disabled: false,
						is_template: false,
						private: false,
						visibility: 'public',
					});
				} else {
					const ownerDirs = await fs.readdir(absolutePath, {withFileTypes: true});

					for (const ownerDir of ownerDirs.filter((entry) => entry.isDirectory())) {
						const ownerPath = path.join(absolutePath, ownerDir.name);
						const repoDirs = await fs.readdir(ownerPath, {withFileTypes: true});

						for (const repoDir of repoDirs.filter((entry) => entry.isDirectory())) {
							const repoPath = path.join(ownerPath, repoDir.name);
							const repoHasPom = await fs.pathExists(path.join(repoPath, 'pom.xml'));

							repos.push({
								path: repoPath,
								owner: {login: ownerDir.name, type: 'User'},
								name: repoDir.name,
								hasPom: repoHasPom,
								valid: false,
								language: null,
								topics: [],
								fork: false,
								archived: false,
								disabled: false,
								is_template: false,
								private: false,
								visibility: 'public',
							});
						}
					}
				}
			} catch (error) {
				let errorMessage = 'Unknown error';
				let errorCode: string | undefined;

				if (error instanceof Error) {
					errorMessage = error.message;
					errorCode = 'code' in error ? (error.code as string) : undefined;
				}

				this.error(`Error validating repositories: ${error}`, {
					exit: 1,
					code: errorCode,
					suggestions: [errorMessage],
				});
				return {validRepos: [], validCount: 0};
			}
		} else {
			this.error('No input provided. Provide a directory path or pipe JSON data from stdin.', {
				exit: 1,
				code: 'NO_INPUT',
				suggestions: [
					'Provide a directory path as an argument',
					'Pipe JSON data from repo:list command',
					'Example: aggregator repo:list --json | aggregator repo:validate-many',
				],
			});
		}

		this.log(`╭─── 🔍 Validating Maven repositories...`);
		this.log(`│`);

		let validCount = 0;
		const validRepos: ValidatedRepository[] = [];

		for (const [i, repo] of repos.entries()) {
			const repoFullName = `${repo.owner.login}/${repo.name}`;

			this.log(`├──╮ 🔍 [${chalk.yellow(i + 1)}/${repos.length}] ${chalk.yellow(repoFullName)}`);
			this.log(`│  │ Validating Maven repo at: ${chalk.cyan(repo.path)}`);

			if (!repo.hasPom) {
				this.log(`├──╯ ⏩ Skipping non-Maven repository: ${chalk.yellow(repoFullName)}`);
				this.log(`│`);
				continue;
			}

			const validationResult = await validateMavenRepo(repo.path, execa, this);
			repo.valid = validationResult.valid;

			if (validationResult.valid) {
				this.log(`├──╯ ✅ Validation successful: ${chalk.green(repoFullName)}`);
				validCount++;
				validRepos.push(repo);
			} else {
				this.log(`├──╯ ❌ Validation failed: ${chalk.red(repoFullName)}`);
			}

			this.log(`│`);
		}

		this.log(
			`├──╮ ✅ Found ${chalk.green(validCount)} validated Maven ${validCount === 1 ? 'repository' : 'repositories'}`,
		);

		if (flags.output && validRepos.length > 0) {
			const outputPath = path.resolve(flags.output);
			await fs.ensureDir(path.dirname(outputPath));

			const validRepoNames = validRepos.map((repo) => `${repo.owner.login}/${repo.name}`).join('\n');
			await fs.writeFile(outputPath, validRepoNames);

			this.log(`│  │ 📄 Validated repository list written to: ${chalk.cyan(outputPath)}`);
		}
		this.log(`├──╯`);

		this.log(`│`);
		this.log(`╰─── ✅ All done`);

		const elapsedMs = Date.now() - startTime;
		this.debug(`Validation completed in ${elapsedMs}ms`);

		return {
			validRepos,
			validCount,
		};
	}
}
