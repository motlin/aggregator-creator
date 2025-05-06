import {expect, test} from '@oclif/test'

describe('repo:clone', () => {
  test
    .stderr()
    .command(['repo:clone'])
    .exit(1)
    .it('errors when no arguments provided', (ctx) => {
      expect(ctx.stderr).to.contain('Missing required arg')
    })

  test
    .stdout()
    .stderr()
    .command(['repo:clone', './test-dir'])
    .exit(1)
    .it('errors when no stdin input provided', (ctx) => {
      expect(ctx.stderr).to.contain('No input provided')
    })
})
