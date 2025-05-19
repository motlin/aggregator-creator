import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'
import {createSandbox} from 'sinon'

import './mock-execa-validate'

describe('repo:validate', () => {
  let tempDir: string
  const sandbox = createSandbox()

  beforeEach(() => {
    tempDir = path.join(process.cwd(), 'test-temp-dir')
  })

  afterEach(async () => {
    sandbox.restore()

    if (fs.existsSync(tempDir)) {
      await fs.remove(tempDir)
    }
  })

  it('should fail when directory does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent')

    try {
      await runCommand(`repo:validate ${nonExistentPath} --json`)
      expect.fail('Command should have failed')
    } catch (error: unknown) {
      const typedError = error as {exit?: number; message: string}
      expect(typedError.exit).to.equal(1)
      expect(typedError.message).to.contain('Directory does not exist')
    }
  })

  it('should fail when no pom.xml exists', async () => {
    await fs.ensureDir(tempDir)

    const {stdout} = await runCommand(`repo:validate ${tempDir} --json`)
    const result = JSON.parse(stdout)
    expect(result).to.deep.equal({
      validCount: 0,
      validRepos: [],
    })
  })

  it('should succeed for valid Maven repo', async () => {
    await fs.ensureDir(tempDir)
    await fs.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>')

    const {stdout} = await runCommand(`repo:validate ${tempDir} --json`)
    const result = JSON.parse(stdout)
    expect(result).to.deep.equal({
      validCount: 0,
      validRepos: [],
    })
  })
})
