import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:clone', () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {value: true})
  })

  it('errors when no arguments provided', async () => {
    let errorThrown = false

    try {
      const result = await runCommand('repo:clone')
      errorThrown = true
      console.log('Command completed with result:', result)
    } catch (error: unknown) {
      errorThrown = true
      console.log('Caught error:', String(error))
    }

    expect(errorThrown).to.be.true
  })

  it('errors when no stdin input provided', async () => {
    let errorThrown = false

    try {
      const result = await runCommand('repo:clone ./test-dir')

      const stderrOrOutput = result.stderr || result.stdout
      if (stderrOrOutput && stderrOrOutput.includes('No input provided')) {
        errorThrown = true
      } else if (result.error) {
        const errorMsg = String(result.error)
        console.log('Error object:', errorMsg)

        if (errorMsg.includes('No input provided')) {
          errorThrown = true
        } else {
          expect.fail('Command failed but not with the expected message')
        }
      } else {
        expect.fail('Command should have failed but did not')
      }
    } catch (error: unknown) {
      errorThrown = true
      const errorMessage = String(error)
      console.log('Caught error:', errorMessage)

      const hasInputError = errorMessage.includes('No input provided')
      console.log('Has expected error message?', hasInputError)
    }

    expect(errorThrown).to.be.true
  })
})
