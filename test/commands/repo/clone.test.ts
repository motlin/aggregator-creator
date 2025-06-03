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
		it('should error when missing required flags', async () => {
			const {error} = await runCommand(['repo:clone', '--output-directory', tempDir], root);
			expect(error?.message).to.include('Both --owner and --name flags are required');
		});

		it('should error when missing output-directory flag', async () => {
			const {error} = await runCommand(['repo:clone', '--owner', 'motlin', '--name', 'test-repo'], root);
			expect(error?.message).to.include('Missing required flag output-directory');
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

		it('should handle clone failure gracefully', async () => {
			// Use a non-existent repository to trigger a clone failure
			const {error} = await runCommand(
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

			expect(error?.message).to.include('Failed to clone repository');
		});

		it('should return error in JSON when clone fails with --json flag', async () => {
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

			const result = JSON.parse(stdout);
			expect(result).to.have.property('owner', 'non-existent-owner-12345');
			expect(result).to.have.property('name', 'non-existent-repo-67890');
			expect(result).to.have.property('cloned', false);
			expect(result).to.have.property('error');
			expect(result.error).to.include('Command failed');
		});
	});

	// Note: stdin tests are difficult to implement with @oclif/test
	// The command does support stdin input but testing it requires actual process spawning
	// which is beyond the scope of unit tests. This functionality would be tested in integration tests.
});
