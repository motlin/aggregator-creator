import os from 'node:os';
import path from 'node:path';
import {Args, Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as _execa} from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import {create} from 'xmlbuilder2';
import MavenGAVCoords from '../../maven-gav.js';
import {validatedRepositoriesSchema, type ValidatedRepository} from '../../types/repository.js';
import {DependencyRewriter} from '../../utils/dependency-rewriter.js';
import {parsePomForGAV, parsePomForModules, parsePomForPackaging} from '../../utils/pom-parser.js';
import {XmlDependencyRewriter} from '../../utils/xml-dependency-rewriter.js';

export default class AggregatorCreate extends Command {
	private _verbose = false;

	private verboseLog(message: string): void {
		if (this._verbose) {
			this.log(message);
		}
	}

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
		'<%= config.bin %> <%= command.id %> ./maven-repos --no-rewrite-dependencies',
		'<%= config.bin %> repo:list --owner someuser --json | <%= config.bin %> <%= command.id %> ./output-dir',
		'<%= config.bin %> <%= command.id %> ./maven-repos --verbose',
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
		rewriteDependencies: Flags.boolean({
			description: 'Rewrite child pom dependencies to use versions from dependencyManagement',
			default: true,
			allowNo: true,
		}),
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during aggregator creation',
			default: false,
		}),
	};

	private async execute(
		command: string,
		args: string[] = [],
		execaFn = _execa,
	): Promise<Awaited<ReturnType<typeof _execa>>> {
		return execaFn(command, args, {timeout: 8000});
	}

	private async validateMavenRepo(repoPath: string): Promise<boolean> {
		const pomPath = path.join(repoPath, 'pom.xml');
		try {
			await fs.access(pomPath, fs.constants.R_OK);
			const parseResult = await parsePomForGAV(pomPath);
			if (parseResult.reason?.includes('XML parsing failed')) {
				return false;
			}
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

	private async isParentPom(
		repositoryBaseDir: string,
		pomFileRelativePath: string,
		execaFn = _execa,
	): Promise<boolean> {
		const pomFullPath = path.join(repositoryBaseDir, pomFileRelativePath);
		try {
			const modules = await this.getMavenProjectAttribute(pomFullPath, 'project.modules', execaFn);
			if (modules.length > 0 && modules !== '<modules/>') {
				this.verboseLog(`│  │  │ ${chalk.yellow(pomFileRelativePath)} is a parent POM`);
				return true;
			}

			this.verboseLog(`│  │  │ ${chalk.yellow(pomFileRelativePath)} is not a parent POM`);
			return false;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (
				errorMessage.includes('Non-resolvable parent POM')
				|| errorMessage.includes('parent.relativePath')
				|| errorMessage.includes('Could not find artifact')
			) {
				this.verboseLog(
					`│  │  │ ${chalk.yellow(pomFileRelativePath)} has parent POM resolution issues, treating as non-parent POM`,
				);
				return false;
			}

			this.verboseLog(
				`│  │  │ Failed to determine if ${chalk.yellow(pomFileRelativePath)} is a parent POM: ${errorMessage}`,
			);
			return false;
		}
	}

	private async processPomsForJarModules(
		repositoryBaseDir: string,
		pomRelativePaths: string[],
		execaFn = _execa,
		parallel = true,
	) {
		this.verboseLog(
			`│  │ Processing all found POM files for jar/bundle modules to add to the dependencyManagement section...`,
		);

		const processGAV = async (pomRelativePath: string) => {
			this.verboseLog(`│  ├──╮ Processing ${chalk.yellow(pomRelativePath)}`);
			try {
				const pomFullPath = path.join(repositoryBaseDir, pomRelativePath);
				const packaging = await this.getPackagingType(pomFullPath, execaFn);

				if (packaging === 'jar' || packaging === 'bundle') {
					this.verboseLog(`│  │  │ Has ${chalk.yellow(packaging)} packaging`);
					const result = await this.getGAVFromPom(repositoryBaseDir, pomRelativePath, execaFn);
					this.verboseLog(`│  ├──╯`);
					return result;
				}
				this.verboseLog(`│  │  │ Skipping ${chalk.yellow(packaging)} packaging`);
				this.verboseLog(`│  ├──╯`);
			} catch {
				this.verboseLog(`│  │  │ Could not determine packaging type, skipping`);
				this.verboseLog(`│  ├──╯`);
			}
			return null;
		};

		let gavResults: (MavenGAVCoords | null)[];

		if (parallel) {
			const gavPromises = pomRelativePaths.map((pomRelativePath) => processGAV(pomRelativePath));
			gavResults = await Promise.all(gavPromises);
		} else {
			gavResults = [];
			for (const pomRelativePath of pomRelativePaths) {
				const result = await processGAV(pomRelativePath);
				gavResults.push(result);
			}
		}

		const allGAVs = gavResults.filter((gav): gav is MavenGAVCoords => gav !== null);

		this.verboseLog(`│  │ `);
		this.verboseLog(`│  ├──╮ Adding to the dependencyManagement section of the aggregator...`);

		if (allGAVs.length > 0) {
			for (const gav of allGAVs) {
				this.verboseLog(
					`│  │  │ Adding group: ${chalk.yellow(gav.getGroupId())}, artifact: ${chalk.yellow(gav.getArtifactId())}, and version: ${chalk.yellow(gav.getVersion())}`,
				);
			}
		} else {
			this.verboseLog(`│  │  │ No GAVs found to add to the dependencyManagement section of the aggregator...`);
		}

		this.verboseLog(`│  ├──╯`);

		return allGAVs;
	}

	private async processAllReactorModules(
		aggregatorBaseDir: string,
		mavenRepos: {path: string; relativePath: string}[],
		execaFn = _execa,
		parallel = true,
	): Promise<MavenGAVCoords[]> {
		this.verboseLog(`│  │ Processing all reactor modules to add to the dependencyManagement section...`);

		const processRepoModules = async (repo: {path: string; relativePath: string}) => {
			this.verboseLog(`│  ├──╮ Processing repository ${chalk.yellow(repo.relativePath)}`);

			let pomPaths: string[] = [];

			const rootPomPath = path.join(repo.path, 'pom.xml');
			if (await fs.pathExists(rootPomPath)) {
				try {
					pomPaths = await this.findPomFiles(repo.path, execaFn);
				} catch {
					pomPaths = ['pom.xml'];
				}
			}

			const gavs: MavenGAVCoords[] = [];

			const BATCH_SIZE = 10;
			for (let i = 0; i < pomPaths.length; i += BATCH_SIZE) {
				const batch = pomPaths.slice(i, i + BATCH_SIZE);

				const batchResults = await Promise.all(
					batch.map(async (pomRelativePath) => {
						try {
							const result = await this.getGAVFromPom(repo.path, pomRelativePath, execaFn);
							if (result) {
								this.verboseLog(`│  │  │ Added ${chalk.yellow(result.getArtifactId())}`);
								return result;
							}
						} catch {
							this.verboseLog(`│  │  │ Could not process ${chalk.yellow(pomRelativePath)}`);
						}
						return null;
					}),
				);

				gavs.push(...batchResults.filter((r): r is MavenGAVCoords => r !== null));
			}

			this.verboseLog(`│  ├──╯`);
			return gavs;
		};

		let allGAVs: MavenGAVCoords[] = [];

		if (parallel) {
			const results = await Promise.all(mavenRepos.map((repo) => processRepoModules(repo)));
			allGAVs = results.flat();
		} else {
			for (const repo of mavenRepos) {
				const gavs = await processRepoModules(repo);
				allGAVs.push(...gavs);
			}
		}

		this.verboseLog(`│  │ `);
		this.verboseLog(`│  ├──╮ Summary of modules for dependencyManagement:`);

		if (allGAVs.length > 0) {
			const gavMap = new Map<string, MavenGAVCoords>();
			for (const gav of allGAVs) {
				const key = `${gav.getGroupId()}:${gav.getArtifactId()}:${gav.getVersion()}`;
				gavMap.set(key, gav);
			}

			allGAVs = [...gavMap.values()];

			for (const gav of allGAVs) {
				this.verboseLog(
					`│  │  │ ${chalk.yellow(gav.getGroupId())}:${chalk.yellow(gav.getArtifactId())}:${chalk.yellow(gav.getVersion())}`,
				);
			}
		} else {
			this.verboseLog(`│  │  │ No modules found to add to dependencyManagement`);
		}

		this.verboseLog(`│  ├──╯`);

		return allGAVs;
	}

	private async getModulesFromPom(pomFullPath: string, execaFn = _execa): Promise<string[]> {
		const parseResult = await parsePomForModules(pomFullPath);
		if (parseResult.success) {
			return parseResult.modules;
		}

		try {
			const modulesString = await this.getMavenProjectAttribute(pomFullPath, 'project.modules', execaFn);
			if (!modulesString || modulesString === '<modules/>' || modulesString.trim() === '') {
				return [];
			}

			const moduleMatches = modulesString.match(/<string>(.*?)<\/string>/g);
			if (!moduleMatches) {
				return modulesString
					.split(',')
					.map((m) => m.trim())
					.filter((m) => m.length > 0);
			}

			return moduleMatches.map((match) => match.replaceAll(/<\/?string>/g, ''));
		} catch {
			return [];
		}
	}

	private async getPackagingType(pomFullPath: string, execaFn = _execa): Promise<string> {
		const packaging = await parsePomForPackaging(pomFullPath);
		if (packaging !== 'jar' || !execaFn) {
			return packaging;
		}

		// For 'jar' results, double-check with Maven in case it's inherited
		try {
			const mavenPackaging = await this.getMavenProjectAttribute(pomFullPath, 'project.packaging', execaFn);
			return mavenPackaging || 'jar';
		} catch {
			return packaging;
		}
	}

	private async findPomFiles(repositoryBaseDir: string, execaFn = _execa): Promise<string[]> {
		try {
			await fs.ensureDir(path.dirname(repositoryBaseDir));
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
					`Try: mkdir -p "${repositoryBaseDir}"`,
				],
			});
		}

		const allPoms = new Set<string>();
		const pomsToProcess: Array<{pomPath: string; relativePath: string}> = [];

		const rootPomPath = path.join(repositoryBaseDir, 'pom.xml');
		if (await fs.pathExists(rootPomPath)) {
			allPoms.add('pom.xml');
			pomsToProcess.push({pomPath: rootPomPath, relativePath: ''});
		} else {
			return [];
		}

		this.verboseLog(`│  │ Following module declarations from root POM...`);

		while (pomsToProcess.length > 0) {
			const batch = pomsToProcess.splice(0, 10);

			const batchResults = await Promise.all(
				batch.map(async ({pomPath, relativePath}) => {
					const modules = await this.getModulesFromPom(pomPath, execaFn);
					const newPoms: Array<{pomPath: string; relativePath: string}> = [];

					if (modules.length > 0) {
						this.verboseLog(
							`│  │  │ Found ${chalk.yellow(modules.length)} modules in ${chalk.yellow(relativePath || 'root')} POM`,
						);

						const moduleChecks = await Promise.all(
							modules.map(async (module) => {
								const modulePomRelativePath = path.join(relativePath, module, 'pom.xml');
								const modulePomFullPath = path.join(repositoryBaseDir, modulePomRelativePath);

								if (await fs.pathExists(modulePomFullPath)) {
									return {
										exists: true,
										relativePath: modulePomRelativePath,
										fullPath: modulePomFullPath,
										parentPath: path.join(relativePath, module),
									};
								}

								this.verboseLog(
									`│  │  │ Module ${chalk.yellow(module)} declared but POM not found at ${chalk.yellow(modulePomRelativePath)}`,
								);
								return {exists: false};
							}),
						);

						for (const check of moduleChecks) {
							if (check.exists) {
								allPoms.add(check.relativePath!);
								newPoms.push({
									pomPath: check.fullPath!,
									relativePath: check.parentPath!,
								});
							}
						}
					}

					return newPoms;
				}),
			);

			for (const newPoms of batchResults) {
				pomsToProcess.push(...newPoms);
			}
		}

		const result = [...allPoms];
		this.verboseLog(`│  │  │ Total POMs found: ${chalk.yellow(result.length)}`);
		return result;
	}

	private async fetchLatestLiftwizardVersion(execaFn = _execa): Promise<string> {
		this.verboseLog(`│  │ Fetching latest liftwizard-profile-parent version using Maven...`);

		try {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liftwizard-version-'));

			try {
				const result = await this.execute(
					'mvn',
					[
						'org.apache.maven.plugins:maven-dependency:3.6.0:get',
						'-Dartifact=io.liftwizard:liftwizard-profile-parent:LATEST',
						'-DremoteRepositories=https://repo.maven.apache.org/maven2',
						'-Dtransitive=false',
						'--quiet',
					],
					execaFn,
				);

				const stdout = typeof result.stdout === 'string' ? result.stdout : '';
				const versionMatch = stdout.match(/Downloaded.*liftwizard-profile-parent-(\d+\.\d+\.\d+(?:-\w+)?)/);

				if (!versionMatch) {
					const localRepoPath = path.join(
						os.homedir(),
						'.m2',
						'repository',
						'io',
						'liftwizard',
						'liftwizard-profile-parent',
					);

					if (await fs.pathExists(localRepoPath)) {
						const versions = await fs.readdir(localRepoPath);
						const validVersions = versions
							.filter((v) => /^\d+\.\d+\.\d+(?:-\w+)?$/.test(v))
							.sort((a, b) => {
								const aParts = a.split(/[.-]/);
								const bParts = b.split(/[.-]/);

								for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
									const aPart = Number.parseInt(aParts[i], 10) || 0;
									const bPart = Number.parseInt(bParts[i], 10) || 0;
									if (aPart !== bPart) return bPart - aPart;
								}
								return 0;
							});

						if (validVersions.length > 0) {
							const latestVersion = validVersions[0];
							this.verboseLog(`│  │ Found latest liftwizard version: ${chalk.yellow(latestVersion)}`);
							return latestVersion;
						}
					}

					throw new Error('Could not determine version from Maven output');
				}

				const latestVersion = versionMatch[1];
				this.verboseLog(`│  │ Found latest liftwizard version: ${chalk.yellow(latestVersion)}`);
				return latestVersion;
			} finally {
				await fs.remove(tempDir);
			}
		} catch (error) {
			const fallbackVersion = '2.1.13';
			this.verboseLog(`│  │ Could not fetch latest version, using fallback: ${chalk.yellow(fallbackVersion)}`);
			this.debug(`Maven error: ${error instanceof Error ? error.message : String(error)}`);
			return fallbackVersion;
		}
	}

	private async getGAVFromPom(
		repositoryBaseDir: string,
		pomFileRelativePath: string,
		execaFn = _execa,
	): Promise<MavenGAVCoords | null> {
		const pomFullPath = path.join(repositoryBaseDir, pomFileRelativePath);
		try {
			const parseResult = await parsePomForGAV(pomFullPath);

			if (!parseResult.needsMavenFallback) {
				this.verboseLog(`│  │  │ Fast XML parsing`);
				return new MavenGAVCoords(
					parseResult.gav.groupId!,
					parseResult.gav.artifactId!,
					parseResult.gav.version!,
				);
			}

			this.verboseLog(`│  │  │ Maven fallback for ${chalk.yellow(pomFileRelativePath)}: ${parseResult.reason}`);

			const groupId = await this.getMavenProjectAttribute(pomFullPath, 'project.groupId', execaFn);
			const artifactId = await this.getMavenProjectAttribute(pomFullPath, 'project.artifactId', execaFn);
			const version = await this.getMavenProjectAttribute(pomFullPath, 'project.version', execaFn);

			return new MavenGAVCoords(groupId, artifactId, version);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (
				errorMessage.includes('Non-resolvable parent POM')
				|| errorMessage.includes('parent.relativePath')
				|| errorMessage.includes('Could not find artifact')
			) {
				this.verboseLog(
					`│  │  │ Could not process ${chalk.yellow(pomFileRelativePath)} due to parent POM resolution issues: ${errorMessage}`,
				);
			} else {
				this.verboseLog(
					`│  │  │ Failed to collect GAV from ${chalk.yellow(pomFileRelativePath)}: ${errorMessage}`,
				);
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
		liftwizardVersion: string,
	): string {
		// biome-ignore format: preserve method chaining
		const pom = create({version: '1.0'})
			.ele('project', {
				'xmlns': 'http://maven.apache.org/POM/4.0.0',
				'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
				'xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
			})
			.ele('modelVersion').txt('4.0.0').up()
			.ele('parent')
				.ele('groupId').txt('io.liftwizard').up()
				.ele('artifactId').txt('liftwizard-profile-parent').up()
				.ele('version').txt(liftwizardVersion).up()
			.up()
			.ele('groupId').txt(groupId).up()
			.ele('artifactId').txt(artifactId).up()
			.ele('version').txt(version).up()
			.ele('packaging').txt('pom').up()
			.ele('name').txt(`${artifactId} Aggregator POM`).up()
			.ele('description').txt('Aggregator POM for multiple Maven repositories').up();

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

		pom.ele('build').ele('defaultGoal').txt('verify').up();

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
		};
		mavenCoordinates: {
			groupId: string;
			artifactId: string;
			version: string;
		};
	}> {
		const execa = _execa;

		const {args, flags} = await this.parse(AggregatorCreate);
		this._verbose = flags.verbose;
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
						'Pipe JSON data from repo:list or repo:process command',
						'Example: aggregator repo:list --owner someuser --json | aggregator aggregator:create ./output',
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
							'The input should be from repo:list --json or repo:process --json',
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
						'The input should match the output from repo:list --json or repo:process --json',
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
					'Pipe JSON data from repo:list or repo:process command',
					'Example: aggregator repo:list --owner someuser --json | aggregator aggregator:create ./output',
				],
			});
		}

		this.verboseLog(`╭─── Creating aggregator POM...`);
		this.verboseLog(`│`);

		const mavenRepos: {path: string; relativePath: string}[] = [];
		const skippedRepos: {path: string; relativePath: string; reason: string}[] = [];
		let totalScanned = 0;

		if (validRepos.length > 0) {
			this.verboseLog(`├──╮ Using ${chalk.yellow(validRepos.length)} validated repositories from input...`);

			for (const repo of validRepos) {
				const relativePath = path.join(repo.owner.login, repo.name);
				mavenRepos.push({
					path: repo.path,
					relativePath,
				});
			}
			totalScanned = validRepos.length;
		} else {
			this.verboseLog(`├──╮ Scanning for Maven repositories in ${chalk.yellow(directoryPath)}...`);

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

			this.verboseLog(
				`│  │ Found ${chalk.yellow(firstLevelEntries.length)} potential repository containers to scan`,
			);

			if (firstLevelEntries.length === 0) {
				const result = {
					success: false,
					pomPath: '',
					modules: [],
					stats: {
						totalScanned: 0,
						validRepositories: 0,
						skippedRepositories: 0,
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
				this.verboseLog(`│  │ Examining: ${chalk.yellow(entry)}`);

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
			const result = {
				success: false,
				pomPath: '',
				modules: [],
				stats: {
					totalScanned,
					validRepositories: 0,
					skippedRepositories: skippedRepos.length,
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
			this.verboseLog(`│  │ Found valid Maven repository: ${chalk.yellow(repo.relativePath)}`);
		}
		const allGAVs = await this.processAllReactorModules(directoryPath, mavenRepos, execa, flags.parallel);
		this.verboseLog(`│  │`);
		this.verboseLog(`│  ├──╮ Repository scan summary:`);
		this.verboseLog(`│  │  │ Found ${chalk.yellow(mavenRepos.length)} valid Maven repositories`);
		this.verboseLog(
			`│  │  │ Found ${chalk.yellow(allGAVs.length)} GAVs to add to the dependencyManagement section of the POM`,
		);
		if (skippedRepos.length > 0) {
			this.verboseLog(`│  │  │ Skipped ${chalk.yellow(skippedRepos.length)} repositories`);
			for (const repo of skippedRepos) {
				if (repo.reason === 'Missing pom.xml') {
					this.verboseLog(`│  │  │   ${chalk.yellow(repo.relativePath)}: Missing pom.xml file`);
				}
			}
		}
		this.verboseLog(`│  ├──╯`);

		this.verboseLog(`│  │`);
		const liftwizardVersion = await this.fetchLatestLiftwizardVersion();

		const {yes} = flags;
		let proceed = yes;

		if (!proceed) {
			this.verboseLog(`│  │`);
			this.verboseLog(`│  ├──╮ Ready to create aggregator POM with the following settings:`);
			this.verboseLog(`│  │  │ - groupId: ${chalk.yellow(flags.groupId)}`);
			this.verboseLog(`│  │  │ - artifactId: ${chalk.yellow(flags.artifactId)}`);
			this.verboseLog(`│  │  │ - version: ${chalk.yellow(flags.pomVersion)}`);
			this.verboseLog(
				`│  │  │ - parent: ${chalk.yellow(`io.liftwizard:liftwizard-profile-parent:${liftwizardVersion}`)}`,
			);
			this.verboseLog(`│  │  │ - modules: ${chalk.yellow(validModules.length)} Maven repositories`);

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
			liftwizardVersion,
		);

		const pomPath = path.join(directoryPath, 'pom.xml');
		try {
			await fs.writeFile(pomPath, pomXml);

			const mvnDir = path.join(directoryPath, '.mvn');
			await fs.ensureDir(mvnDir);

			const jvmConfigPath = path.join(mvnDir, 'jvm.config');
			await fs.writeFile(jvmConfigPath, '-Xmx8g\n');

			const mavenConfigPath = path.join(mvnDir, 'maven.config');
			const mavenConfig =
				['--errors', '--no-transfer-progress', '--fail-fast', '--color=always', '--threads=2C'].join('\n')
				+ '\n';
			await fs.writeFile(mavenConfigPath, mavenConfig);

			if (this._verbose) {
				this.log(`│  │`);
				this.log(`│  ├──╮ Created aggregator POM at ${chalk.yellow(pomPath)}`);
				this.log(`│  │  │ Included ${chalk.yellow(validModules.length)} modules`);
				this.log(`│  │  │ Created .mvn directory with Maven configuration`);
				this.log(`│  ├──╯`);
			} else {
				this.log(`Created aggregator POM: ${pomPath} (${validModules.length} modules)`);
			}

			if (flags.rewriteDependencies && allGAVs.length > 0) {
				const xmlRewriter = new XmlDependencyRewriter({
					aggregatorPath: directoryPath,
					gavs: allGAVs,
					modules: validModules,
					verbose: this._verbose,
					log: (message: string) => this.verboseLog(message),
				});

				const xmlResult = await xmlRewriter.rewriteDependencies();

				if (xmlResult.mavenFallbacks.length > 0) {
					this.verboseLog(`│  │`);
					this.verboseLog(`│  ├──╮ Using Maven for complex dependency updates...`);

					const mavenRewriter = new DependencyRewriter(
						{
							aggregatorPath: directoryPath,
							gavs: allGAVs,
							modules: xmlResult.mavenFallbacks,
							verbose: false,
							log: (message: string) => this.verboseLog(message),
						},
						execa,
					);

					const mavenResult = await mavenRewriter.rewriteDependencies();

					xmlResult.rewrittenPoms.push(...mavenResult.rewrittenPoms);
					xmlResult.errors.push(...mavenResult.errors);

					this.verboseLog(`│  ├──╯`);
				}

				if (xmlResult.rewrittenPoms.length > 0 || xmlResult.errors.length > 0) {
					this.verboseLog(`│  │`);
					this.verboseLog(`│  ├──╮ Dependency rewriting summary:`);
					if (xmlResult.rewrittenPoms.length > 0) {
						this.verboseLog(`│  │  │ Updated ${chalk.yellow(xmlResult.rewrittenPoms.length)} pom files`);
					}
					if (xmlResult.mavenFallbacks.length > 0) {
						this.verboseLog(
							`│  │  │ Used Maven for ${chalk.yellow(xmlResult.mavenFallbacks.length)} complex pom files`,
						);
					}
					if (xmlResult.errors.length > 0) {
						this.verboseLog(`│  │  │ Failed to update ${chalk.yellow(xmlResult.errors.length)} pom files`);
						for (const error of xmlResult.errors) {
							this.verboseLog(`│  │  │   ${chalk.yellow(error.pom)}: ${error.error}`);
						}
					}
					this.verboseLog(`│  ├──╯`);
				}

				if (!this._verbose && xmlResult.rewrittenPoms.length > 0) {
					this.log(`Rewrote dependencies in ${xmlResult.rewrittenPoms.length} pom files.`);
				}
			}

			this.verboseLog(`│`);
			this.verboseLog(`╰─── Successfully created aggregator POM at: ${chalk.yellow(pomPath)}`);

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
