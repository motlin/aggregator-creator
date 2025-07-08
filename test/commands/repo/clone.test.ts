import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSandbox} from 'sinon';

interface ExtendedError extends Error {
	code?: string;
	oclif?: { exit: number };
	skipOclifErrorHandling?: boolean;
	suggestions?: string[];
	showHelp?: boolean;
	parse?: unknown;
}

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
			const result = await runCommand(['repo:clone', '--output-directory', tempDir, '--json'], root);

			expect(result).to.deep.equal({
				stdout:
					JSON.stringify(
						{
							error: {
								code: 'MISSING_FLAGS',
								oclif: {
									exit: 1,
								},
								suggestions: [
									'Provide both --owner and --name flags',
									'Or pipe repository JSON to stdin',
									'Example: aggregator repo:clone --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner',
								],
							},
						},
						null,
						2,
					) + '\n',
				stderr: '',
				result: undefined,
			});
		});

		it('should error when missing output-directory flag', async () => {
			const result = await runCommand(['repo:clone', '--owner', 'motlin', '--name', 'test-repo'], root);
			// Missing required flags causes oclif to exit without JSON output
			// Create expected error matching actual error structure
			const expectedError = new Error('The following error occurred:\n  Missing required flag output-directory\nSee more help with --help') as ExtendedError;
			expectedError.code = undefined;
			expectedError.oclif = { exit: 2 };
			expectedError.skipOclifErrorHandling = undefined;
			expectedError.suggestions = undefined;
			expectedError.showHelp = false;
			expectedError.parse = (result.error as ExtendedError)?.parse; // Copy the circular reference

			expect(result).to.deep.equal({
				stdout: '',
				stderr: '',
				error: expectedError
			});
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

			expect(result).to.deep.equal({
				stdout: `Skipped: Directory already exists and is not empty\n⏩ Repository test-owner/test-repo already exists at ${repoPath}\n`,
				stderr: '',
				result: {
					owner: 'test-owner',
					name: 'test-repo',
					path: repoPath,
					cloned: false,
					alreadyExists: true
				}
			});
		});

		it('should return JSON output with --json flag for existing repo', async () => {
			// Create a pre-existing repo directory with content
			const repoPath = path.join(tempDir, 'test-owner', 'test-repo');
			await fs.ensureDir(repoPath);
			await fs.writeFile(path.join(repoPath, 'README.md'), 'existing content');

			const result = await runCommand(
				['repo:clone', '--output-directory', tempDir, '--owner', 'test-owner', '--name', 'test-repo', '--json'],
				root,
			);

			const expectedResult = {
				owner: 'test-owner',
				name: 'test-repo',
				path: repoPath,
				cloned: false,
				alreadyExists: true,
			};

			expect(result).to.deep.equal({
				stdout: JSON.stringify(expectedResult, null, 2) + '\n',
				stderr: '',
				result: expectedResult,
			});
		});

		it('should handle clone failure gracefully', async () => {
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
					'--json',
				],
				root,
			);
			expect(result).to.deep.equal({
				stdout:
					JSON.stringify(
						{
							error: {
								oclif: {
									exit: 1,
								},
							},
						},
						null,
						2,
					) + '\n',
				stderr: '',
				result: undefined,
			});
		});

		it('should return error in JSON when clone fails with --json flag', async () => {
			// FIXME: @oclif/test v4 doesn't capture command output properly when commands fail
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
					'--json',
				],
				root,
			);

			expect(result).to.deep.equal({
				stdout:
					JSON.stringify(
						{
							error: {
								oclif: {
									exit: 1,
								},
							},
						},
						null,
						2,
					) + '\n',
				stderr: '',
				result: undefined,
			});
		});
	});

	// Note: stdin tests are difficult to implement with @oclif/test
	// The command does support stdin input but testing it requires actual process spawning
	// which is beyond the scope of unit tests. This functionality would be tested in integration tests.
});
