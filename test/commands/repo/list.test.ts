import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import sinon from 'sinon'
import * as execa from 'execa'

describe('repo:list', () => {
  let execaStub: sinon.SinonStub

  beforeEach(() => {
    // Stub execa to prevent actual GitHub API calls during tests
    execaStub = sinon.stub(execa, 'execa')

    // Default stub for gh --version check
    execaStub.withArgs('gh', ['--version']).resolves({
      stdout: 'gh version 2.0.0',
      stderr: '',
      exitCode: 0,
    })

    // Default stub for gh auth status check
    execaStub.withArgs('gh', ['auth', 'status']).resolves({
      stdout: 'Logged in to github.com as username',
      stderr: '',
      exitCode: 0,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should show error when no user flag is provided', async () => {
    await expect(runCommand('repo:list')).to.be.rejectedWith('GitHub username/organization is required')
  })

  it('should fetch repositories for specified user', async () => {
    // Stub GitHub API call
    execaStub.withArgs('gh', sinon.match.array).resolves({
      stdout: JSON.stringify([
        {
          name: 'repo1',
          owner: {login: 'testuser'},
          html_url: 'https://github.com/testuser/repo1',
          description: 'Test repository 1',
          language: 'Java',
          topics: ['maven'],
        },
      ]),
      stderr: '',
      exitCode: 0,
    })

    const {stdout} = await runCommand('repo:list --user testuser')
    expect(stdout).to.contain('testuser/repo1')
    expect(stdout).to.contain('Java')
  })

  it('should output JSON when --json flag is provided', async () => {
    // Sample repository data
    const sampleRepos = [
      {
        name: 'repo1',
        owner: {login: 'testuser'},
        html_url: 'https://github.com/testuser/repo1',
        description: 'Test repository 1',
        language: 'Java',
        topics: ['maven'],
      },
    ]

    // Stub GitHub API call to return sample repositories
    execaStub.withArgs('gh', sinon.match.array).resolves({
      stdout: JSON.stringify(sampleRepos),
      stderr: '',
      exitCode: 0,
    })

    const {stdout} = await runCommand('repo:list --user testuser --json')
    const parsedOutput = JSON.parse(stdout)
    expect(parsedOutput).to.deep.equal(sampleRepos)
  })
})
