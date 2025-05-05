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
  }

  /**
   * Execute a shell command with error handling
   */
  private async execute(command: string, args: string[] = [], options: any = {}): Promise<any> {
    try {
      return await execa(command, args, options)
    } catch (error: any) {
      this.error(`Command execution failed: ${error.message}`, {exit: 1})
      throw error
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
    const startTime = Date.now()
    const {args, flags} = await this.parse(AggregatorCreate)
    const directoryPath = path.resolve(args.directory)

    // Ensure directory exists
    try {
      await fs.ensureDir(directoryPath)
    } catch (error: any) {
      this.error(`Failed to access directory: ${error.message}`, {exit: 1})
    }

    this.log(chalk.blue(`🔍 Scanning for Maven repositories in ${directoryPath}...`))

    // Find all potential Maven repositories (considering possible nesting like owner/repo structure)
    const mavenRepos: {path: string; relativePath: string}[] = []
    const skippedRepos: {path: string; relativePath: string; reason: string}[] = []
    let totalScanned = 0
    
    // First level directories (could be either Maven repos or owner directories)
    const entries = await fs.readdir(directoryPath)
    
    // Filter out non-directories and pom.xml
    const firstLevelEntries = []
    for (const entry of entries) {
      if (entry === 'pom.xml') continue
      
      const entryPath = path.join(directoryPath, entry)
      const stats = await fs.stat(entryPath)
      
      if (stats.isDirectory()) {
        firstLevelEntries.push(entry)
      }
    }
    
    this.log(chalk.blue(`Found ${firstLevelEntries.length} potential repository containers to scan`))
    
    for (const entry of firstLevelEntries) {
      this.log(chalk.dim(`⏳ Examining: ${entry}`))
      
      const entryPath = path.join(directoryPath, entry)
      const stats = await fs.stat(entryPath)
      
      // This should always be a directory since we filtered above
      if (!stats.isDirectory()) {
        continue
      }
      
      totalScanned++
      
      // Check if this is a Maven repo
      const hasPom = await this.validateMavenRepo(entryPath)
      if (hasPom) {
        mavenRepos.push({
          path: entryPath,
          relativePath: entry
        })
        continue
      }
      
      // If not a Maven repo, check if it contains Maven repos (owner/repo structure)
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
              relativePath: path.join(entry, subEntry)
            })
          } else {
            skippedRepos.push({
              path: subEntryPath,
              relativePath: path.join(entry, subEntry),
              reason: 'Missing pom.xml'
            })
          }
        }
      } catch (error) {
        // Skip if we can't read the directory
        skippedRepos.push({
          path: entryPath,
          relativePath: entry,
          reason: `Error reading directory: ${(error as Error).message}`
        })
      }
    }
    
    if (mavenRepos.length === 0) {
      this.error('No Maven repositories found. Each repository must contain a pom.xml file.', {exit: 1})
    }

    // Map found repos to modules for POM file
    const validModules = mavenRepos.map(repo => repo.relativePath)
    
    // Log found repositories
    for (const repo of mavenRepos) {
      this.log(chalk.green(`✅ Found valid Maven repository: ${repo.relativePath}`))
    }
    
    // Log summary
    this.log(chalk.blue('\n📊 Repository scan summary:'))
    this.log(chalk.green(`✅ Found ${mavenRepos.length} valid Maven repositories`))
    if (skippedRepos.length > 0) {
      this.log(chalk.yellow(`⚠️ Skipped ${skippedRepos.length} repositories`))
      for (const repo of skippedRepos) {
        if (repo.reason === 'Missing pom.xml') {
          this.log(chalk.yellow(`  → ${repo.relativePath}: Missing pom.xml file`))
        }
      }
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
      
      // Calculate elapsed time
      const elapsedTimeMs = Date.now() - startTime
      this.log(chalk.dim(`⏱️ Operation completed in ${elapsedTimeMs}ms`))
      
      // Return structured output for JSON flag
      return {
        success: true,
        pomPath,
        modules: [
          ...mavenRepos.map(repo => ({
            path: repo.relativePath,
            valid: true
          })),
          ...skippedRepos.map(repo => ({
            path: repo.relativePath,
            valid: false,
            reason: repo.reason
          }))
        ],
        stats: {
          totalScanned,
          validRepositories: mavenRepos.length,
          skippedRepositories: skippedRepos.length,
          elapsedTimeMs
        },
        mavenCoordinates: {
          groupId: flags.groupId,
          artifactId: flags.artifactId,
          version: flags.pomVersion
        }
      }
    } catch (error: any) {
      this.error(`Failed to write aggregator POM: ${error.message}`, {exit: 1})
      throw error
    }
  }
}
