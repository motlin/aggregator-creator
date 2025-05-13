/**
 * Mocks for inquirer prompts in tests
 */
import {createSandbox} from 'sinon'
import * as inquirer from 'inquirer'

const sandbox = createSandbox()

/**
 * Mock inquirer to automatically return true for confirmation prompts
 */
export function mockInquirer() {
  // Create a default mock implementation
  const promptStub = sandbox.stub(inquirer, 'prompt').resolves({confirmed: true})

  return {
    promptStub,
  }
}

/**
 * Restore all mocks
 */
export function restoreInquirerMocks() {
  sandbox.restore()
}
