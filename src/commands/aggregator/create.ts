import {Args, Command, Flags} from '@oclif/core'
import fs from 'fs-extra'
import * as path from 'path'
import {execa} from 'execa'
import {create} from 'xmlbuilder2'
import chalk from 'chalk'

export default class AggregatorCreate extends Command {
  static override args = {
    directory: Args.string({description: 'Directory containing final Maven repos', required: true}),
  }

  static override description = 'Create Maven aggregator POM from a directory of repositories'

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./maven-repos',
    '<%= config.bin %> <%= command.id %> ./maven-repos --groupId org.example',
    '<%= config.bin %> <%= command.id %> ./maven-repos --artifactId custom-aggregator --pomVersion 2.0.0',
  ]

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
  }

  /**
   * Execute a shell command with error handling
   */
  private async execute(command: string, args: string[] = [], options: any = {}): Promise<any> {
    try {
      return await execa(command, args, options)
    } catch (error: any) {
      this.error(`Command execution failed: ${error.message}`, {exit: 1})
      throw error // Needed for TypeScript even though this line is unreachable
    }
  }

  /**
   * Check if a repository has a valid pom.xml file
   */
  private async validateMavenRepo(repoPath: string): Promise<boolean> {
    const pomPath = path.join(repoPath, 'pom.xml')
    try {
      await fs.access(pomPath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create the aggregator POM XML
   */
  private createAggregatorPom(
    groupId: string,
    artifactId: string,
    version: string,
    modules: string[],
  ): string {
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

    // Add modules
    const modulesEle = pom.ele('modules')
    for (const module of modules) {
      modulesEle.ele('module').txt(module)
    }

    return pom.end({prettyPrint: true})
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AggregatorCreate)
    const directoryPath = path.resolve(args.directory)

    // Ensure directory exists
    try {
      await fs.ensureDir(directoryPath)
    } catch (error: any) {
      this.error(`Failed to access directory: ${error.message}`, {exit: 1})
    }

    this.log(chalk.blue(`🔍 Scanning for Maven repositories in ${directoryPath}...`))

    // Read all subdirectories
    const entries = await fs.readdir(directoryPath)
    const directories: string[] = []
    
    // Check which entries are directories
    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry)
      const stats = await fs.stat(entryPath)
      if (stats.isDirectory()) {
        directories.push(entry)
      }
    }

    if (directories.length === 0) {
      this.error('No subdirectories found. The directory should contain Maven repositories.', {exit: 1})
    }

    // Validate each directory as a Maven repository
    const validModules: string[] = []
    const invalidRepos: string[] = []

    for (const dir of directories) {
      const repoPath = path.join(directoryPath, dir)
      const isValid = await this.validateMavenRepo(repoPath)

      if (isValid) {
        validModules.push(dir)
        this.log(chalk.green(`✅ Found valid Maven repository: ${dir}`))
      } else {
        invalidRepos.push(dir)
        this.log(chalk.yellow(`⚠️ Invalid Maven repository (no pom.xml): ${dir}`))
      }
    }

    if (validModules.length === 0) {
      this.error('No valid Maven repositories found. Each repository must contain a pom.xml file.', {exit: 1})
    }

    // Generate the aggregator POM
    const pomXml = this.createAggregatorPom(
      flags.groupId,
      flags.artifactId,
      flags.pomVersion,
      validModules,
    )

    // Write the aggregator POM
    const pomPath = path.join(directoryPath, 'pom.xml')
    try {
      await fs.writeFile(pomPath, pomXml)
      this.log(chalk.green(`\n✅ Created aggregator POM at ${pomPath}`))
      this.log(chalk.blue(`📋 Included ${validModules.length} modules`))
      
      if (invalidRepos.length > 0) {
        this.log(chalk.yellow(`⚠️ Skipped ${invalidRepos.length} invalid repositories`))
      }
    } catch (error: any) {
      this.error(`Failed to write aggregator POM: ${error.message}`, {exit: 1})
    }
  }
}
