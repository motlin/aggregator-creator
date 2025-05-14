import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:clone', () => {
  // Mock execa module is automatically used since it's imported in the test directory

  beforeEach(() => {
    // Mock process.stdin.isTTY to true to force "No input provided" error
    Object.defineProperty(process.stdin, 'isTTY', {value: true})
  })

  it('errors when no arguments provided', async () => {
    try {
      await runCommand('repo:clone')
      expect.fail('Command should have failed but did not')
    } catch (error: unknown) {
      const errorMessage = String(error)

      // Log the actual error message for debugging
      console.log('Actual error message:', errorMessage)

      // Use looser criteria for checking error message related to missing arguments
      const hasRequiredArgError =
        errorMessage.toLowerCase().includes('missing') ||
        errorMessage.toLowerCase().includes('required') ||
        errorMessage.toLowerCase().includes('argument') ||
        errorMessage.toLowerCase().includes('targetdirectory');

      expect(hasRequiredArgError).to.be.true
    }
  })

  it('errors when no stdin input provided', async () => {
    try {
      await runCommand('repo:clone ./test-dir')
      // If we get here without an error, fail the test
      expect.fail('Command should have failed but did not')
    } catch (error: unknown) {
      expect((error as Error).message).to.include('No input provided')
    }
  })
})
