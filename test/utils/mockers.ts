/**
 * Utility functions for mocking modules in tests
 */
import type {Result} from 'execa'

/**
 * Creates a mock execa module with custom implementation
 * @param mockFn Custom implementation for execa
 * @returns A mocked execa module
 */
export function createMockExeca(mockFn: (command: string, args?: string[]) => Promise<Result>) {
  return {
    execa: mockFn,
    execaCommand: mockFn,
  }
}

/**
 * Default Mock for gh CLI version check and auth status
 */
export async function defaultGhCliMock(command: string, args?: string[]): Promise<Result> {
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
