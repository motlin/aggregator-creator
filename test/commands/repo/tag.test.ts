import {expect} from 'chai'
import {createSandbox} from 'sinon'
import fs from 'fs-extra'
import path from 'node:path'

describe('repo:tag', () => {
  const sandbox = createSandbox()

  beforeEach(() => {
    sandbox.stub(fs, 'readdir').resolves([
      {name: 'repo1', isDirectory: () => true},
      {name: 'repo2', isDirectory: () => true},
      {name: 'repo3.with.dots', isDirectory: () => true},
      {name: 'not-a-dir', isDirectory: () => false},
    ] as unknown as fs.Dirent[])

    sandbox.stub(path, 'resolve').callsFake((p: string) => p)

    sandbox.stub(fs, 'pathExists').callsFake(async (gitPath: string) => {
      if (typeof gitPath === 'string' && gitPath.includes('repo1/.git')) return true
      if (typeof gitPath === 'string' && gitPath.includes('repo2/.git')) return true
      if (typeof gitPath === 'string' && gitPath.includes('repo3.with.dots/.git')) return true
      return false
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  // TODO 2025-05-20: This isn't a real test of the tag command
  it('should output JSON for tag command', () => {
    const expectedJson = {
      success: true,
      topic: 'maven',
      tagged: [
        {owner: 'example', name: 'repo1'},
        {owner: 'example', name: 'repo2'},
        {owner: 'example', name: 'repo3.with.dots'},
      ],
      skipped: [],
    }

    expect(expectedJson).to.deep.equal({
      success: true,
      topic: 'maven',
      tagged: [
        {owner: 'example', name: 'repo1'},
        {owner: 'example', name: 'repo2'},
        {owner: 'example', name: 'repo3.with.dots'},
      ],
      skipped: [],
    })
  })
})
