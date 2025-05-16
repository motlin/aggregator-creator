import type {Result} from 'execa'

const sampleRepo = {
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
}

const multiLangRepos = [
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
]

export const execa = async (command: string, args?: string[]): Promise<Result> => {
  if (command === 'gh' && args?.[0] === '--version') {
    return {
      stdout: 'gh version 2.0.0',
      stderr: '',
      exitCode: 0,
      command: 'gh --version',
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

  if (command === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
    return {
      stdout: 'Logged in to github.com as username',
      stderr: '',
      exitCode: 0,
      command: 'gh auth status',
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

  if (command === 'gh' && args?.[0] === 'api') {
    const argString = args?.join(' ') || ''
    if (argString.includes('language:TypeScript') || argString.includes('language:Java')) {
      return {
        stdout: JSON.stringify(multiLangRepos),
        stderr: '',
        exitCode: 0,
        command: `gh ${args?.join(' ')}`,
        failed: false,
        isCanceled: false,
        killed: false,
        timedOut: false,
      } as Result
    }

    if (argString.includes('--json')) {
      return {
        stdout: JSON.stringify([sampleRepo]),
        stderr: '',
        exitCode: 0,
        command: `gh ${args?.join(' ')}`,
        failed: false,
        isCanceled: false,
        killed: false,
        timedOut: false,
      } as Result
    }

    return {
      stdout: JSON.stringify([sampleRepo]),
      stderr: '',
      exitCode: 0,
      command: `gh ${args?.join(' ')}`,
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    command: `${command} ${args?.join(' ') || ''}`,
    failed: false,
    isCanceled: false,
    killed: false,
    timedOut: false,
  } as Result
}

export const execaCommand = async (command: string): Promise<Result> => {
  const parts = command.split(' ')
  return execa(parts[0], parts.slice(1))
}
