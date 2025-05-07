/**
 * Custom mock execa for the repo:validate command tests
 */
import type {Result} from 'execa'

/**
 * Mock for the repo:validate command test
 */
export const execa = async (command: string, args?: string[]): Promise<Result> => {
  // Mock Maven commands
  if (command === 'mvn' && args?.[0] === 'help:effective-pom') {
    return {
      command: 'mvn help:effective-pom',
      exitCode: 0,
      stdout: 'effective-pom',
      stderr: '',
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

  // Default successful response
  return {
    stdout: 'mock stdout',
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
  if (command.startsWith('mvn help:effective-pom')) {
    return {
      command,
      exitCode: 0,
      stdout: 'effective-pom',
      stderr: '',
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

  const parts = command.split(' ')
  return execa(parts[0], parts.slice(1))
}
