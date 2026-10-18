import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSandbox, type SinonSandbox} from 'sinon';
import {useUnauthenticatedGh} from '../../helpers/unauthenticated-gh.js';

interface ExtendedError extends Error {
	code?: string;
	oclif?: {exit: number};
	skipOclifErrorHandling?: boolean;
	suggestions?: string[];
	showHelp?: boolean;
	parse?: unknown;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

const makeRepository = (owner: string, name: string) => ({
	name,
	owner: {login: owner, type: 'User'},
	language: 'Java',
	topics: [],
	fork: false,
	archived: false,
	disabled: false,
	is_template: false,
	private: false,
	visibility: 'public',
});

const pipeToStdin = (sandbox: SinonSandbox, input: string) => {
	sandbox.stub(process.stdin, 'isTTY').value(false);
	Object.defineProperty(process.stdin, Symbol.asyncIterator, {
		async *value() {
			yield input;
		},
		configurable: true,
		writable: true,
	});
};

const createExistingRepo = async (directory: string, owner: string, name: string) => {
	const repoPath = path.join(directory, owner, name);
	await fs.ensureDir(repoPath);
	await fs.writeFile(path.join(repoPath, 'README.md'), 'existing content');
	return repoPath;
};

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
			const expectedError = new Error(
				'The following error occurred:\n  Missing required flag output-directory\nSee more help with --help',
			) as ExtendedError;
			expectedError.code = undefined;
			expectedError.oclif = {exit: 2};
			expectedError.skipOclifErrorHandling = undefined;
			expectedError.suggestions = undefined;
			expectedError.showHelp = false;
			expectedError.parse = (result.error as ExtendedError)?.parse; // Copy the circular reference

			expect(result).to.deep.equal({
				stdout: '',
				stderr: '',
				error: expectedError,
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
				stdout: `test-owner/test-repo: already exists\n`,
				stderr: '',
				result: {
					owner: 'test-owner',
					name: 'test-repo',
					path: repoPath,
					cloned: false,
					alreadyExists: true,
				},
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
								code: 'CLONE_FAILED',
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
								code: 'CLONE_FAILED',
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
		it('should explain once that gh is not authenticated', async () => {
			const restore = await useUnauthenticatedGh();
			try {
				const {error} = await runCommand(
					['repo:clone', '--output-directory', tempDir, '--owner', 'motlin', '--name', 'JUnit-Java-8-Runner'],
					root,
				);
				expect({message: error?.message, code: (error as ExtendedError | undefined)?.code}).to.deep.equal({
					message:
						'Failed to clone motlin/JUnit-Java-8-Runner: GitHub CLI is not authenticated. Run `gh auth login` or set the GH_TOKEN environment variable.',
					code: 'GH_NOT_AUTHENTICATED',
				});
			} finally {
				await restore();
			}
		});
	});

