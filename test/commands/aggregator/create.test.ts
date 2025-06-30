import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {createSandbox} from 'sinon';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('aggregator:create', () => {
	let tempDir: string;
	const sandbox = createSandbox();

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-test-'));

		const validRepo1 = path.join(tempDir, 'valid-repo1');
		const validRepo2 = path.join(tempDir, 'valid-repo2');
		const invalidRepo = path.join(tempDir, 'invalid-repo');

		await fs.ensureDir(validRepo1);
		await fs.ensureDir(validRepo2);
		await fs.ensureDir(invalidRepo);

		await fs.writeFile(path.join(validRepo1, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>');
		await fs.writeFile(path.join(validRepo2, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>');

		// Define the property first since it doesn't exist by default
		Object.defineProperty(process.stdin, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		// Now stub it
		sandbox.stub(process.stdin, 'isTTY').value(true);
	});

	afterEach(async () => {
		await fs.remove(tempDir);
		sandbox.restore();
	});

	it.skip('errors when no directory is provided', async () => {
		// FIXME: This test hangs because runCommand doesn't respect the process.stdin.isTTY stub
		// and waits for stdin input. Need to find a way to test this scenario.
		const result = await runCommand(['aggregator:create'], root);
		expect(result.error).to.exist;
		expect(result.error?.message).to.include(
			'No input provided. Provide a directory path or pipe JSON data from stdin.',
		);
		expect(result.error?.oclif?.exit).to.equal(1);
	});

	it('creates an aggregator POM with default values', async () => {
		const {stdout} = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);
		const output = JSON.parse(stdout);

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
		});

		const pomPath = path.join(tempDir, 'pom.xml');
		expect(fs.existsSync(pomPath)).to.be.true;

		const pomContent = await fs.readFile(pomPath, 'utf8');
		expect(pomContent).to.include('<parent>');
		expect(pomContent).to.include('<groupId>io.liftwizard</groupId>');
		expect(pomContent).to.include('<artifactId>liftwizard-profile-parent</artifactId>');
		expect(pomContent).to.match(/<version>\d+\.\d+\.\d+<\/version>/); // Matches semantic version
		expect(pomContent).to.include('<groupId>com.example</groupId>');
		expect(pomContent).to.include('<artifactId>aggregator</artifactId>');
		expect(pomContent).to.include('<version>1.0.0-SNAPSHOT</version>');
		expect(pomContent).to.include('<module>valid-repo1</module>');
		expect(pomContent).to.include('<module>valid-repo2</module>');
	});

	it('creates an aggregator POM with custom values', async () => {
		const {stdout} = await runCommand(
			[
				'aggregator:create',
				tempDir,
				'--groupId',
				'org.test',
				'--artifactId',
				'custom-agg',
				'--pomVersion',
				'2.0.0',
				'--yes',
				'--json',
			],
			root,
		);
		const output = JSON.parse(stdout);

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
				groupId: 'org.test',
				artifactId: 'custom-agg',
				version: '2.0.0',
			},
		});

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');
		expect(pomContent).to.include('<parent>');
		expect(pomContent).to.include('<groupId>io.liftwizard</groupId>');
		expect(pomContent).to.include('<artifactId>liftwizard-profile-parent</artifactId>');
		expect(pomContent).to.match(/<version>\d+\.\d+\.\d+<\/version>/); // Matches semantic version
		expect(pomContent).to.include('<groupId>org.test</groupId>');
		expect(pomContent).to.include('<artifactId>custom-agg</artifactId>');
		expect(pomContent).to.include('<version>2.0.0</version>');
	});

	it('outputs in json format when --json flag is provided', async () => {
		const {stdout} = await runCommand(['aggregator:create', tempDir, '--json', '--yes'], root);

		const output = JSON.parse(stdout);

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
		});
	});

	it('returns a structured error when no Maven repositories are found with --json flag', async () => {
		const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-dir-'));

		try {
			const {stdout} = await runCommand(['aggregator:create', emptyDir, '--json', '--yes'], root);

			const output = JSON.parse(stdout);

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
			});
		} finally {
			await fs.remove(emptyDir);
		}
	});
});
