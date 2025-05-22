import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {execa as execa_} from 'execa'
import fs from 'fs-extra'
import path from 'node:path'
import inquirer from 'inquirer'

export default class RepoTag extends Command {
  static override args = {
    directory: Args.string({
      description: 'Directory containing cloned repos',
      required: true,
    }),
  }

  static override description = 'Tag valid Maven repositories with GitHub topics'

  static override enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./repos-dir --topic maven',
    '<%= config.bin %> <%= command.id %> ./repos-dir --topic maven --dryRun',
  ]

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
  }

  public async run(): Promise<{
    success: boolean
    topic: string
    tagged: {owner: string; name: string}[]
    skipped: {owner: string; name: string; reason: string}[]
  }> {
    const {args, flags} = await this.parse(RepoTag)
    const {directory} = args
    const {topic, dryRun, yes} = flags

    const tagged: {owner: string; name: string}[] = []
    const skipped: {owner: string; name: string; reason: string}[] = []

    const execa = execa_({
      verbose: (verboseLine: string, {type}: {type: string}) => {
        switch (type) {
          case 'command': {
            this.log(`│  │  ├──╮ ${verboseLine}`)
            break
          }
          case 'duration': {
            this.log(`│  │  ├──╯ ${verboseLine}`)
            break
          }
          case 'output': {
            const MAX_LENGTH = 120
            const truncatedLine =
              verboseLine.length > MAX_LENGTH ? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...` : verboseLine
            this.log(`│  │  │  │ ${truncatedLine}`)
            break
          }
          default: {
            this.debug(`${type} ${verboseLine}`)
          }
        }
      },
    })

    this.log(`╭─── 🏷️ Adding ${chalk.yellow(topic)} topic to validated repositories...`)
    this.log(`│`)
    this.log(
      `├──╮ 🔍 Scanning directory: ${chalk.yellow(directory)} for repositories to tag with topic: ${chalk.yellow(topic)}`,
    )
    if (dryRun) {
      this.warn(`│  │ Running in dry-run mode - no changes will be applied`)
    }

    try {
      const absolutePath = path.resolve(directory)
      const entries = await fs.readdir(absolutePath, {withFileTypes: true})

      const ownerDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

      this.log(`│  │ Found ${chalk.yellow(ownerDirs.length)} owner directories to check`)

      const validRepos: Array<{
        path: string
        name: string
        owner: string
        repoName: string
      }> = []

      let totalRepos = 0

      for (const ownerDir of ownerDirs) {
        const ownerPath = path.join(absolutePath, ownerDir)

        const repoEntries = await fs.readdir(ownerPath, {withFileTypes: true})
        const repoDirs = repoEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

        for (const repoDir of repoDirs) {
          totalRepos++
          const repoPath = path.join(ownerPath, repoDir)
          const repoName = repoDir

          this.log(`│  │`)
          this.log(
            `│  ├──╮ 🔍 [${chalk.yellow(totalRepos)}/${repoDirs.length} in ${chalk.yellow(ownerDir)}] ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)}`,
          )

          if (!(await this.isGitRepository(repoPath))) {
            this.log(`│  │  │ Skipping ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)} - not a git repository`)
            skipped.push({owner: ownerDir, name: repoName, reason: 'not a git repository'})
            this.log(`│  ├──╯ ⏩ Repository skipped`)
            continue
          }

          this.log(`│  │  │ Validating Maven repo at: ${chalk.cyan(path.resolve(repoPath))}`)
          const isValid = await this.validateMavenRepo(repoPath, execa)

          if (isValid) {
            this.log(`│  ├──╯ ✅ Valid Maven repository: ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)}`)

            validRepos.push({
              path: repoPath,
              name: repoName,
              owner: ownerDir,
              repoName,
            })
          } else {
            this.log(
              `│  ├──╯ ⏩ Skipping ${chalk.yellow(ownerDir)}/${chalk.yellow(repoName)} - not a valid Maven repository`,
            )
            skipped.push({owner: ownerDir, name: repoName, reason: 'not a valid Maven repository'})
          }
        }
      }

      this.log(`│  │`)
      this.log(`│  ├──╮ 📊 Summary:`)
      this.log(
        `│  │  │ Checked ${chalk.yellow(totalRepos)} total repositories across ${chalk.yellow(ownerDirs.length)} owner directories`,
      )

      if (validRepos.length === 0) {
        this.warn(`│  ├──╯ ℹ️ No valid Maven repositories found to tag.`)
        return {
          success: true,
          topic,
          tagged: [],
          skipped,
        }
      }

      this.log(`│  │  │ Found ${chalk.green(validRepos.length)} valid Maven repositories to tag:`)

      for (const repo of validRepos) {
        this.log(`│  │  │ - ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)}`)
      }
      this.log(`│  ├──╯ ✅ Analysis complete`)
      this.log(`│  │`)

      let proceed = dryRun || yes

      if (!proceed) {
        this.log(
          `│  ├──╮ 🤔 Do you want to tag these ${chalk.yellow(validRepos.length)} repositories with the '${chalk.yellow(topic)}' topic?`,
        )

        const {confirmed} = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Proceed with tagging?`,
            default: false,
          },
        ])
        proceed = confirmed

        if (!proceed) {
          this.warn(`│  ├──╯ ❌ Operation canceled by user.`)
          return {
            success: false,
            topic,
            tagged: [],
            skipped,
          }
        }
        this.log(`│  ├──╯ ✅ Confirmed`)
      }

      this.log(`│  │`)
      this.log(`│  ├──╮ 🏷️ Tagging repositories...`)

      for (const [i, repo] of validRepos.entries()) {
        if (dryRun) {
          this.log(
            `│  │  │ ${chalk.blue('[DRY RUN]')} [${chalk.yellow(i + 1)}/${validRepos.length}] Would tag ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)} with topic: ${chalk.cyan(topic)}`,
          )
          tagged.push({owner: repo.owner, name: repo.repoName})
        } else {
          await this.tagRepository(repo.owner, repo.repoName, topic, execa)
          this.log(
            `│  │  │ ✓ Tagged ${chalk.yellow(repo.owner)}/${chalk.yellow(repo.repoName)} with topic: ${chalk.cyan(topic)}`,
          )
          tagged.push({owner: repo.owner, name: repo.repoName})
        }
      }
      this.log(`│  ├──╯`)
      this.log(`│  │ ✅ Tagging complete`)
      this.log(`├──╯`)
      this.log(`│`)
      this.log(`╰─── ✅ Repository tagging process completed`)

      return {
        success: true,
        topic,
        tagged,
        skipped,
      }
    } catch (error) {
      this.error(`Failed to process repositories: ${error}`, {exit: 1})

      return {
        success: false,
        topic,
        tagged: [],
        skipped: [],
      }
    }
  }

  private async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(repoPath, '.git')
      return await fs.pathExists(gitDir)
    } catch {
      return false
    }
  }

  private async tagRepository(
    owner: string,
    name: string,
    topic: string,
    execa: typeof execa_ = execa_,
  ): Promise<void> {
    try {
      // Use await directly instead of chaining with .then() to maintain sequential flow
      const result = await execa('gh', ['api', `repos/${owner}/${name}/topics`, '--method', 'GET'], {
        reject: false,
      })

      if (result.exitCode === 0) {
        try {
          const topicsData = JSON.parse(result.stdout)
          const topics = topicsData.names || []

          if (topics.includes(topic)) {
            this.log(
              `│  │  │ Topic ${chalk.yellow(topic)} already exists on ${chalk.yellow(owner)}/${chalk.yellow(name)}`,
            )
          } else {
            topics.push(topic)
            await execa('gh', [
              'api',
              `repos/${owner}/${name}/topics`,
              '--method',
              'PUT',
              '-f',
              `names[]=${topics.join('&names[]=')}`,
            ])
          }
        } catch (error) {
          this.error(`│  │  │ Error updating topics: ${error}`, {exit: false})
        }
      } else {
        this.warn(`│  │  │ Failed to get topics for ${chalk.yellow(owner)}/${chalk.yellow(name)}: ${result.stderr}`)
      }
    } catch (error) {
      this.error(`│  │  │ Failed to tag repository ${chalk.yellow(owner)}/${chalk.yellow(name)}: ${error}`, {
        exit: false,
      })
    }
  }

  // TODO 2025-05-22: We shouldn't duplicate this, it's already in the validate command
  private async validateMavenRepo(repoPath: string, execa: typeof execa_ = execa_): Promise<boolean> {
    const absolutePath = path.resolve(repoPath)

    try {
      const stats = await fs.stat(absolutePath)
      if (!stats.isDirectory()) {
        return false
      }
    } catch {
      return false
    }

    const pomPath = path.join(absolutePath, 'pom.xml')
    try {
      const pomExists = await fs.pathExists(pomPath)
      if (!pomExists) {
        this.log(`│  │  │ No pom.xml found at: ${chalk.yellow(pomPath)}`)
        return false
      }
    } catch {
      return false
    }

    try {
      await execa('mvn', ['help:effective-pom', '--quiet', '--file', pomPath])
      return true
    } catch (execError) {
      if (execError instanceof Error && execError.message.includes('ENOENT')) {
        this.warn(`│  │  │ Maven (mvn) command not found. Please install Maven.`)
      }
      return false
    }
  }
}
