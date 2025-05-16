import type {Result} from 'execa'

const mockedFunctions = new Map<string, MockImplementation>()

type MockImplementation = (command: string, args?: string[]) => Promise<Result>

export function mockFunction(moduleName: string, functionName: string, mockImplementation: MockImplementation): void {
  const key = `${moduleName}:${functionName}`
  mockedFunctions.set(key, mockImplementation)
}

export function resetMocks(): void {
  mockedFunctions.clear()
}

export async function defaultExecaMock(command: string, args?: string[]): Promise<Result> {
  if (command === 'gh' && args?.[0] === '--version') {
    return {
      stdout: 'gh version 2.0.0',
      stderr: '',
      exitCode: 0,
    } as Result
  }

  if (command === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
    return {
      stdout: 'Logged in to github.com as username',
      stderr: '',
      exitCode: 0,
    } as Result
  }

  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
  } as Result
}

export function setupMockInterceptor(): void {
}

export function createMockResult(override: Partial<Result> = {}): Result {
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
