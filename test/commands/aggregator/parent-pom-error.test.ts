import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'
import * as os from 'node:os'
import {createSandbox} from 'sinon'
import * as execa from 'execa'
import type {Result} from 'execa'
import {createMockResult} from '../../utils/mock-result.js'

// Mock for parent POM resolution error
const parentPomErrorMock = async (command: string, args?: string[]): Promise<Result> => {
  if (command === 'mvn' && args?.includes('help:evaluate') && args?.includes('-Dexpression=project.modules')) {
    // Simulate Maven parent POM resolution error for project.modules
    throw new Error('Command failed with exit code 1: mvn help:evaluate: Non-resolvable parent POM')
  }

  // For other Maven commands, return success
  if (command === 'mvn' && args?.includes('help:effective-pom')) {
    return createMockResult({
      command: 'mvn help:effective-pom',
      exitCode: 0,
      stdout: 'effective-pom',
      stderr: '',
    })
  }

  // Default response for other commands
  return createMockResult({
    stdout: '',
    stderr: '',
    exitCode: 0,
    command: `${command} ${args?.join(' ') || ''}`,
  })
}

describe('aggregator:create with parent POM resolution errors', () => {
  let tempDir: string
  const sandbox = createSandbox()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-parent-pom-error-test-'))

    const validRepo1 = path.join(tempDir, 'valid-repo1')
    const problematicRepo = path.join(tempDir, 'problematic-repo')

    await fs.ensureDir(validRepo1)
    await fs.ensureDir(problematicRepo)

    await fs.writeFile(path.join(validRepo1, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>')
    await fs.writeFile(
      path.join(problematicRepo, 'pom.xml'),
      '<project><modelVersion>4.0.0</modelVersion><parent><groupId>org.example</groupId><artifactId>parent</artifactId><version>1.0.0</version></parent></project>',
    )

    // Stub execa to simulate Maven parent POM resolution error
    sandbox.stub(execa, 'execa').callsFake(parentPomErrorMock as unknown as typeof execa.execa)
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    sandbox.restore()
  })

  it('should continue processing when Maven parent POM resolution errors occur', async () => {
    const {stdout} = await runCommand(`aggregator:create ${tempDir} --yes`)

    // Should still succeed despite parent POM resolution issues
    expect(stdout).to.include('Created aggregator POM')

    // Should include warning about parent POM resolution issues
    expect(stdout).to.include('parent POM resolution issues')

    // The POM should still be created
    const pomPath = path.join(tempDir, 'pom.xml')
    expect(fs.existsSync(pomPath)).to.be.true

    // The content should include valid repos that didn't have issues
    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.include('<module>valid-repo1</module>')
  })
})
