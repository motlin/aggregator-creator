import type {Result} from 'execa'
export const defaultExecaMock = async (command: string, args?: string[]): Promise<Result> => {
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

export const mavenValidationMock = async (_command: string, _args?: string[]): Promise<Result> =>
  ({
    command: 'mvn help:effective-pom',
    exitCode: 0,
    stdout: 'effective-pom',
    stderr: '',
    failed: false,
    isCanceled: false,
    killed: false,
    timedOut: false,
  }) as Result

export const execa = defaultExecaMock
export const execaCommand = async (command: string): Promise<Result> => {
  const parts = command.split(' ')
  return execa(parts[0], parts.slice(1))
}
