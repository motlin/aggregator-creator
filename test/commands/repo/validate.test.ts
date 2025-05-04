import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import {execa} from 'execa'
import * as fs from 'fs-extra'
import path from 'node:path'
import * as sinon from 'sinon'

describe('repo:validate', () => {
  let tempDir: string
  let sandbox: sinon.SinonSandbox
  
  beforeEach(() => {
    tempDir = path.join(process.cwd(), 'test-temp-dir')
    sandbox = sinon.createSandbox()
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
      await runCommand(`repo:validate ${nonExistentPath}`)
      throw new Error('Command should have failed')
    } catch (error) {
      const typedError = error as {code: number; message: string}
      expect(typedError.code).to.equal(1)
      expect(typedError.message).to.contain('Directory does not exist')
    }
  })

  it('should fail when no pom.xml exists', async () => {
    await fs.ensureDir(tempDir)
    
    try {
      await runCommand(`repo:validate ${tempDir}`)
      throw new Error('Command should have failed')
    } catch (error) {
      const typedError = error as {code: number; message: string}
      expect(typedError.code).to.equal(1)
      expect(typedError.message).to.contain('No pom.xml found')
    }
  })

  it('should succeed for valid Maven repo', async () => {
    await fs.ensureDir(tempDir)
    await fs.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>')
    
    // Mock mvn command execution
    sandbox.stub(execa, 'command').resolves({
      command: 'mvn help:effective-pom',
      exitCode: 0,
      failed: false,
      isCanceled: false,
      killed: false,
      stderr: '',
      stdout: 'effective-pom',
      timedOut: false,
    })
    
    const {stdout} = await runCommand(`repo:validate ${tempDir}`)
    expect(stdout).to.contain('valid Maven project')
  })
})
