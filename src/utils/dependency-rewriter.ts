import {execa as _execa} from "execa";
import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import MavenGAVCoords from "../maven-gav.js";

export interface DependencyRewriteOptions {
	aggregatorPath: string;
	gavs: MavenGAVCoords[];
	modules: string[];
	verbose?: boolean;
	log?: (message: string) => void;
}

export interface DependencyRewriteResult {
	success: boolean;
	rewrittenPoms: string[];
	errors: Array<{pom: string; error: string}>;
}

function describeMavenError(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}
	if ("stderr" in error && typeof error.stderr === "string" && error.stderr !== "") {
		return error.stderr;
	}
	return error.message;
}

export class DependencyRewriter {
	private readonly options: DependencyRewriteOptions;
	private readonly execa: typeof _execa;
	private readonly log: (message: string) => void;

	constructor(options: DependencyRewriteOptions, execa = _execa) {
		this.options = options;
		this.execa = execa;
		this.log = options.log ?? (() => {});
	}

	async rewriteDependencies(): Promise<DependencyRewriteResult> {
		const result: DependencyRewriteResult = {
			success: true,
			rewrittenPoms: [],
			errors: [],
		};

		if (this.options.gavs.length === 0) {
			return result;
		}

		this.log(`│  │`);
		this.log(`│  ├──╮ 🔧 Rewriting child pom dependencies to use versions from dependencyManagement...`);

		for (const module of this.options.modules) {
			const pomPath = path.join(this.options.aggregatorPath, module, "pom.xml");

			// oxlint-disable-next-line no-await-in-loop -- modules are processed one at a time so their log lines stay grouped
			if (!(await fs.pathExists(pomPath))) {
				this.log(`│  │  │ ⚠️ Skipping ${chalk.yellow(module)}: pom.xml not found`);
				continue;
			}

			this.log(`│  │  │ Processing ${chalk.yellow(module)}...`);

			try {
				// oxlint-disable-next-line no-await-in-loop -- concurrent mvn runs would interleave output and contend for the local repository
				const gavUpdated = await this.updateDependencyVersions(module);
				if (gavUpdated) {
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
		}

		this.log(`│  ├──╯`);

		return result;
	}

	private async updateDependencyVersions(module: string): Promise<boolean> {
		const modulePath = path.join(this.options.aggregatorPath, module);
		let hasUpdates = false;

		for (const gav of this.options.gavs) {
			try {
				// oxlint-disable-next-line no-await-in-loop -- each mvn run rewrites the same pom.xml, so they must not overlap
				const result = await this.execa(
					"mvn",
					[
						"-f",
						modulePath,
						"versions:use-dep-version",
						`-Dincludes=${gav.getGroupId()}:${gav.getArtifactId()}`,
						`-DdepVersion=${gav.getVersion()}`,
						"-DgenerateBackupPoms=false",
						"--quiet",
					],
					{
						cwd: this.options.aggregatorPath,
					},
				);

				if (result.exitCode === 0) {
					hasUpdates = true;
					if (this.options.verbose) {
						this.log(
							`│  │  │   → Updated ${chalk.yellow(gav.getGroupId())}:${chalk.yellow(gav.getArtifactId())} to ${chalk.yellow(gav.getVersion())}`,
						);
					}
				}
			} catch (error) {
				if (this.options.verbose) {
					const errorMessage = describeMavenError(error);
					if (!errorMessage.includes("No matching dependencies found")) {
						this.log(
							`│  │  │   ⚠️ Could not update ${chalk.yellow(gav.getGroupId())}:${chalk.yellow(gav.getArtifactId())}: ${errorMessage}`,
						);
					}
				}
			}
		}

		return hasUpdates;
	}

	async cleanupBackupPoms(): Promise<void> {
		this.log(`│  │ 🧹 Cleaning up backup pom files...`);

		for (const module of this.options.modules) {
			const backupPomPath = path.join(this.options.aggregatorPath, module, "pom.xml.versionsBackup");

			// oxlint-disable-next-line no-await-in-loop -- modules are cleaned one at a time so verbose log lines follow module order
			if (await fs.pathExists(backupPomPath)) {
				// oxlint-disable-next-line no-await-in-loop -- see above
				await fs.remove(backupPomPath);
				if (this.options.verbose) {
					this.log(`│  │   → Removed ${chalk.yellow(path.join(module, "pom.xml.versionsBackup"))}`);
				}
			}
		}
	}
}
