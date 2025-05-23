import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'
import {createSandbox} from 'sinon'

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

    const result = await runCommand(`repo:validate ${nonExistentPath} --json`)
    expect(result).to.deep.equal({
      result: undefined,
      stdout: `{\n  "error": {\n    "code": "ENOENT",\n    "oclif": {\n      "exit": 1\n    },\n    "suggestions": [\n      "ENOENT: no such file or directory, stat '${nonExistentPath}'"\n    ]\n  }\n}\n`,
      stderr: '',
    })
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