	describe('with stdin', () => {
		afterEach(() => {
			delete (process.stdin as unknown as Record<symbol, unknown>)[Symbol.asyncIterator];
		});

		it('should accept a single repository object from stdin', async () => {
			const repoPath = await createExistingRepo(tempDir, 'test-owner', 'test-repo');
			pipeToStdin(sandbox, JSON.stringify(makeRepository('test-owner', 'test-repo')));

			const result = await runCommand(['repo:clone', '--output-directory', tempDir], root);

			expect(result).to.deep.equal({
				stdout: 'test-owner/test-repo: already exists\n',
				stderr: '',
				result: {
					owner: 'test-owner',
					name: 'test-repo',
					path: repoPath,
					cloned: false,
					alreadyExists: true,
				},
			});
		});

		it('should accept the repo:list --json array output from stdin', async () => {
			const firstPath = await createExistingRepo(tempDir, 'test-owner', 'first-repo');
			const secondPath = await createExistingRepo(tempDir, 'other-owner', 'second-repo');
			const repoListOutput = JSON.stringify(
				[makeRepository('test-owner', 'first-repo'), makeRepository('other-owner', 'second-repo')],
				null,
				2,
			);
			pipeToStdin(sandbox, repoListOutput + '\n');

			const result = await runCommand(['repo:clone', '--output-directory', tempDir, '--json'], root);

			const expectedResult = [
				{
					owner: 'test-owner',
					name: 'first-repo',
					path: firstPath,
					cloned: false,
					alreadyExists: true,
				},
				{
					owner: 'other-owner',
					name: 'second-repo',
					path: secondPath,
					cloned: false,
					alreadyExists: true,
				},
			];

			expect(result).to.deep.equal({
				stdout: JSON.stringify(expectedResult, null, 2) + '\n',
				stderr: '',
				result: expectedResult,
			});
		});

		it('should log one line per repository for array input', async () => {
			const firstPath = await createExistingRepo(tempDir, 'test-owner', 'first-repo');
			const secondPath = await createExistingRepo(tempDir, 'other-owner', 'second-repo');
			pipeToStdin(
				sandbox,
				JSON.stringify([
					makeRepository('test-owner', 'first-repo'),
					makeRepository('other-owner', 'second-repo'),
				]),
			);

			const result = await runCommand(['repo:clone', '--output-directory', tempDir], root);

			expect(result).to.deep.equal({
				stdout: 'test-owner/first-repo: already exists\nother-owner/second-repo: already exists\n',
				stderr: '',
				result: [
					{
						owner: 'test-owner',
						name: 'first-repo',
						path: firstPath,
						cloned: false,
						alreadyExists: true,
					},
					{
						owner: 'other-owner',
						name: 'second-repo',
						path: secondPath,
						cloned: false,
						alreadyExists: true,
					},
				],
			});
		});

		it('should error on invalid JSON from stdin', async () => {
			pipeToStdin(sandbox, 'not json');

			const result = await runCommand(['repo:clone', '--output-directory', tempDir, '--json'], root);

			expect(result).to.deep.equal({
				stdout:
					JSON.stringify(
						{
							error: {
								code: 'INVALID_JSON',
								oclif: {exit: 1},
								suggestions: [
									'Ensure the input is valid JSON',
									'The input should be a repository object or the JSON array output of repo:list',
									'Example: {"name": "repo", "owner": {"login": "user"}}',
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
		it('should accept a minimal repository object with only name and owner.login', async () => {
			const repoPath = await createExistingRepo(tempDir, 'test-owner', 'test-repo');
			pipeToStdin(sandbox, '{"name": "test-repo", "owner": {"login": "test-owner"}}');

			const result = await runCommand(['repo:clone', '--output-directory', tempDir], root);

			expect(result).to.deep.equal({
				stdout: 'test-owner/test-repo: already exists\n',
				stderr: '',
				result: {
					owner: 'test-owner',
					name: 'test-repo',
					path: repoPath,
					cloned: false,
					alreadyExists: true,
				},
			});
		});

		it('should explain which field is missing when piped JSON is not a repository', async () => {
			pipeToStdin(sandbox, '["motlin/foo"]');

			const {error} = await runCommand(['repo:clone', '--output-directory', tempDir], root);

			expect({message: error?.message, code: (error as ExtendedError | undefined)?.code}).to.deep.equal({
				message: 'Invalid repository input from stdin: [0]: Invalid input: expected object, received string',
				code: 'INVALID_REPOSITORY_INPUT',
			});
		});

		it('should reject repository names that would escape the output directory', async () => {
			pipeToStdin(sandbox, '{"name": "../evil", "owner": {"login": "motlin"}}');

			const {error} = await runCommand(['repo:clone', '--output-directory', tempDir], root);

			expect({
				message: error?.message,
				code: (error as ExtendedError | undefined)?.code,
				escaped: await fs.pathExists(path.join(tempDir, 'evil')),
			}).to.deep.equal({
				message: 'Invalid repository input from stdin: name: Invalid GitHub repository name',
				code: 'INVALID_REPOSITORY_INPUT',
				escaped: false,
			});
		});
	});
});
