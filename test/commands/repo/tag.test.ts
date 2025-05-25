import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'

describe('repo:tag', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-temp-tag-dir')
    await fs.ensureDir(tempDir)
  })

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir)
    }
  })

  it('should tag valid Maven repositories with the specified topic', async () => {
    // Create owner directories
    const owner1Path = path.join(tempDir, 'owner1')
    const owner2Path = path.join(tempDir, 'owner2')
    await fs.ensureDir(owner1Path)
    await fs.ensureDir(owner2Path)

    // Create repositories with git directories and pom.xml files
    const repo1Path = path.join(owner1Path, 'repo1')
    const repo2Path = path.join(owner1Path, 'repo2')
    const repo3Path = path.join(owner2Path, 'repo3.with.dots')
    const invalidRepoPath = path.join(owner2Path, 'invalid-repo')

    const validPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0.0</version>
</project>`

    // Set up valid repos
    await fs.ensureDir(path.join(repo1Path, '.git'))
    await fs.writeFile(path.join(repo1Path, 'pom.xml'), validPom)

    await fs.ensureDir(path.join(repo2Path, '.git'))
    await fs.writeFile(path.join(repo2Path, 'pom.xml'), validPom)

    await fs.ensureDir(path.join(repo3Path, '.git'))
    await fs.writeFile(path.join(repo3Path, 'pom.xml'), validPom)

    // Set up invalid repo (no pom.xml)
    await fs.ensureDir(path.join(invalidRepoPath, '.git'))

    const {stdout} = await runCommand(`repo:tag ${tempDir} --topic maven --dryRun --json`)
    const result = JSON.parse(stdout)

    expect(result).to.deep.equal({
      success: true,
      topic: 'maven',
      tagged: [
        {owner: 'owner1', name: 'repo1'},
        {owner: 'owner1', name: 'repo2'},
        {owner: 'owner2', name: 'repo3.with.dots'},
      ],
      skipped: [{owner: 'owner2', name: 'invalid-repo', reason: 'not a valid Maven repository'}],
    })
  })

  it('should skip directories that are not git repositories', async () => {
    const ownerPath = path.join(tempDir, 'owner')
    await fs.ensureDir(ownerPath)

    // Create a directory without .git
    const nonGitRepoPath = path.join(ownerPath, 'not-a-git-repo')
    await fs.ensureDir(nonGitRepoPath)
    const validPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0.0</version>
</project>`
    await fs.writeFile(path.join(nonGitRepoPath, 'pom.xml'), validPom)

    const {stdout} = await runCommand(`repo:tag ${tempDir} --topic maven --dryRun --json`)
    const result = JSON.parse(stdout)

    expect(result).to.deep.equal({
      success: true,
      topic: 'maven',
      tagged: [],
      skipped: [{owner: 'owner', name: 'not-a-git-repo', reason: 'not a git repository'}],
    })
  })

  it('should handle the --yes flag to skip confirmation', async () => {
    const ownerPath = path.join(tempDir, 'owner')
    await fs.ensureDir(ownerPath)

    const repoPath = path.join(ownerPath, 'repo')
    await fs.ensureDir(path.join(repoPath, '.git'))
    const validPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0.0</version>
</project>`
    await fs.writeFile(path.join(repoPath, 'pom.xml'), validPom)

    const {stdout} = await runCommand(`repo:tag ${tempDir} --topic maven --yes --dryRun --json`)
    const result = JSON.parse(stdout)

    expect(result).to.deep.equal({
      success: true,
      topic: 'maven',
      tagged: [{owner: 'owner', name: 'repo'}],
      skipped: [],
    })
  })
})
