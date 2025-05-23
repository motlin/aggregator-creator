import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:list', () => {
  it('should fetch repositories from all organizations when no user flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --json --limit 2')
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
      {
        name: 'build-your-own-x',
        owner: {login: 'codecrafters-io', type: 'Organization'},
        language: 'Markdown',
        topics: ['awesome-list', 'free', 'programming', 'tutorial-code', 'tutorial-exercises', 'tutorials'],
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
    const {stdout} = await runCommand('repo:list --user motlin --json --limit 1')
    expect(JSON.parse(stdout)).to.deep.equal([
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
    ])
  })

  it('should support multiple language filters', async () => {
    const {stdout} = await runCommand('repo:list --user motlin --language Java --language TypeScript --json')
    expect(JSON.parse(stdout)).to.deep.equal([
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
    ])
  })

  it('should include forked repositories when --include-forks flag is provided', async () => {
    const {stdout} = await runCommand('repo:list --user octocat --include-forks --json --limit 1')
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
    const {stdout} = await runCommand('repo:list --user octocat --include-archived --json --limit 1')
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
    const {stdout} = await runCommand('repo:list --user octocat --include-forks --include-archived --json --limit 1')
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
