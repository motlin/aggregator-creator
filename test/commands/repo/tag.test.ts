import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import {createSandbox} from 'sinon'
import fs from 'fs-extra'
import path from 'node:path'
import {execa, type Result} from 'execa'

describe('repo:tag', () => {
  const sandbox = createSandbox()

  beforeEach(() => {
    // Stub fs.readdir to return a mock repository structure
    sandbox.stub(fs, 'readdir').resolves([
      {name: 'repo1', isDirectory: () => true},
      {name: 'repo2', isDirectory: () => true},
      {name: 'not-a-dir', isDirectory: () => false},
    ] as unknown as fs.Dirent[])

    // Stub path.resolve to return predictable paths
    sandbox.stub(path, 'resolve').callsFake((path) => path)

    // Stub fs.pathExists for .git directory checks
    sandbox.stub(fs, 'pathExists').callsFake(async (gitPath) => {
      if (gitPath.includes('repo1/.git')) return true
      if (gitPath.includes('repo2/.git')) return true
      return false
    })

    // Stub execa for git remote calls
    sandbox.stub(execa).callsFake(async (cmd, args) => {
      if (cmd === 'git' && args?.[0] === '-C' && args[2] === 'remote') {
        if (args[1].includes('repo1')) {
          return {stdout: 'git@github.com:example/repo1.git'} as Result
        }
        if (args[1].includes('repo2')) {
          return {stdout: 'https://github.com/example/repo2.git'} as Result
        }
      }

      if (cmd === 'gh' && args?.[0] === 'api' && args[1].includes('/topics')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({names: ['existing-topic']}),
        } as Result
      }

      // Mock maven validation to return true
      return {stdout: 'mock stdout', exitCode: 0} as Result
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('runs repo:tag with dry-run flag', async () => {
    const {stdout} = await runCommand('repo:tag ./test-repos --topic maven --dry-run')

    expect(stdout).to.contain('Scanning directory: ./test-repos')
    expect(stdout).to.contain('Running in dry-run mode')
    expect(stdout).to.contain('Found 2 directories to check')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo1 with topic: maven')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo2 with topic: maven')
  })

  it('handles non-git directories properly', async () => {
    // Modify fs.pathExists to make repo2 not a git repo
    sandbox.restore()

    sandbox.stub(fs, 'pathExists').callsFake(async (gitPath) => {
      if (gitPath.includes('repo1/.git')) return true
      return false
    })

    const {stdout} = await runCommand('repo:tag ./test-repos --topic maven --dry-run')

    expect(stdout).to.contain('Skipping repo2 - not a git repository')
    expect(stdout).to.contain('[DRY RUN] Would tag example/repo1 with topic: maven')
  })
})
