import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:list', () => {
  it('should fetch repositories from all organizations when no user flag is provided', async () => {
    const {stdout} = await runCommand('repo:list')
    expect(stdout).to.contain('org1/repo1')
    expect(stdout).to.contain('org2/repo2')
    expect(stdout).to.contain('Java')
    expect(stdout).to.contain('TypeScript')
  })

  it('should fetch repositories for specified user', async () => {
    const {stdout} = await runCommand('repo:list --user testuser --json')
    expect(JSON.parse(stdout)).to.deep.equal([
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
    ])
  })

  it('should support multiple language filters', async () => {
    const {stdout} = await runCommand('repo:list --user testuser --language Java --language TypeScript --json')
    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'repo1',
        owner: {login: 'testuser', type: 'User'},
        language: 'Java',
        topics: ['maven'],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
      },
      {
        name: 'repo2',
        owner: {login: 'testuser', type: 'User'},
        language: 'TypeScript',
        topics: ['webpack'],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
      },
    ])
  })

  it('should include forked repositories when --include-forks flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --include-forks')
    expect(stdout).to.contain('otheruser/forked-repo')
    expect(stdout).to.contain('JavaScript')
  })

  it('should include archived repositories when --include-archived flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --include-archived')
    expect(stdout).to.contain('thirduser/archived-repo')
    expect(stdout).to.contain('Python')
  })

  it('should support combining include flags', async () => {
    const {stdout} = await runCommand('repo:list --include-forks --include-archived')
    expect(stdout).to.contain('otheruser/forked-repo')
    expect(stdout).to.contain('thirduser/archived-repo')
  })
})
