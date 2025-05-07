import {runCommand} from '@oclif/test'
import {expect} from 'chai'

// Import mock execa for repo:list tests
// This will be used instead of the real execa due to Node.js module resolution
import './mock-execa-list'

describe('repo:list', () => {
  it('should show error when no user flag is provided', async () => {
    try {
      await runCommand('repo:list')
      // If we get here without an error, fail the test
      expect.fail('Command should have failed but did not')
    } catch (error: unknown) {
      expect((error as Error).message).to.contain('GitHub username/organization is required')
    }
  })

  it('should fetch repositories for specified user', async () => {
    const {stdout} = await runCommand('repo:list --user testuser')
    expect(stdout).to.contain('testuser/repo1')
    expect(stdout).to.contain('Java')
    expect(stdout).to.contain('Topics: [maven]')
  })

  it('should support multiple language filters', async () => {
    const {stdout} = await runCommand('repo:list --user testuser --language Java --language TypeScript')
    expect(stdout).to.contain('testuser/repo1')
    expect(stdout).to.contain('testuser/repo2')
    expect(stdout).to.contain('Java')
    expect(stdout).to.contain('TypeScript')
  })

  it('should output JSON when --json flag is provided', async () => {
    // Sample repository data
    const sampleRepos = [
      {
        name: 'repo1',
        owner: {login: 'testuser', type: 'User'},
        html_url: 'https://github.com/testuser/repo1',
        description: 'Test repository 1',
        language: 'Java',
        topics: ['maven'],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
      },
    ]

    const {stdout} = await runCommand('repo:list --user testuser --json')
    const parsedOutput = JSON.parse(stdout)
    expect(parsedOutput).to.deep.equal(sampleRepos)
  })
})
