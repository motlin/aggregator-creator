import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:list', () => {
  it('should fetch repositories with specific search criteria', async () => {
    const {stdout} = await runCommand('repo:list --user torvalds --language C --json --limit 2')

    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'linux',
        owner: {login: 'torvalds', type: 'User'},
        language: 'C',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'uemacs',
        owner: {login: 'torvalds', type: 'User'},
        language: 'C',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })

  it('should fetch repositories for specified user', async () => {
    const expected = [
      {
        name: 'jetbrains-settings',
        owner: {login: 'motlin', type: 'User'},
        language: null,
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ]

    const {stdout} = await runCommand('repo:list --user motlin --json --limit 1')
    expect(JSON.parse(stdout)).to.deep.equal(expected)
  })

  it('should fetch repositories for freeCodeCamp user', async () => {
    const {stdout} = await runCommand('repo:list --user freeCodeCamp --json --limit 1')

    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'freeCodeCamp',
        owner: {login: 'freeCodeCamp', type: 'Organization'},
        language: 'TypeScript',
        topics: [
          'careers',
          'certification',
          'community',
          'curriculum',
          'd3',
          'education',
          'freecodecamp',
          'hacktoberfest',
          'javascript',
          'learn-to-code',
          'math',
          'nodejs',
          'nonprofits',
          'programming',
          'react',
          'teachers',
        ],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })

  it('should support multiple language filters', async () => {
    const {stdout} = await runCommand('repo:list --user motlin --language Java --language TypeScript --json')
    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'hex-flip',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'motlin.com',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'checkstyle-results',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'aggregator-creator',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'factorio-blueprint-playground',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'JUnit-Java-8-Runner',
        owner: {login: 'motlin', type: 'User'},
        language: 'Java',
        topics: ['maven'],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
      {
        name: 'factorio-icon-cdn',
        owner: {login: 'motlin', type: 'User'},
        language: 'TypeScript',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })

  it('should include forked repositories when --include-forks flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --user octocat --language HTML --include-forks --json --limit 1')
    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'Spoon-Knife',
        owner: {login: 'octocat', type: 'User'},
        language: 'HTML',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })

  it('should include archived repositories when --include-archived flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --user octocat --language HTML --include-archived --json --limit 1')
    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'Spoon-Knife',
        owner: {login: 'octocat', type: 'User'},
        language: 'HTML',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })

  it('should support combining include flags', async () => {
    const {stdout} = await runCommand(
      'repo:list --user octocat --language HTML --include-forks --include-archived --json --limit 1',
    )
    expect(JSON.parse(stdout)).to.deep.equal([
      {
        name: 'Spoon-Knife',
        owner: {login: 'octocat', type: 'User'},
        language: 'HTML',
        topics: [],
        fork: false,
        archived: false,
        disabled: false,
        is_template: false,
        private: false,
        visibility: 'public',
      },
    ])
  })
})
