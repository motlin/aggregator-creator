import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import * as fs from 'fs-extra'
import * as path from 'node:path'
import * as os from 'node:os'
import sinon from 'sinon'

describe('aggregator:create', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-test-'))

    // Create sample Maven repository structures
    const validRepo1 = path.join(tempDir, 'valid-repo1')
    const validRepo2 = path.join(tempDir, 'valid-repo2')
    const invalidRepo = path.join(tempDir, 'invalid-repo')

    await fs.ensureDir(validRepo1)
    await fs.ensureDir(validRepo2)
    await fs.ensureDir(invalidRepo)

    // Create pom.xml files in valid repos
    await fs.writeFile(path.join(validRepo1, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>')
    await fs.writeFile(path.join(validRepo2, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>')
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(tempDir)
    sinon.restore()
  })

  it('errors when no directory is provided', async () => {
    try {
      await runCommand('aggregator:create')
      // If we get here without an error, fail the test
      expect.fail('Command should have failed but did not')
    } catch (error: any) {
      expect(error.message).to.contain('Missing required arg')
    }
  })

  it('creates an aggregator POM with default values', async () => {
    const {stdout} = await runCommand(`aggregator:create ${tempDir}`)

    expect(stdout).to.contain('Found valid Maven repository: valid-repo1')
    expect(stdout).to.contain('Found valid Maven repository: valid-repo2')
    expect(stdout).to.contain('Invalid Maven repository (no pom.xml): invalid-repo')
    expect(stdout).to.contain('Created aggregator POM')

    // Check if pom.xml was created
    const pomPath = path.join(tempDir, 'pom.xml')
    expect(fs.existsSync(pomPath)).to.be.true

    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.contain('<groupId>com.example</groupId>')
    expect(pomContent).to.contain('<artifactId>aggregator</artifactId>')
    expect(pomContent).to.contain('<version>1.0.0-SNAPSHOT</version>')
    expect(pomContent).to.contain('<module>valid-repo1</module>')
    expect(pomContent).to.contain('<module>valid-repo2</module>')
  })

  it('creates an aggregator POM with custom values', async () => {
    const {stdout} = await runCommand(
      `aggregator:create ${tempDir} --groupId org.test --artifactId custom-agg --pomVersion 2.0.0`,
    )

    expect(stdout).to.contain('Created aggregator POM')

    // Check if pom.xml was created with custom values
    const pomPath = path.join(tempDir, 'pom.xml')
    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.contain('<groupId>org.test</groupId>')
    expect(pomContent).to.contain('<artifactId>custom-agg</artifactId>')
    expect(pomContent).to.contain('<version>2.0.0</version>')
  })
})
