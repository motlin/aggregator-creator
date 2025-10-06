import fs from 'fs-extra';
import {Builder, parseString} from 'xml2js';
import {promisify} from 'node:util';
import path from 'node:path';
import chalk from 'chalk';
import MavenGAVCoords from '../maven-gav.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseXML = promisify<string, any, PomData>(parseString);

export interface XmlDependencyRewriteOptions {
	aggregatorPath: string;
	gavs: MavenGAVCoords[];
	modules: string[];
	verbose?: boolean;
	log?: (message: string) => void;
	fallbackToMaven?: boolean;
}

export interface XmlDependencyRewriteResult {
	success: boolean;
	rewrittenPoms: string[];
	errors: Array<{pom: string; error: string}>;
	mavenFallbacks: string[];
}

interface Dependency {
	groupId?: string | string[];
	artifactId?: string | string[];
	version?: string | string[];
	scope?: string | string[];
	type?: string | string[];
	classifier?: string | string[];
}

interface Parent {
	groupId?: string | string[];
	artifactId?: string | string[];
	version?: string | string[];
	relativePath?: string | string[];
}

interface PomData {
	project?: {
		parent?: Parent | Parent[];
		dependencies?: Array<{
			dependency?: Dependency | Dependency[];
		}>;
		dependencyManagement?: Array<{
			dependencies?: Array<{
				dependency?: Dependency | Dependency[];
			}>;
		}>;
		build?: Array<{
			plugins?: Array<{
				plugin?: Array<{
					dependencies?: Array<{
						dependency?: Dependency | Dependency[];
					}>;
				}>;
			}>;
		}>;
		profiles?: Array<{
			profile?: Array<{
				dependencies?: Array<{
					dependency?: Dependency | Dependency[];
				}>;
			}>;
		}>;
	};
}

export class XmlDependencyRewriter {
	private readonly options: XmlDependencyRewriteOptions;
	private readonly log: (message: string) => void;
	private readonly gavMap: Map<string, string>;

	constructor(options: XmlDependencyRewriteOptions) {
		this.options = options;
		this.log = options.log || (() => {});

		this.gavMap = new Map();
		for (const gav of options.gavs) {
			const key = `${gav.getGroupId()}:${gav.getArtifactId()}`;
			this.gavMap.set(key, gav.getVersion());
		}
	}

