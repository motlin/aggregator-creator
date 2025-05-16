import type {Result} from 'execa'

// Store mocked functions
const mockedFunctions = new Map<string, MockImplementation>()

// Type for a mock implementation
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

// Setup interception by adding our own import.meta.resolve hook
// This is needed because we can't directly modify ESM module properties
export function setupMockInterceptor(): void {
  // This is just a stub for now - we can't actually use import.meta.resolve in tests
}

// Helper function to create mock results
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
