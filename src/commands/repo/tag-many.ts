import {Args, Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import inquirer from 'inquirer';
import {validateMavenRepo} from '../../utils/maven-validation.js';
import {tagSingleRepository} from '../../utils/tag-single-repo.js';
import {validatedRepositoriesSchema} from '../../types/repository.js';

export default class RepoTagMany extends Command {
	static override args = {
		directory: Args.string({
			description: 'Directory containing cloned repos',
			required: false,
		}),
	};

	static override description = 'Tag multiple valid Maven repositories with GitHub topics';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./repos-dir --topic maven',
		'<%= config.bin %> <%= command.id %> ./repos-dir --topic maven --dryRun',
	];

	static override flags = {
		topic: Flags.string({
			char: 't',
			description: 'Topic to synchronize',
			required: true,
		}),
		dryRun: Flags.boolean({
			char: 'd',
			description: 'Show changes without applying them',
			default: false,
		}),
		yes: Flags.boolean({
			char: 'y',
			description: 'Automatically answer "yes" to all prompts',
			default: false,
		}),
	};

	public async run(): Promise<{
		success: boolean;
		topic: string;
		tagged: {owner: string; name: string}[];
		skipped: {owner: string; name: string; reason: string}[];
	}> {
		const {args, flags} = await this.parse(RepoTagMany);
		const {directory} = args;
		const {topic, dryRun, yes} = flags;

		const tagged: {owner: string; name: string}[] = [];
		const skipped: {owner: string; name: string; reason: string}[] = [];
		const validRepos: Array<{
			path: string;
			name: string;
			owner: string;
			repoName: string;
		}> = [];

		const execa = execa_;

		this.log(`╭─── 🏷️ Adding ${chalk.yellow(topic)} topic to validated repositories...`);
		this.log(`│`);

		if (dryRun) {
			this.warn(`│  │ Running in dry-run mode - no changes will be applied`);
		}

		try {
			if (!directory && !process.stdin.isTTY) {
				this.log(`├──╮ 🔍 Reading validated repositories from input...`);

				let fullInput = '';
				for await (const chunk of process.stdin) {
					fullInput += chunk;
				}

				try {
					const jsonData = JSON.parse(fullInput);
					const inputRepos = jsonData.validRepos || jsonData;
					const validatedRepos = validatedRepositoriesSchema.parse(inputRepos).filter((repo) => repo.valid);

					for (const repo of validatedRepos) {
						if (await this.isGitRepository(repo.path)) {
							validRepos.push({
								path: repo.path,
								name: repo.name,
								owner: repo.owner.login,
								repoName: repo.name,
							});
						} else {
							skipped.push({owner: repo.owner.login, name: repo.name, reason: 'not a git repository'});
						}
					}
				} catch {
					this.error('Invalid JSON input from stdin', {
						exit: 1,
						code: 'INVALID_JSON',
						suggestions: [
							'Ensure the input is valid JSON',
							'The input should match the output from repo:validate-many --json',
						],
					});
				}
			} else if (directory) {
				this.log(
					`├──╮ 🔍 Scanning directory: ${chalk.yellow(directory)} for repositories to tag with topic: ${chalk.yellow(topic)}`,
				);

				const absolutePath = path.resolve(directory);
				const entries = await fs.readdir(absolutePath, {withFileTypes: true});

				const ownerDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

				this.log(`│  │ Found ${chalk.yellow(ownerDirs.length)} owner directories to check`);

				let totalRepos = 0;

				for (const ownerDir of ownerDirs) {
					const ownerPath = path.join(absolutePath, ownerDir);

					const repoEntries = await fs.readdir(ownerPath, {withFileTypes: true});
					const repoDirs = repoEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

					for (const repoDir of repoDirs) {
						totalRepos++;
						const repoPath = path.join(ownerPath, repoDir);
						const repoName = repoDir;

						this.log(`│  │`);
						this.log(
							`│  ├──╮ 🔍 [${chalk.yellow(totalRepos)}/${repoDirs.length} in ${chalk.yellow(ownerDir)}] ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)}`,
						);

						if (!(await this.isGitRepository(repoPath))) {
							this.log(
								`│  │  │ Skipping ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)} - not a git repository`,
							);
							skipped.push({owner: ownerDir, name: repoName, reason: 'not a git repository'});
							this.log(`│  ├──╯ ⏩ Repository skipped`);
							continue;
						}

						this.log(`│  │  │ Validating Maven repo at: ${chalk.cyan(path.resolve(repoPath))}`);
						const validationResult = await validateMavenRepo(repoPath, execa, this);

						if (validationResult.valid) {
							this.log(
								`│  ├──╯ ✅ Valid Maven repository: ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)}`,
							);

							validRepos.push({
								path: repoPath,
								name: repoName,
								owner: ownerDir,
								repoName,
							});
						} else {
							this.log(
								`│  ├──╯ ⏩ Skipping ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)} - not a valid Maven repository`,
							);
							skipped.push({owner: ownerDir, name: repoName, reason: 'not a valid Maven repository'});
						}
					}
				}

				this.log(`│  │`);
				this.log(`│  ├──╮ 📊 Summary:`);
				this.log(
					`│  │  │ Checked ${chalk.yellow(totalRepos)} total repositories across ${chalk.yellow(ownerDirs.length)} owner directories`,
				);
			} else {
				this.error('No input provided. Provide a directory path or pipe JSON data from stdin.', {
					exit: 1,
					code: 'NO_INPUT',
					suggestions: [
						'Provide a directory path as an argument',
						'Pipe JSON data from repo:validate-many command',
						'Example: aggregator repo:validate-many ./repos --json | aggregator repo:tag --topic maven',
					],
				});
			}

			if (validRepos.length === 0) {
				this.warn(`│  ├──╯ ℹ️ No valid Maven repositories found to tag.`);
				return {
					success: true,
					topic,
					tagged: [],
					skipped,
				};
			}

			this.log(`│  │  │ Found ${chalk.green(validRepos.length)} valid Maven repositories to tag:`);

			for (const repo of validRepos) {
				this.log(`│  │  │ - ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)}`);
			}
			this.log(`│  ├──╯ ✅ Analysis complete`);
			this.log(`│  │`);

			let proceed = dryRun || yes;

			if (!proceed) {
				this.log(
					`│  ├──╮ 🤔 Do you want to tag these ${chalk.yellow(validRepos.length)} repositories with the '${chalk.yellow(topic)}' topic?`,
				);

				const {confirmed} = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'confirmed',
						message: `Proceed with tagging?`,
						default: false,
					},
				]);
				proceed = confirmed;

				if (!proceed) {
					this.warn(`│  ├──╯ ❌ Operation canceled by user.`);
					return {
						success: false,
						topic,
						tagged: [],
						skipped,
					};
				}
				this.log(`│  ├──╯ ✅ Confirmed`);
			}

			this.log(`│  │`);
			this.log(`│  ├──╮ 🏷️ Tagging repositories...`);

			for (const [i, repo] of validRepos.entries()) {
				const tagResult = await tagSingleRepository({
					owner: repo.owner,
					name: repo.repoName,
					topic,
					dryRun,
					execa,
					logger: {
						log: (message: string) => this.log(`│  │  │ ${message}`),
						warn: (message: string) => this.warn(`│  │  │ ${message}`),
						error: (message: string, options?: {exit?: boolean}) => {
							if (options?.exit === false) {
								this.error(`│  │  │ ${message}`, {exit: false});
							} else {
								this.warn(`│  │  │ ${message}`);
							}
						},
					},
				});

				if (tagResult.success) {
					if (dryRun) {
						this.log(
							`│  │  │ ${chalk.blue('[DRY RUN]')} [${chalk.yellow(i + 1)}/${validRepos.length}] Would tag ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)} with topic: ${chalk.cyan(topic)}`,
						);
					} else if (tagResult.alreadyTagged) {
						this.log(
							`│  │  │ ✓ [${chalk.yellow(i + 1)}/${validRepos.length}] ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)} already has topic: ${chalk.cyan(topic)}`,
						);
					} else {
						this.log(
							`│  │  │ ✓ [${chalk.yellow(i + 1)}/${validRepos.length}] Tagged ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)} with topic: ${chalk.cyan(topic)}`,
						);
					}
					tagged.push({owner: repo.owner, name: repo.repoName});
				} else {
					this.warn(
						`│  │  │ ✗ [${chalk.yellow(i + 1)}/${validRepos.length}] Failed to tag ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)}: ${tagResult.error}`,
					);
					skipped.push({owner: repo.owner, name: repo.repoName, reason: tagResult.error || 'tagging failed'});
				}
			}
			this.log(`│  ├──╯`);
			this.log(`│  │ ✅ Tagging complete`);
			this.log(`├──╯`);
			this.log(`│`);
			this.log(`╰─── ✅ Repository tagging process completed`);

			return {
				success: true,
				topic,
				tagged,
				skipped,
			};
		} catch (error) {
			let errorMessage = 'Unknown error';
			let errorCode: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorCode = 'code' in error ? (error.code as string) : undefined;
			}

			this.error(`Failed to process repositories: ${error}`, {
				exit: 1,
				code: errorCode,
				suggestions: [
					errorMessage,
					'Ensure the directory contains git repositories',
					'Check that you have proper file system permissions',
				],
			});

			return {
				success: false,
				topic,
				tagged: [],
				skipped: [],
			};
		}
	}

	private async isGitRepository(repoPath: string): Promise<boolean> {
		try {
			const gitDir = path.join(repoPath, '.git');
			return await fs.pathExists(gitDir);
		} catch {
			return false;
		}
	}
}
