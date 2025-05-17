import {createSandbox} from 'sinon'
import * as execa from 'execa'
import type {Result} from 'execa'

const sharedSandbox = createSandbox()

export function restoreAllMocks(): void {
  sharedSandbox.restore()
}

export function createExecaResult(override: Partial<Result> = {}): Result {
  return {
    command: 'mock-command',
    exitCode: 0,
    stdout: '',
    stderr: '',
    failed: false,
    killed: false,
    isCanceled: false,
    timedOut: false,
    ...override,
  } as Result
}

export const ghCliHandler = async (cmd: string, args?: string[]): Promise<Result> => {
  if (cmd === 'gh' && args?.[0] === '--version') {
    return createExecaResult({
      command: 'gh --version',
      stdout: 'gh version 2.0.0',
    })
  }

  if (cmd === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
    return createExecaResult({
      command: 'gh auth status',
      stdout: 'Logged in to github.com as username',
    })
  }

  return createExecaResult()
}

export const mavenValidationHandler = async (): Promise<Result> =>
  createExecaResult({
    command: 'mvn help:effective-pom',
    stdout: 'effective-pom',
  })

export function mockExeca(mockFn: (cmd: string, args?: string[]) => Promise<Result>) {
  return sharedSandbox.stub(execa, 'execa').callsFake((cmd: string, args?: string[]) => mockFn(cmd, args))
}

export function mockExecaCommand(mockFn: (cmd: string) => Promise<Result>) {
  return sharedSandbox.stub(execa, 'execaCommand').callsFake((cmd: string) => mockFn(cmd))
}
