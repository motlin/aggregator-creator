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

	it.skip('should error when no input is provided', async () => {
		// FIXME: This test hangs because runCommand doesn't respect the process.stdin.isTTY stub
		const {error} = await runCommand(['repo:process', outputDir, '--tag', 'maven'], root);

		expect(error?.oclif?.exit).to.equal(1);
		expect(error?.message).to.include('No input provided');
	});

	it.skip('should error when missing required tag flag', async () => {
		// FIXME: @oclif/test v4 doesn't capture validation errors properly
		const result = await runCommand(['repo:process', outputDir, '--owner', 'test', '--name', 'repo'], root);

		// @oclif/test v4 only returns exit code for validation errors
		expect(result.error).to.exist;
		expect(result.error?.oclif?.exit).to.equal(2);
	});

	it.skip('should error when missing output directory', async () => {
		// FIXME: @oclif/test v4 doesn't capture validation errors properly
		const result = await runCommand(['repo:process', '--tag', 'maven', '--owner', 'test', '--name', 'repo'], root);

		// @oclif/test v4 only returns exit code for validation errors
		expect(result.error).to.exist;
		expect(result.error?.oclif?.exit).to.equal(2);
	});

	it.skip('should accept flags for repository info', async () => {
		// FIXME: @oclif/test v4 doesn't capture command output properly when commands fail
		// Note: This will fail at the clone step since we're not mocking git
		const result = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven', '--json'],
			root,
		);

		if (result.stdout) {
			// Extract all complete JSON objects from stdout
			const jsonMatches = result.stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
			// The first JSON object should be the main result
			const mainResultJson = jsonMatches?.[0]?.trim();
			expect(mainResultJson).to.not.be.undefined;
			const parsedResult = JSON.parse(mainResultJson!);

			expect(parsedResult.name).to.equal('test-repo');
			expect(parsedResult.owner.login).to.equal('test-user');
			expect(parsedResult.cloned).to.equal(false);
			expect(parsedResult.error).to.include('Command failed');
		} else {
			// Command failed - this is expected since we're not mocking git
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(1);
		}
	});

	it.skip('should show non-JSON output when --json flag is not provided', async () => {
		// FIXME: @oclif/test v4 doesn't capture command errors properly
		const result = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven'],
			root,
		);

		// @oclif/test v4 doesn't capture error messages properly
		expect(result.error).to.exist;
		expect(result.error?.oclif?.exit).to.equal(1);
	});

	it.skip('should handle dry run flag', async () => {
		// FIXME: @oclif/test v4 doesn't capture command output properly when commands fail
		// The dry run flag would be passed to the tag command
		// This test validates that the flag is accepted
		const result = await runCommand(
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

		if (result.stdout) {
			// Extract all complete JSON objects from stdout
			const jsonMatches = result.stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
			// The first JSON object should be the main result
			const mainResultJson = jsonMatches?.[0]?.trim();
			expect(mainResultJson).to.not.be.undefined;
			const parsedResult = JSON.parse(mainResultJson!);

			// Will still fail at clone, but validates flag parsing
			expect(parsedResult.cloned).to.equal(false);
			expect(parsedResult.error).to.include('Command failed');
		} else {
			// Command failed - this is expected since we're not mocking git
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(1);
		}
	});

	it.skip('should handle verbose flag', async () => {
		// FIXME: @oclif/test v4 doesn't capture command output properly when commands fail
		// The verbose flag would affect output verbosity
		// This test validates that the flag is accepted
		const result = await runCommand(
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

		if (result.stdout) {
			// Extract all complete JSON objects from stdout
			const jsonMatches = result.stdout.match(/\{[\s\S]*?\}\n(?=\{|$)/g);
			// The first JSON object should be the main result
			const mainResultJson = jsonMatches?.[0]?.trim();
			expect(mainResultJson).to.not.be.undefined;
			const parsedResult = JSON.parse(mainResultJson!);

			// Will still fail at clone, but validates flag parsing
			expect(parsedResult.cloned).to.equal(false);
			expect(parsedResult.error).to.include('Command failed');
		} else {
			// Command failed - this is expected since we're not mocking git
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(1);
		}
	});
});
