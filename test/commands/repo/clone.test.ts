import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repo:clone', () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {value: true})
  })

  it('errors when no arguments provided', async () => {
    const result = await runCommand('repo:clone')
    expect(result).to.deep.equal({
      error: new Error(
        'Missing 1 required arg:\ntargetDirectory  Directory to clone repositories into\nSee more help with --help',
      ),
      stdout: '',
      stderr: '',
    })
  })

  it('errors when no stdin input provided', async () => {
    const result = await runCommand('repo:clone ./test-dir')

    expect(result).to.deep.equal({
      error: new Error('No input provided. This command expects repository data from stdin.'),
      stdout: '',
      stderr: '',
    })
  })
})
