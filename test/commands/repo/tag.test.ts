import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import {createSandbox} from 'sinon'
import fs from 'fs-extra'
import path from 'node:path'

// Import mock execa for repo:tag tests
import './mock-execa-tag'

describe('repo:tag', () => {
  const sandbox = createSandbox()

  beforeEach(() => {
    // Stub fs.readdir to return a mock repository structure
    sandbox.stub(fs, 'readdir').resolves([
      {name: 'repo1', isDirectory: () => true},
      {name: 'repo2', isDirectory: () => true},
      {name: 'repo3.with.dots', isDirectory: () => true},
      {name: 'not-a-dir', isDirectory: () => false},
    ] as unknown as fs.Dirent[])

    // Stub path.resolve to return predictable paths
    sandbox.stub(path, 'resolve').callsFake((p: string) => p)

    // Stub fs.pathExists for .git directory checks
    sandbox.stub(fs, 'pathExists').callsFake(async (gitPath: string) => {
      if (typeof gitPath === 'string' && gitPath.includes('repo1/.git')) return true
      if (typeof gitPath === 'string' && gitPath.includes('repo2/.git')) return true
      if (typeof gitPath === 'string' && gitPath.includes('repo3.with.dots/.git')) return true
      return false
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('runs repo:tag with dry-run flag', async () => {
    const {stdout} = await runCommand('repo:tag ./test-repos --topic maven --dry-run --yes')

    expect(stdout).to.contain('Scanning directory: ./test-repos')
    expect(stdout).to.contain('Running in dry-run mode')
    expect(stdout).to.contain('Found 3 directories to check')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo1 with topic: maven')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo2 with topic: maven')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo3.with.dots with topic: maven')
  })

  it('handles non-git directories properly', async () => {
    // Reset stubs and create new ones for this test
    sandbox.restore()

    // Create a new sandbox for this test
    const testSandbox = createSandbox()

    // Stub fs.readdir to return a mock repository structure
    testSandbox.stub(fs, 'readdir').resolves([
      {name: 'repo1', isDirectory: () => true},
      {name: 'repo2', isDirectory: () => true},
      {name: 'not-a-dir', isDirectory: () => false},
    ] as unknown as fs.Dirent[])

    // Stub path.resolve to return predictable paths
    testSandbox.stub(path, 'resolve').callsFake((p: string) => p)

    // Modify fs.pathExists to make repo2 not a git repo
    testSandbox.stub(fs, 'pathExists').callsFake(async (gitPath: string) => {
      if (typeof gitPath === 'string' && gitPath.includes('repo1/.git')) return true
      return false
    })

    const {stdout} = await runCommand('repo:tag ./test-repos --topic maven --dry-run --yes')

    expect(stdout).to.contain('Skipping repo2 - not a git repository')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo1 with topic: maven')

    // Clean up this test's sandbox
    testSandbox.restore()
  })

  it('correctly handles repository names with dots', async () => {
    // Reset stubs and create new ones for this test
    sandbox.restore()

    // Create a new sandbox for this test
    const testSandbox = createSandbox()

    // Stub fs.readdir to return a mock repository structure with a repo containing dots
    testSandbox
      .stub(fs, 'readdir')
      .resolves([{name: 'repo3.with.dots', isDirectory: () => true}] as unknown as fs.Dirent[])

    // Stub path.resolve to return predictable paths
    testSandbox.stub(path, 'resolve').callsFake((p: string) => p)

    // Ensure the repository with dots is a git repo
    testSandbox.stub(fs, 'pathExists').callsFake(async (gitPath: string) => {
      if (typeof gitPath === 'string' && gitPath.includes('repo3.with.dots/.git')) return true
      // Make it also a Maven repo
      if (typeof gitPath === 'string' && gitPath.includes('repo3.with.dots/pom.xml')) return true
      return false
    })

    const {stdout} = await runCommand('repo:tag ./test-repos --topic maven --dry-run --yes')

    // The key expectation: the repo with dots in its name should be properly tagged
    expect(stdout).to.contain('✓ Valid Maven repository: repo3.with.dots')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo3.with.dots with topic: maven')

    // Clean up this test's sandbox
    testSandbox.restore()
  })
})
