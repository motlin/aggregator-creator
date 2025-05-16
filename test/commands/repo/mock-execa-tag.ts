/**
 * Custom mock execa for the repo:tag command tests
 */
import type {Result} from 'execa'

export const execa = async (command: string, args?: string[]): Promise<Result> => {
  if (command === 'git' && args?.[0] === '-C' && args[2] === 'remote') {
    if (args[1].includes('repo1')) {
      return {
        stdout: 'git@github.com:example/repo1.git',
        stderr: '',
        exitCode: 0,
        command: `git ${args.join(' ')}`,
        failed: false,
        isCanceled: false,
        killed: false,
        timedOut: false,
      } as Result
    }

    if (args[1].includes('repo2')) {
      return {
        stdout: 'https://github.com/example/repo2.git',
        stderr: '',
        exitCode: 0,
        command: `git ${args.join(' ')}`,
        failed: false,
        isCanceled: false,
        killed: false,
        timedOut: false,
      } as Result
    }

    if (args[1].includes('repo3.with.dots')) {
      return {
        stdout: 'https://github.com/example/repo3.with.dots.git',
        stderr: '',
        exitCode: 0,
        command: `git ${args.join(' ')}`,
        failed: false,
        isCanceled: false,
        killed: false,
        timedOut: false,
      } as Result
    }
  }

  if (command === 'gh' && args?.[0] === 'api' && args[1]?.includes('/topics')) {
    return {
      stdout: JSON.stringify({names: ['existing-topic']}),
      stderr: '',
      exitCode: 0,
      command: `gh ${args?.join(' ')}`,
      failed: false,
      isCanceled: false,
      killed: false,
      timedOut: false,
    } as Result
  }

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
  const parts = command.split(' ')
  return execa(parts[0], parts.slice(1))
}
