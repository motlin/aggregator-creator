import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'
import * as os from 'node:os'
import {createSandbox} from 'sinon'
import * as execa from 'execa'
import type {Result} from 'execa'
import {createMockResult} from '../../utils/mock-result.js'

const parentPomErrorMock = async (command: string, args?: string[]): Promise<Result> => {
  if (command === 'mvn' && args?.includes('help:evaluate') && args?.includes('-Dexpression=project.modules')) {
    throw new Error('Command failed with exit code 1: mvn help:evaluate: Non-resolvable parent POM')
  }

  if (command === 'mvn' && args?.includes('help:effective-pom')) {
    return createMockResult({
      command: 'mvn help:effective-pom',
      exitCode: 0,
      stdout: 'effective-pom',
      stderr: '',
    })
  }

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

    sandbox.stub(execa, 'execa').callsFake(parentPomErrorMock as unknown as typeof execa.execa)
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    sandbox.restore()
  })

  it('should continue processing when Maven parent POM resolution errors occur', async () => {
    const {stdout} = await runCommand(`aggregator:create ${tempDir} --yes --json`)
    const output = JSON.parse(stdout)

    expect(output).to.deep.equal({
      success: true,
      pomPath: path.join(tempDir, 'pom.xml'),
      modules: [
        {
          path: 'valid-repo1',
          valid: true,
        },
      ],
      stats: {
        totalScanned: 2,
        validRepositories: 1,
        skippedRepositories: 1,
        elapsedTimeMs: output.stats.elapsedTimeMs,
      },
      mavenCoordinates: {
        groupId: 'com.example',
        artifactId: 'aggregator',
        version: '1.0.0-SNAPSHOT',
      },
    })

    const pomPath = path.join(tempDir, 'pom.xml')
    expect(fs.existsSync(pomPath)).to.be.true

    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.include('<module>valid-repo1</module>')
  })
})
