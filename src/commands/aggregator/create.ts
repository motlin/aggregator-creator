import {Args, Command, Flags} from '@oclif/core'
import fs from 'fs-extra'
import path from 'node:path'
import {execa, type Options, type Result} from 'execa'
import {create} from 'xmlbuilder2'
import chalk from 'chalk'
import inquirer from 'inquirer'

export default class AggregatorCreate extends Command {
  static override args = {
    directory: Args.string({description: 'Directory containing final Maven repos', required: true}),
  }

  static override description = 'Create Maven aggregator POM from a directory of repositories'

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./maven-repos',
    '<%= config.bin %> <%= command.id %> ./maven-repos --groupId org.example',
    '<%= config.bin %> <%= command.id %> ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0',
    '<%= config.bin %> <%= command.id %> ./maven-repos --force',
    '<%= config.bin %> <%= command.id %> ./maven-repos --json',
  ]

  static override enableJsonFlag = true

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
  }

  private async execute(command: string, args: string[] = [], options: Options = {}): Promise<Result> {
    try {
      return await execa(command, args, options)
    } catch (error: unknown) {
      this.error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`, {exit: 1})
      throw error
    }
  }

  private async validateMavenRepo(repoPath: string): Promise<boolean> {
    const pomPath = path.join(repoPath, 'pom.xml')
    try {
      await fs.access(pomPath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  private createAggregatorPom(groupId: string, artifactId: string, version: string, modules: string[]): string {
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

    const modulesEle = pom.ele('modules')
    for (const module of modules) {
      modulesEle.ele('module').txt(module)
    }

    return pom.end({prettyPrint: true})
  }

  public async run(): Promise<{
    success: boolean
    pomPath: string
    modules: {
      path: string
      valid: boolean
      reason?: string
    }[]
    stats: {
      totalScanned: number
      validRepositories: number
      skippedRepositories: number
      elapsedTimeMs: number
    }
    mavenCoordinates: {
      groupId: string
      artifactId: string
      version: string
    }
  }> {
    const startTime = Date.now()
    const {args, flags} = await this.parse(AggregatorCreate)
    const directoryPath = path.resolve(args.directory)

    // Ensure directory exists
    try {
      await fs.ensureDir(directoryPath)
    } catch (error: unknown) {
      this.error(`Failed to access directory: ${error instanceof Error ? error.message : String(error)}`, {exit: 1})
    }

    this.log(`╭─── 📄 Creating aggregator POM...`)
    this.log(`│`)
    this.log(`├──╮ 🔍 Scanning for Maven repositories in ${chalk.yellow(directoryPath)}...`)

    // Find all potential Maven repositories (considering possible nesting like owner/repo structure)
    const mavenRepos: {path: string; relativePath: string}[] = []
    const skippedRepos: {path: string; relativePath: string; reason: string}[] = []
    let totalScanned = 0

    const entries = await fs.readdir(directoryPath)

    const firstLevelEntries = []
    for (const entry of entries) {
      if (entry === 'pom.xml') continue

      const entryPath = path.join(directoryPath, entry)
      const stats = await fs.stat(entryPath)

      if (stats.isDirectory()) {
        firstLevelEntries.push(entry)
      }
    }

    this.log(`│  │ Found ${chalk.yellow(firstLevelEntries.length)} potential repository containers to scan`)

    if (firstLevelEntries.length === 0) {
      const elapsedTimeMs = Date.now() - startTime

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
      }

      if (!this.jsonEnabled()) {
        this.error(result.error, {exit: 1})
      }

      return result
    }

    for (const entry of firstLevelEntries) {
      this.log(`│  │ ${chalk.dim(`⏳ Examining: ${entry}`)}`)

      const entryPath = path.join(directoryPath, entry)
      const stats = await fs.stat(entryPath)

      // TODO: Replace with assertion since this should always be a directory (filtered earlier)
      if (!stats.isDirectory()) {
        continue
      }

      totalScanned++

      const hasPom = await this.validateMavenRepo(entryPath)
      if (hasPom) {
        mavenRepos.push({
          path: entryPath,
          relativePath: entry,
        })
        continue
      }

      try {
        const subEntries = await fs.readdir(entryPath)
        for (const subEntry of subEntries) {
          const subEntryPath = path.join(entryPath, subEntry)
          const subStats = await fs.stat(subEntryPath)

          if (!subStats.isDirectory()) continue

          totalScanned++
          const hasSubPom = await this.validateMavenRepo(subEntryPath)
          if (hasSubPom) {
            mavenRepos.push({
              path: subEntryPath,
              relativePath: path.join(entry, subEntry),
            })
          } else {
            skippedRepos.push({
              path: subEntryPath,
              relativePath: path.join(entry, subEntry),
              reason: 'Missing pom.xml',
            })
          }
        }
      } catch (error) {
        skippedRepos.push({
          path: entryPath,
          relativePath: entry,
          reason: `Error reading directory: ${(error as Error).message}`,
        })
      }
    }

    if (mavenRepos.length === 0) {
      const elapsedTimeMs = Date.now() - startTime

      // Prepare the result object for both JSON and non-JSON cases
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
      }

      if (!this.jsonEnabled()) {
        this.error(result.error, {exit: 1})
      }

      return result
    }

    const validModules = mavenRepos.map((repo) => repo.relativePath)

    for (const repo of mavenRepos) {
      this.log(`│  │ ${chalk.green(`✅ Found valid Maven repository: ${repo.relativePath}`)}`)
    }

    this.log(`│  │`)
    this.log(`│  ├──╮ 📊 Repository scan summary:`)
    this.log(`│  │  │ ${chalk.green(`✅ Found ${mavenRepos.length} valid Maven repositories`)}`)
    if (skippedRepos.length > 0) {
      this.log(`│  │  │ ${chalk.yellow(`⚠️ Skipped ${skippedRepos.length} repositories`)}`)
      for (const repo of skippedRepos) {
        if (repo.reason === 'Missing pom.xml') {
          this.log(`│  │  │ ${chalk.yellow(`  → ${repo.relativePath}: Missing pom.xml file`)}`)
        }
      }
    }
    this.log(`│  ├──╯`)

    // Ask for confirmation unless yes flag is used
    const {yes} = flags
    let proceed = yes

    if (!proceed) {
      this.log(`│  │`)
      this.log(`│  ├──╮ 📋 Ready to create aggregator POM with the following settings:`)
      this.log(`│  │  │ - groupId: ${chalk.yellow(flags.groupId)}`)
      this.log(`│  │  │ - artifactId: ${chalk.yellow(flags.artifactId)}`)
      this.log(`│  │  │ - version: ${chalk.yellow(flags.pomVersion)}`)
      this.log(`│  │  │ - modules: ${chalk.yellow(validModules.length)} Maven repositories`)

      const {confirmed} = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Do you want to create the aggregator POM?',
          default: false,
        },
      ])
      proceed = confirmed
    }

    if (!proceed) {
      this.log(`│  │  │ ${chalk.yellow('Operation canceled by user.')}`)
      this.log(`│  ├──╯`)
      const elapsedTimeMs = Date.now() - startTime

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
      }
    }

    const pomXml = this.createAggregatorPom(flags.groupId, flags.artifactId, flags.pomVersion, validModules)

    const pomPath = path.join(directoryPath, 'pom.xml')
    try {
      await fs.writeFile(pomPath, pomXml)
      this.log(`│  │`)
      this.log(`│  ├──╮ ${chalk.green(`✅ Created aggregator POM at ${pomPath}`)}`)
      this.log(`│  │  │ 📋 Included ${chalk.yellow(validModules.length)} modules`)

      const elapsedTimeMs = Date.now() - startTime
      this.log(`│  │  │ ${chalk.dim(`⏱️ Operation completed in ${elapsedTimeMs}ms`)}`)
      this.log(`│  ├──╯`)

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
      }
    } catch (error: unknown) {
      this.error(`Failed to write aggregator POM: ${error instanceof Error ? error.message : String(error)}`, {exit: 1})
    }
  }
}
