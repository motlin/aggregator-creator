import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSandbox} from 'sinon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('repo:clone', () => {
	let tempDir: string;
	const sandbox = createSandbox();

	beforeEach(async () => {
		tempDir = path.join(process.cwd(), 'test-temp-clone-dir');
		await fs.ensureDir(tempDir);

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
		sandbox.restore();
		if (await fs.pathExists(tempDir)) {
			await fs.remove(tempDir);
		}
	});

	describe('with flags', () => {
		it.skip('should error when missing required flags', async () => {
			// FIXME: This test hangs because runCommand doesn't respect the process.stdin.isTTY stub
			const {error} = await runCommand(['repo:clone', '--output-directory', tempDir], root);
			expect(error).to.exist;
			expect(error?.message).to.include('Both --owner and --name flags are required');
		});

		it.skip('should error when missing output-directory flag', async () => {
			// FIXME: @oclif/test v4 doesn't capture validation errors properly
			const result = await runCommand(['repo:clone', '--owner', 'motlin', '--name', 'test-repo'], root);
			// @oclif/test v4 only returns exit code for validation errors
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(2);
		});

		it('should handle already existing repository', async () => {
			// Create a pre-existing repo directory with content
			const repoPath = path.join(tempDir, 'test-owner', 'test-repo');
			await fs.ensureDir(repoPath);
			await fs.writeFile(path.join(repoPath, 'README.md'), 'existing content');

			// Verify the directory exists before running the command
			const exists = await fs.pathExists(repoPath);
			expect(exists).to.be.true;
			const files = await fs.readdir(repoPath);
			expect(files).to.include('README.md');

			const result = await runCommand(
				['repo:clone', '--output-directory', tempDir, '--owner', 'test-owner', '--name', 'test-repo'],
				root,
			);

			expect(result.stdout).to.include('Skipped: Directory already exists and is not empty');
			expect(result.stdout).to.include('already exists');
			expect(result.stdout).to.include('test-owner/test-repo');
		});

		it('should return JSON output with --json flag for existing repo', async () => {
			// Create a pre-existing repo directory with content
			const repoPath = path.join(tempDir, 'test-owner', 'test-repo');
			await fs.ensureDir(repoPath);
			await fs.writeFile(path.join(repoPath, 'README.md'), 'existing content');

			const {stdout} = await runCommand(
				['repo:clone', '--output-directory', tempDir, '--owner', 'test-owner', '--name', 'test-repo', '--json'],
				root,
			);

			const result = JSON.parse(stdout);
			expect(result).to.have.property('owner', 'test-owner');
			expect(result).to.have.property('name', 'test-repo');
			expect(result).to.have.property('path', repoPath);
			expect(result).to.have.property('cloned', false);
			expect(result).to.have.property('alreadyExists', true);
		});

		it.skip('should handle clone failure gracefully', async () => {
			// FIXME: @oclif/test v4 doesn't capture command errors properly
			// Use a non-existent repository to trigger a clone failure
			const result = await runCommand(
				[
					'repo:clone',
					'--output-directory',
					tempDir,
					'--owner',
					'non-existent-owner-12345',
					'--name',
					'non-existent-repo-67890',
				],
				root,
			);

			// @oclif/test v4 doesn't capture command errors properly
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(1);
		});

		it.skip('should return error in JSON when clone fails with --json flag', async () => {
			// FIXME: @oclif/test v4 doesn't capture command output properly when commands fail
			// Use a non-existent repository to trigger a clone failure
			const {stdout} = await runCommand(
				[
					'repo:clone',
					'--output-directory',
					tempDir,
					'--owner',
					'non-existent-owner-12345',
					'--name',
					'non-existent-repo-67890',
					'--json',
				],
				root,
			);

			if (stdout) {
				const result = JSON.parse(stdout);
				expect(result).to.have.property('owner', 'non-existent-owner-12345');
				expect(result).to.have.property('name', 'non-existent-repo-67890');
				expect(result).to.have.property('cloned', false);
				expect(result).to.have.property('error');
				expect(result.error).to.include('Command failed');
			} else {
				// If stdout is empty, the command errored before producing output
				expect.fail('Expected JSON output but got none');
			}
		});
	});

	// Note: stdin tests are difficult to implement with @oclif/test
	// The command does support stdin input but testing it requires actual process spawning
	// which is beyond the scope of unit tests. This functionality would be tested in integration tests.
});
