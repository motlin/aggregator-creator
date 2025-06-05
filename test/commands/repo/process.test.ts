import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import {createSandbox} from 'sinon';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('repo:process', () => {
	const sandbox = createSandbox();
	let outputDir: string;

	beforeEach(async () => {
		// Define the property first since it doesn't exist by default
		Object.defineProperty(process.stdin, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		// Now stub it
		sandbox.stub(process.stdin, 'isTTY').value(true);

		outputDir = path.join(__dirname, '../../temp', `test-output-${Date.now()}`);
		await fs.ensureDir(outputDir);
	});

	afterEach(async () => {
		sandbox.restore();
		await fs.remove(outputDir);
	});

	it('should error when no input is provided', async () => {
		const {error} = await runCommand(['repo:process', outputDir, '--tag', 'maven'], root);

		expect(error?.oclif?.exit).to.equal(1);
		expect(error?.message).to.include('No input provided');
	});

	it('should error when missing required tag flag', async () => {
		const {error} = await runCommand(['repo:process', outputDir, '--owner', 'test', '--name', 'repo'], root);

		expect(error?.message).to.include('Missing required flag tag');
	});

	it('should error when missing output directory', async () => {
		const {error} = await runCommand(['repo:process', '--tag', 'maven', '--owner', 'test', '--name', 'repo'], root);

		expect(error?.message).to.include('Missing 1 required arg');
		expect(error?.message).to.include('output-directory');
	});

	it('should accept flags for repository info', async () => {
		// Note: This will fail at the clone step since we're not mocking git
		const {stdout} = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven', '--json'],
			root,
		);

		// Extract all complete JSON objects from stdout
		const jsonMatches = stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
		// The first JSON object should be the main result
		const mainResultJson = jsonMatches?.[0]?.trim();
		expect(mainResultJson).to.not.be.undefined;
		const result = JSON.parse(mainResultJson!);

		expect(result.name).to.equal('test-repo');
		expect(result.owner.login).to.equal('test-user');
		expect(result.cloned).to.equal(false);
		expect(result.error).to.include('Command failed');
	});

	it('should show non-JSON output when --json flag is not provided', async () => {
		const {error} = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven'],
			root,
		);

		expect(error?.oclif?.exit).to.equal(1);
		expect(error?.message).to.include('Failed to process repository');
		// Since we're not mocking, it will fail at git clone
	});

	it('should handle dry run flag', async () => {
		// The dry run flag would be passed to the tag command
		// This test validates that the flag is accepted
		const {stdout} = await runCommand(
			[
				'repo:process',
				outputDir,
				'--owner',
				'test-user',
				'--name',
				'test-repo',
				'--tag',
				'maven',
				'--dryRun',
				'--json',
			],
			root,
		);

		// Extract all complete JSON objects from stdout
		const jsonMatches = stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
		// The first JSON object should be the main result
		const mainResultJson = jsonMatches?.[0]?.trim();
		expect(mainResultJson).to.not.be.undefined;
		const result = JSON.parse(mainResultJson!);

		// Will still fail at clone, but validates flag parsing
		expect(result.cloned).to.equal(false);
		expect(result.error).to.include('Command failed');
	});

	it('should handle verbose flag', async () => {
		// The verbose flag would affect output verbosity
		// This test validates that the flag is accepted
		const {stdout} = await runCommand(
			[
				'repo:process',
				outputDir,
				'--owner',
				'test-user',
				'--name',
				'test-repo',
				'--tag',
				'maven',
				'--verbose',
				'--json',
			],
			root,
		);

		// Extract all complete JSON objects from stdout
		const jsonMatches = stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
		// The first JSON object should be the main result
		const mainResultJson = jsonMatches?.[0]?.trim();
		expect(mainResultJson).to.not.be.undefined;
		const result = JSON.parse(mainResultJson!);

		// Will still fail at clone, but validates flag parsing
		expect(result.cloned).to.equal(false);
		expect(result.error).to.include('Command failed');
	});
});
