import {Args, Command, Flags} from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import {execa as _execa, type Result} from 'execa';
import {create} from 'xmlbuilder2';
import chalk from 'chalk';
import inquirer from 'inquirer';
import MavenGAVCoords from '../../maven-gav.js';
import {validatedRepositoriesSchema, type ValidatedRepository} from '../../types/repository.js';

export default class AggregatorCreate extends Command {
	static override args = {
		directory: Args.string({
			description: 'Directory containing final Maven repos (or omit to read from stdin)',
			required: false,
		}),
	};

	static override description = 'Create Maven aggregator POM from a directory of repositories';

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./maven-repos',
		'<%= config.bin %> <%= command.id %> ./maven-repos --groupId org.example',
		'<%= config.bin %> <%= command.id %> ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0',
		'<%= config.bin %> <%= command.id %> ./maven-repos --force',
		'<%= config.bin %> <%= command.id %> ./maven-repos --json',
		'<%= config.bin %> repo:list --user someuser --json | <%= config.bin %> repo:validate-many --json | <%= config.bin %> <%= command.id %> ./output-dir',
	];

	static override enableJsonFlag = true;

	static override flags = {
		groupId: Flags.string({
			char: 'g',
			description: 'GroupId for aggregator POM',
			default: 'com.example',
		}),
		artifactId: Flags.string({
			char: 'a',
			description: 'ArtifactId for aggregator POM',
			default: 'aggregator',
		}),
		pomVersion: Flags.string({
			char: 'v',
			description: 'Version for aggregator POM',
			default: '1.0.0-SNAPSHOT',
		}),
		yes: Flags.boolean({
			char: 'y',
			description: 'Automatically answer "yes" to all prompts',
			default: false,
		}),
		parallel: Flags.boolean({
			description: 'Enable parallel processing',
			default: true,
			allowNo: true,
		}),
	};

	private async execute(command: string, args: string[] = [], execaFn = _execa): Promise<Result> {
		this.log(`│  ├──╮`);

		try {
			return await execaFn(command, args);
		} catch (error: unknown) {
			this.error(`├─ Command failed: ${command} ${args.join(' ')}`);
			const errorObj = error as Error & {stderr?: string};
			this.error(`└─ ${errorObj.stderr || errorObj.message}`);
			throw error;
		}
	}

	private async validateMavenRepo(repoPath: string): Promise<boolean> {
		const pomPath = path.join(repoPath, 'pom.xml');
		try {
			await fs.access(pomPath, fs.constants.R_OK);
			return true;
		} catch {
			return false;
		}
	}

	private async getMavenProjectAttribute(pomFile: string, attribute: string, execaFn = _execa): Promise<string> {
		try {
			const result = await this.execute(
				'mvn',
				['-f', pomFile, 'help:evaluate', `-Dexpression=${attribute}`, '--quiet', '-DforceStdout'],
				execaFn,
			);
			if (typeof result.stdout === 'string') {
				return result.stdout;
			}

			throw new Error(`Failed to evaluate Maven expression: ${result.stderr}`);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			this.debug(`Maven error evaluating ${attribute} in ${pomFile}: ${errorMessage}`);

			throw new Error(`Failed to get Maven attribute ${attribute} from ${pomFile}: ${errorMessage}`);
		}
	}

	private async isParentPom(pomFile: string, execaFn = _execa): Promise<boolean> {
		try {
			const modules = await this.getMavenProjectAttribute(pomFile, 'project.modules', execaFn);
			if (modules.length > 0 && modules !== '<modules/>') {
				this.log(`│  │ ✅ ${chalk.yellow(pomFile)} is a parent POM`);
				return true;
			}

			this.log(`│  │ ❌ ${chalk.yellow(pomFile)} is not a parent POM`);
			return false;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (
				errorMessage.includes('Non-resolvable parent POM') ||
				errorMessage.includes('parent.relativePath') ||
				errorMessage.includes('Could not find artifact')
			) {
				this.log(
					`│  │ ⚠️ ${chalk.yellow(pomFile)} has parent POM resolution issues, treating as non-parent POM`,
				);
				return false;
			}

			this.log(`│  ╰ ❌ Failed to determine if ${chalk.yellow(pomFile)} is a parent POM: ${errorMessage}`);
			return false;
		}
	}

	private async processPoms(allPoms: string[], execaFn = _execa, parallel = true) {
		this.log(
			`│  │ ⏳ Processing all found POM files for non parent POM files to add to the dependencyManagement section...`,
		);

		const processGAV = async (pom: string) => {
			try {
				const parentPom = await this.isParentPom(pom, execaFn);
				if (!parentPom) {
					return this.getGAVFromPom(pom, execaFn);
				}
			} catch {
				this.log(`│  │ ⚠️ Could not determine if ${chalk.yellow(pom)} is a parent POM, skipping`);
			}
			return null;
		};

		let gavResults: (MavenGAVCoords | null)[];

		if (parallel) {
			const gavPromises = allPoms.map((pom) => processGAV(pom));
			gavResults = await Promise.all(gavPromises);
		} else {
			gavResults = [];
			for (const pom of allPoms) {
				const result = await processGAV(pom);
				gavResults.push(result);
			}
		}

		const allGAVs = gavResults.filter((gav): gav is MavenGAVCoords => gav !== null);

		this.log(`│  │ `);
		this.log(`│  ├──╮ 📝 Adding to the dependencyManagement section of the aggregator...`);

		if (allGAVs.length > 0) {
			for (const gav of allGAVs) {
				this.log(
					`│  │  │ Adding group ID: ${chalk.yellow(gav.getGroupId())}, artifact ID: ${chalk.yellow(gav.getArtifactId())}, and version: ${chalk.yellow(gav.getVersion())}`,
				);
			}
		} else {
			this.log(`│  │  │ ℹ️ No GAVs found to add to the dependencyManagement section of the aggregator...`);
		}

		this.log(`│  ├──╯`);

		return allGAVs;
	}

	private async findPomFiles(dir: string, parallel = true): Promise<string[]> {
		try {
			await fs.ensureDir(path.dirname(dir));
		} catch (error: unknown) {
			let errorMessage = 'Unknown error';
			let errorCode: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorCode = 'code' in error ? (error.code as string) : undefined;
			}

			this.error(`Failed to access directory: ${errorMessage}`, {
				exit: 1,
				code: errorCode || 'DIRECTORY_ACCESS_ERROR',
				suggestions: [
					'Check if the directory exists',
					'Verify you have read permissions for the directory',
					`Try: mkdir -p "${dir}"`,
				],
			});
		}
		this.log(`│  │ 🔍  Scanning: ${chalk.yellow(dir)} for all pom.xml files...`);
		const pomFiles = [];
		const dirsToExplore = [dir];
		while (dirsToExplore.length > 0) {
			const currentDir = dirsToExplore.pop() as string;
			try {
				const files = await fs.readdir(currentDir);
				if (files.length > 0) {
					if (parallel) {
						const statPromises = files.map(async (file) => {
							const filepath = path.join(currentDir, file);
							const stat = await fs.stat(filepath);
							return {filepath, stat, file};
						});
						const results = await Promise.all(statPromises);
						for (const result of results) {
							if (result) {
								const {filepath, stat, file} = result;
								if (stat && stat.isDirectory()) {
									dirsToExplore.push(filepath);
								} else if (stat && stat.isFile() && file === 'pom.xml') {
									pomFiles.push(filepath);
								}
							}
						}
					} else {
						for (const file of files) {
							const filepath = path.join(currentDir, file);
							const stat = await fs.stat(filepath);
							if (stat && stat.isDirectory()) {
								dirsToExplore.push(filepath);
							} else if (stat && stat.isFile() && file === 'pom.xml') {
								pomFiles.push(filepath);
							}
						}
					}
				}
			} catch {
				// Directory or file not found, continue on
			}
		}
		return pomFiles;
	}

	private async getGAVFromPom(pomFile: string, execaFn = _execa): Promise<MavenGAVCoords | null> {
		try {
			const groupId = await this.getMavenProjectAttribute(pomFile, 'project.groupId', execaFn);
			const artifactId = await this.getMavenProjectAttribute(pomFile, 'project.artifactId', execaFn);
			const version = await this.getMavenProjectAttribute(pomFile, 'project.version', execaFn);

			return new MavenGAVCoords(groupId, artifactId, version);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (
				errorMessage.includes('Non-resolvable parent POM') ||
				errorMessage.includes('parent.relativePath') ||
				errorMessage.includes('Could not find artifact')
			) {
				this.log(
					`│  │ ⚠️ Could not process ${chalk.yellow(pomFile)} due to parent POM resolution issues: ${errorMessage}`,
				);
			} else {
				this.log(`│  │ ❌ Failed to collect GAV from ${chalk.yellow(pomFile)}: ${errorMessage}`);
			}

			return null;
		}
	}

	private createAggregatorPom(
		groupId: string,
		artifactId: string,
		version: string,
		modules: string[],
		gavs: MavenGAVCoords[],
	): string {
		// prettier-ignore
		const pom = create({version: '1.0'})
      .ele('project', {
        'xmlns': 'http://maven.apache.org/POM/4.0.0',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
      })
      .ele('modelVersion').txt('4.0.0').up()
      .ele('groupId').txt(groupId).up()
      .ele('artifactId').txt(artifactId).up()
      .ele('version').txt(version).up()
      .ele('packaging').txt('pom').up()
      .ele('name').txt(`${artifactId} Aggregator POM`).up()
      .ele('description').txt('Aggregator POM for multiple Maven repositories').up()

		const modulesEle = pom.ele('modules');
		for (const module of modules) {
			modulesEle.ele('module').txt(module);
		}
		const dependencyManagementEle = pom.ele('dependencyManagement');
		const dependenciesEle = dependencyManagementEle.ele('dependencies');
		for (const gav of gavs) {
			const dependencyEle = dependenciesEle.ele('dependency');
			dependencyEle.ele('groupId').txt(gav.getGroupId());
			dependencyEle.ele('artifactId').txt(gav.getArtifactId());
			dependencyEle.ele('version').txt(gav.getVersion());
		}
		return pom.end({prettyPrint: true});
	}

	public async run(): Promise<{
		success: boolean;
		pomPath: string;
		modules: {
			path: string;
			valid: boolean;
			reason?: string;
		}[];
		stats: {
			totalScanned: number;
			validRepositories: number;
			skippedRepositories: number;
			elapsedTimeMs: number;
		};
		mavenCoordinates: {
			groupId: string;
			artifactId: string;
			version: string;
		};
	}> {
		const execa = _execa({
			verbose: (verboseLine: string, {type}: {type: string}) => {
				switch (type) {
					case 'command': {
						this.log(`│  │  │ ${verboseLine}`);
						break;
					}
					case 'duration': {
						this.log(`│  ├──╯ ${verboseLine}`);
						break;
					}
					case 'output': {
						const MAX_LENGTH = 120;
						const truncatedLine =
							verboseLine.length > MAX_LENGTH
								? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...`
								: verboseLine;
						this.log(`│  │  │ ${truncatedLine}`);
						break;
					}
					default: {
						this.debug(`${type} ${verboseLine}`);
					}
				}
			},
		});

		const startTime = Date.now();
		const {args, flags} = await this.parse(AggregatorCreate);
		let directoryPath: string;
		let validRepos: ValidatedRepository[] = [];

		if (!args.directory && !process.stdin.isTTY) {
			let fullInput = '';
			for await (const chunk of process.stdin) {
				fullInput += chunk;
			}

			if (!fullInput.trim()) {
				this.error('No input provided. Provide a directory path or pipe JSON data from stdin.', {
					exit: 1,
					code: 'NO_INPUT',
					suggestions: [
						'Provide a directory path as an argument',
						'Pipe JSON data from repo:validate-many command',
						'Example: aggregator repo:validate-many ./repos --json | aggregator aggregator:create ./output',
					],
				});
			}

			try {
				const jsonData = JSON.parse(fullInput);
				const inputRepos = jsonData.validRepos || jsonData;
				validRepos = validatedRepositoriesSchema.parse(inputRepos).filter((repo) => repo.valid);

				if (validRepos.length === 0) {
					this.error('No valid repositories found in input', {
						exit: 1,
						code: 'NO_VALID_REPOS',
						suggestions: [
							'Ensure the input contains valid Maven repositories',
							'The input should be from repo:validate-many --json',
						],
					});
				}

				directoryPath = path.resolve(validRepos[0].path.split('/').slice(0, -2).join('/'));
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
		} else if (args.directory) {
			directoryPath = path.resolve(args.directory);

			try {
				await fs.ensureDir(directoryPath);
			} catch (error: unknown) {
				let errorMessage = 'Unknown error';
				let errorCode: string | undefined;

				if (error instanceof Error) {
					errorMessage = error.message;
					errorCode = 'code' in error ? (error.code as string) : undefined;
				}

				this.error(`Failed to access directory: ${errorMessage}`, {
					exit: 1,
					code: errorCode || 'DIRECTORY_ACCESS_ERROR',
					suggestions: [
						'Check if the directory path is valid',
						'Verify you have read/write permissions',
						`Try: mkdir -p "${directoryPath}"`,
					],
				});
			}
		} else {
			this.error('No input provided. Provide a directory path or pipe JSON data from stdin.', {
				exit: 1,
				code: 'NO_INPUT',
				suggestions: [
					'Provide a directory path as an argument',
					'Pipe JSON data from repo:validate-many command',
					'Example: aggregator repo:validate-many ./repos --json | aggregator aggregator:create ./output',
				],
			});
		}

		this.log(`╭─── 📄 Creating aggregator POM...`);
		this.log(`│`);

		const mavenRepos: {path: string; relativePath: string}[] = [];
		const skippedRepos: {path: string; relativePath: string; reason: string}[] = [];
		let totalScanned = 0;

		if (validRepos.length > 0) {
			this.log(`├──╮ 🔍 Using ${chalk.yellow(validRepos.length)} validated repositories from input...`);

			for (const repo of validRepos) {
				const relativePath = path.join(repo.owner.login, repo.name);
				mavenRepos.push({
					path: repo.path,
					relativePath,
				});
			}
			totalScanned = validRepos.length;
		} else {
			this.log(`├──╮ 🔍 Scanning for Maven repositories in ${chalk.yellow(directoryPath)}...`);

			const entries = await fs.readdir(directoryPath);

			const firstLevelEntries = [];
			for (const entry of entries) {
				if (entry === 'pom.xml') continue;

				const entryPath = path.join(directoryPath, entry);
				const stats = await fs.stat(entryPath);

				if (stats.isDirectory()) {
					firstLevelEntries.push(entry);
				}
			}

			this.log(`│  │ Found ${chalk.yellow(firstLevelEntries.length)} potential repository containers to scan`);

			if (firstLevelEntries.length === 0) {
				const elapsedTimeMs = Date.now() - startTime;

				const result = {
					success: false,
					pomPath: '',
					modules: [],
					stats: {
						totalScanned: 0,
						validRepositories: 0,
						skippedRepositories: 0,
						elapsedTimeMs,
					},
					mavenCoordinates: {
						groupId: flags.groupId,
						artifactId: flags.artifactId,
						version: flags.pomVersion,
					},
					error: 'No Maven repositories found. Each repository must contain a pom.xml file.',
				};

				if (!this.jsonEnabled()) {
					this.error(result.error, {
						exit: 1,
						code: 'NO_MAVEN_REPOS',
						suggestions: [
							'Ensure the directory contains Maven projects with pom.xml files',
							'Check that repository directories follow the expected structure',
							'Verify that pom.xml files exist in the repository directories',
						],
					});
				}

				return result;
			}

			for (const entry of firstLevelEntries) {
				this.log(`│  │ ⏳ Examining: ${chalk.yellow(entry)}`);

				const entryPath = path.join(directoryPath, entry);
				const stats = await fs.stat(entryPath);

				if (!stats.isDirectory()) {
					throw new Error(`Expected ${entryPath} to be a directory`);
				}

				totalScanned++;

				const hasPom = await this.validateMavenRepo(entryPath);
				if (hasPom) {
					mavenRepos.push({
						path: entryPath,
						relativePath: entry,
					});
					continue;
				}

				try {
					const subEntries = await fs.readdir(entryPath);
					for (const subEntry of subEntries) {
						const subEntryPath = path.join(entryPath, subEntry);
						const subStats = await fs.stat(subEntryPath);

						if (!subStats.isDirectory()) continue;

						totalScanned++;
						const hasSubPom = await this.validateMavenRepo(subEntryPath);
						if (hasSubPom) {
							mavenRepos.push({
								path: subEntryPath,
								relativePath: path.join(entry, subEntry),
							});
						} else {
							skippedRepos.push({
								path: subEntryPath,
								relativePath: path.join(entry, subEntry),
								reason: 'Missing pom.xml',
							});
						}
					}
				} catch (error) {
					skippedRepos.push({
						path: entryPath,
						relativePath: entry,
						reason: `Error reading directory: ${(error as Error).message}`,
					});
				}
			}
		}

		if (mavenRepos.length === 0) {
			const elapsedTimeMs = Date.now() - startTime;

			const result = {
				success: false,
				pomPath: '',
				modules: [],
				stats: {
					totalScanned,
					validRepositories: 0,
					skippedRepositories: skippedRepos.length,
					elapsedTimeMs,
				},
				mavenCoordinates: {
					groupId: flags.groupId,
					artifactId: flags.artifactId,
					version: flags.pomVersion,
				},
				error: 'No Maven repositories found. Each repository must contain a pom.xml file.',
			};

			if (!this.jsonEnabled()) {
				this.error(result.error, {
					exit: 1,
					code: 'NO_MAVEN_REPOS',
					suggestions: [
						'Ensure the directory contains Maven projects with pom.xml files',
						'Check that repository directories follow the expected structure',
						'Verify that pom.xml files exist in the repository directories',
					],
				});
			}

			return result;
		}

		const validModules = mavenRepos.map((repo) => repo.relativePath);

		for (const repo of mavenRepos) {
			this.log(`│  │ ✅ Found valid Maven repository: ${chalk.yellow(repo.relativePath)}`);
		}
		const allPoms = await this.findPomFiles(directoryPath, flags.parallel);
		const allGAVs = await this.processPoms(allPoms, execa, flags.parallel);
		this.log(`│  │`);
		this.log(`│  ├──╮ 📊 Repository scan summary:`);
		this.log(`│  │  │ Found ${chalk.yellow(mavenRepos.length)} valid Maven repositories`);
		this.log(
			`│  │  │ Found ${chalk.yellow(allGAVs.length)} GAVs to add to the dependencyManagement section of the POM`,
		);
		if (skippedRepos.length > 0) {
			this.log(`│  │  │ ⚠️ Skipped ${chalk.yellow(skippedRepos.length)} repositories`);
			for (const repo of skippedRepos) {
				if (repo.reason === 'Missing pom.xml') {
					this.log(`│  │  │   → ${chalk.yellow(repo.relativePath)}: Missing pom.xml file`);
				}
			}
		}
		this.log(`│  ├──╯`);

		const {yes} = flags;
		let proceed = yes;

		if (!proceed) {
			this.log(`│  │`);
			this.log(`│  ├──╮ 📋 Ready to create aggregator POM with the following settings:`);
			this.log(`│  │  │ - groupId: ${chalk.yellow(flags.groupId)}`);
			this.log(`│  │  │ - artifactId: ${chalk.yellow(flags.artifactId)}`);
			this.log(`│  │  │ - version: ${chalk.yellow(flags.pomVersion)}`);
			this.log(`│  │  │ - modules: ${chalk.yellow(validModules.length)} Maven repositories`);

			const {confirmed} = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'confirmed',
					message: 'Do you want to create the aggregator POM?',
					default: false,
				},
			]);
			proceed = confirmed;
		}

		if (!proceed) {
			this.warn(`│  ├──╯ Operation canceled by user.`);
			const elapsedTimeMs = Date.now() - startTime;

			return {
				success: false,
				pomPath: '',
				modules: [
					...mavenRepos.map((repo) => ({
						path: repo.relativePath,
						valid: true,
					})),
					...skippedRepos.map((repo) => ({
						path: repo.relativePath,
						valid: false,
						reason: repo.reason,
					})),
				],
				stats: {
					totalScanned,
					validRepositories: mavenRepos.length,
					skippedRepositories: skippedRepos.length,
					elapsedTimeMs,
				},
				mavenCoordinates: {
					groupId: flags.groupId,
					artifactId: flags.artifactId,
					version: flags.pomVersion,
				},
			};
		}

		const pomXml = this.createAggregatorPom(
			flags.groupId,
			flags.artifactId,
			flags.pomVersion,
			validModules,
			allGAVs,
		);

		const pomPath = path.join(directoryPath, 'pom.xml');
		try {
			await fs.writeFile(pomPath, pomXml);
			this.log(`│  │`);
			this.log(`│  ├──╮ ✅ Created aggregator POM at ${chalk.yellow(pomPath)}`);
			this.log(`│  │  │ 📋 Included ${chalk.yellow(validModules.length)} modules`);

			const elapsedTimeMs = Date.now() - startTime;
			this.log(`│  ├──╯ ⏱️ Operation completed in ${chalk.dim(`${elapsedTimeMs}ms`)}`);
			this.log(`├──╯`);
			this.log(`│`);
			this.log(`╰─── ✅ Successfully created aggregator POM at: ${chalk.yellow(pomPath)}`);

			return {
				success: true,
				pomPath,
				modules: [
					...mavenRepos.map((repo) => ({
						path: repo.relativePath,
						valid: true,
					})),
					...skippedRepos.map((repo) => ({
						path: repo.relativePath,
						valid: false,
						reason: repo.reason,
					})),
				],
				stats: {
					totalScanned,
					validRepositories: mavenRepos.length,
					skippedRepositories: skippedRepos.length,
					elapsedTimeMs,
				},
				mavenCoordinates: {
					groupId: flags.groupId,
					artifactId: flags.artifactId,
					version: flags.pomVersion,
				},
			};
		} catch (error: unknown) {
			let errorMessage = 'Unknown error';
			let errorCode: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorCode = 'code' in error ? (error.code as string) : undefined;
			}

			this.error(`Failed to write aggregator POM: ${errorMessage}`, {
				exit: 1,
				code: errorCode || 'POM_WRITE_ERROR',
				suggestions: [
					'Check if you have write permissions in the directory',
					'Ensure the directory is not read-only',
					`Verify the path exists: ${pomPath}`,
				],
			});
		}
	}
}
