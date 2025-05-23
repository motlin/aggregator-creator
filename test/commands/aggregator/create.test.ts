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
    const result = await runCommand('aggregator:create')
    expect(result).to.deep.equal({
      error: new Error(
        'Missing 1 required arg:\ndirectory  Directory containing final Maven repos\nSee more help with --help',
      ),
      stdout: '',
      stderr: '',
    })
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

    expect(output).to.deep.equal({
      success: true,
      pomPath: path.join(tempDir, 'pom.xml'),
      modules: [
        {
          path: 'valid-repo1',
          valid: true,
        },
        {
          path: 'valid-repo2',
          valid: true,
        },
      ],
      stats: {
        totalScanned: 3,
        validRepositories: 2,
        skippedRepositories: 0,
        elapsedTimeMs: output.stats.elapsedTimeMs,
      },
      mavenCoordinates: {
        groupId: 'com.example',
        artifactId: 'aggregator',
        version: '1.0.0-SNAPSHOT',
      },
    })
  })

  it('returns a structured error when no Maven repositories are found with --json flag', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-dir-'))

    try {
      const {stdout} = await runCommand(`aggregator:create ${emptyDir} --json --yes`)

      const output = JSON.parse(stdout)

      expect(output).to.deep.equal({
        success: false,
        pomPath: '',
        modules: [],
        stats: {
          totalScanned: 0,
          validRepositories: 0,
          skippedRepositories: 0,
          elapsedTimeMs: output.stats.elapsedTimeMs,
        },
        mavenCoordinates: {
          groupId: 'com.example',
          artifactId: 'aggregator',
          version: '1.0.0-SNAPSHOT',
        },
        error: 'No Maven repositories found. Each repository must contain a pom.xml file.',
      })
    } finally {
      await fs.remove(emptyDir)
    }
  })
})
