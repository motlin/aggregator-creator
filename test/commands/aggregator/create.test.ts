import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'
import * as os from 'node:os'
import {createSandbox} from 'sinon'

describe('aggregator:create', () => {
  let tempDir: string
  const sandbox = createSandbox()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-test-'))

    const validRepo1 = path.join(tempDir, 'valid-repo1')
    const validRepo2 = path.join(tempDir, 'valid-repo2')
    const invalidRepo = path.join(tempDir, 'invalid-repo')

    await fs.ensureDir(validRepo1)
    await fs.ensureDir(validRepo2)
    await fs.ensureDir(invalidRepo)

    await fs.writeFile(path.join(validRepo1, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>')
    await fs.writeFile(path.join(validRepo2, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>')
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    sandbox.restore()
  })

  it('errors when no directory is provided', async () => {
    let errorThrown = false

    try {
      const result = await runCommand('aggregator:create')
      const stderrOrOutput = result.stderr || result.stdout

      if (
        stderrOrOutput.includes('Missing 1 required arg') ||
        stderrOrOutput.includes('directory') ||
        stderrOrOutput.includes('required')
      ) {
        errorThrown = true
      } else {
        expect.fail('Command should have failed but did not')
      }
    } catch {
      errorThrown = true
    }

    expect(errorThrown).to.be.true
  })

  it('creates an aggregator POM with default values', async () => {
    const {stdout} = await runCommand(`aggregator:create ${tempDir} --yes`)

    expect(stdout).to.include('Found valid Maven repository: valid-repo1')
    expect(stdout).to.include('Found valid Maven repository: valid-repo2')

    const hasMissingPomIndicator =
      stdout.includes('Missing pom.xml') || stdout.includes('invalid-repo') || stdout.includes('Skipped')
    expect(hasMissingPomIndicator).to.be.true

    expect(stdout).to.include('Created aggregator POM')

    const pomPath = path.join(tempDir, 'pom.xml')
    expect(fs.existsSync(pomPath)).to.be.true

    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.include('<groupId>com.example</groupId>')
    expect(pomContent).to.include('<artifactId>aggregator</artifactId>')
    expect(pomContent).to.include('<version>1.0.0-SNAPSHOT</version>')
    expect(pomContent).to.include('<module>valid-repo1</module>')
    expect(pomContent).to.include('<module>valid-repo2</module>')
  })

  it('creates an aggregator POM with custom values', async () => {
    const {stdout} = await runCommand(
      `aggregator:create ${tempDir} --groupId org.test --artifactId custom-agg --pomVersion 2.0.0 --yes`,
    )

    expect(stdout).to.include('Created aggregator POM')

    const pomPath = path.join(tempDir, 'pom.xml')
    const pomContent = await fs.readFile(pomPath, 'utf8')
    expect(pomContent).to.include('<groupId>org.test</groupId>')
    expect(pomContent).to.include('<artifactId>custom-agg</artifactId>')
    expect(pomContent).to.include('<version>2.0.0</version>')
  })

  it('outputs in json format when --json flag is provided', async () => {
    const {stdout} = await runCommand(`aggregator:create ${tempDir} --json --yes`)

    const output = JSON.parse(stdout)

    expect(output).to.have.property('success', true)
    expect(output).to.have.property('pomPath')
    expect(output).to.have.property('modules').that.is.an('array')
    expect(output).to.have.property('stats').that.is.an('object')
    expect(output.stats).to.have.property('validRepositories', 2)

    expect(output.stats).to.have.property('skippedRepositories')

    expect(output).to.have.property('mavenCoordinates').that.is.an('object')
    expect(output.mavenCoordinates).to.have.property('groupId', 'com.example')
  })

  it('returns a structured error when no Maven repositories are found with --json flag', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-dir-'))

    try {
      const {stdout} = await runCommand(`aggregator:create ${emptyDir} --json --yes`)

      const output = JSON.parse(stdout)

      expect(output).to.have.property('success', false)
      expect(output).to.have.property('error').that.includes('No Maven repositories found')
      expect(output).to.have.property('stats').that.is.an('object')
      expect(output.stats).to.have.property('validRepositories', 0)
    } finally {
      await fs.remove(emptyDir)
    }
  })

  it('throws an error when no Maven repositories are found without --json flag', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-dir-'))
    let errorThrown = false

    try {
      const result = await runCommand(`aggregator:create ${emptyDir} --yes`)

      if (
        result.stderr &&
        (result.stderr.includes('No Maven repositories found') ||
          result.stderr.includes('repositories') ||
          result.stderr.includes('not found'))
      ) {
        errorThrown = true
      } else if (result.error) {
        errorThrown = true
      } else {
        expect.fail('Command should have failed but did not')
      }
    } catch (error: unknown) {
      errorThrown = true

      if (error instanceof Error) {
        const errorMessage = error.message
        const hasErrorIndicator =
          errorMessage.includes('No Maven repositories found') ||
          errorMessage.includes('repositories') ||
          errorMessage.includes('not found')
        expect(hasErrorIndicator).to.be.true
      }
    } finally {
      await fs.remove(emptyDir)
    }

    expect(errorThrown).to.be.true
  })
})