	async rewriteDependencies(): Promise<XmlDependencyRewriteResult> {
		const result: XmlDependencyRewriteResult = {
			success: true,
			rewrittenPoms: [],
			errors: [],
			mavenFallbacks: [],
		};

		if (this.options.gavs.length === 0) {
			return result;
		}

		this.log(`│  │`);
		this.log(`│  ├──╮ 🔧 Rewriting child pom dependencies using direct XML editing...`);

		const processPromises = this.options.modules.map(async (module) => {
			const pomPath = path.join(this.options.aggregatorPath, module, 'pom.xml');

			if (!(await fs.pathExists(pomPath))) {
				this.log(`│  │  │ ⚠️ Skipping ${chalk.yellow(module)}: pom.xml not found`);
				return;
			}

			this.log(`│  │  │ Processing ${chalk.yellow(module)}...`);

			try {
				const {updated, fallbackNeeded} = await this.updatePomDependencies(pomPath);

				if (fallbackNeeded) {
					result.mavenFallbacks.push(module);
					this.log(
						`│  │  │ ⚠️ ${chalk.yellow(module)} requires Maven fallback (properties/complex structure)`,
					);
				} else if (updated) {
					result.rewrittenPoms.push(module);
					this.log(`│  │  │ ✅ Updated dependencies in ${chalk.yellow(module)}`);
				} else {
					this.log(`│  │  │ ℹ️ No updates needed for ${chalk.yellow(module)}`);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				result.errors.push({pom: module, error: errorMessage});
				result.success = false;
				this.log(`│  │  │ ❌ Failed to update ${chalk.yellow(module)}: ${errorMessage}`);
			}
		});

		await Promise.all(processPromises);

		this.log(`│  ├──╯`);

		return result;
	}

	private async updatePomDependencies(pomPath: string): Promise<{updated: boolean; fallbackNeeded: boolean}> {
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const pomData = (await parseXML(pomContent, {
			preserveChildrenOrder: true,
			explicitArray: true,
			normalizeTags: false,
			attrkey: '$',
			charkey: '_',
		})) as PomData;

		if (this.options.verbose) {
			this.log(`│  │  │   → Parsed POM structure`);
			if (pomData.project && pomData.project.dependencies?.[0]) {
				this.log(`│  │  │   → Found dependencies section`);
			}
		}

		if (!pomData.project) {
			throw new Error('Invalid POM: no project element found');
		}

		let updated = false;
		const fallbackNeeded = false;

		if (this.options.verbose) {
			this.log(`│  │  │   → Updating parent version...`);
		}
		updated = this.updateParent(pomData) || updated;

		if (this.options.verbose) {
			this.log(`│  │  │   → Checking dependencies...`);
		}
		const projectDeps = pomData.project.dependencies?.[0]?.dependency;
		const depMgmtDeps = pomData.project.dependencyManagement?.[0]?.dependencies?.[0]?.dependency;

		updated = this.updateDependencyList(projectDeps) || updated;
		updated = this.updateDependencyList(depMgmtDeps) || updated;

		if (pomData.project.build?.[0]?.plugins?.[0]?.plugin) {
			for (const plugin of pomData.project.build[0].plugins[0].plugin) {
				const pluginDeps = plugin.dependencies?.[0]?.dependency;
				updated = this.updateDependencyList(pluginDeps) || updated;
			}
		}

		if (pomData.project.profiles?.[0]?.profile) {
			for (const profile of pomData.project.profiles[0].profile) {
				const profileDeps = profile.dependencies?.[0]?.dependency;
				updated = this.updateDependencyList(profileDeps) || updated;
			}
		}

		if (updated) {
			const xmlBuilder = new Builder({
				xmldec: {version: '1.0', encoding: 'utf8'},
				renderOpts: {pretty: true, indent: '    '},
				headless: false,
				attrkey: '$',
				charkey: '_',
			});
			const newXml = xmlBuilder.buildObject(pomData);
			await fs.writeFile(pomPath, newXml);
		}

		return {updated, fallbackNeeded};
	}

	private updateParent(pomData: PomData): boolean {
		const parent = Array.isArray(pomData.project?.parent) ? pomData.project?.parent[0] : pomData.project?.parent;
		if (!parent) return false;

		const groupId = Array.isArray(parent.groupId) ? parent.groupId[0] : parent.groupId;
		const artifactId = Array.isArray(parent.artifactId) ? parent.artifactId[0] : parent.artifactId;
		const currentVersion = Array.isArray(parent.version) ? parent.version[0] : parent.version;

		if (!groupId || !artifactId || !currentVersion) return false;

		const key = `${groupId}:${artifactId}`;
		const newVersion = this.gavMap.get(key);

		if (newVersion && newVersion !== currentVersion) {
			if (Array.isArray(parent.version)) {
				parent.version[0] = newVersion;
			} else {
				parent.version = newVersion;
			}

			if (this.options.verbose) {
				this.log(
					`│  │  │   → Updated parent ${chalk.yellow(groupId)}:${chalk.yellow(artifactId)} from ${chalk.yellow(
						currentVersion,
					)} to ${chalk.yellow(newVersion)}`,
				);
			}
			return true;
		}

		return false;
	}

	private updateDependencyList(dependencies: Dependency | Dependency[] | undefined): boolean {
		if (!dependencies) {
			if (this.options.verbose) {
				this.log(`│  │  │   → No dependencies found in this section`);
			}
			return false;
		}

		let updated = false;
		const deps = Array.isArray(dependencies) ? dependencies : [dependencies];

		if (this.options.verbose) {
			this.log(`│  │  │   → Found ${deps.length} dependencies to check`);
		}

		for (const dep of deps) {
			const groupId = Array.isArray(dep.groupId) ? dep.groupId[0] : dep.groupId;
			const artifactId = Array.isArray(dep.artifactId) ? dep.artifactId[0] : dep.artifactId;
			const currentVersion = Array.isArray(dep.version) ? dep.version[0] : dep.version;

			if (groupId && artifactId && currentVersion) {
				const key = `${groupId}:${artifactId}`;
				const newVersion = this.gavMap.get(key);

				if (this.options.verbose) {
					this.log(
						`│  │  │   → Checking ${chalk.yellow(key)}: current=${chalk.yellow(
							currentVersion,
						)}, new=${chalk.yellow(newVersion || 'not found')}`,
					);
				}

				if (newVersion && newVersion !== currentVersion) {
					if (Array.isArray(dep.version)) {
						dep.version[0] = newVersion;
					} else {
						dep.version = newVersion;
					}
					updated = true;

					if (this.options.verbose) {
						this.log(
							`│  │  │   → Updated ${chalk.yellow(groupId)}:${chalk.yellow(artifactId)} from ${chalk.yellow(
								currentVersion,
							)} to ${chalk.yellow(newVersion)}`,
						);
					}
				}
			}
		}

		return updated;
	}
}
