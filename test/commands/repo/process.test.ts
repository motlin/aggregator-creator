import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import {createSandbox} from 'sinon';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

interface ExtendedError extends Error {
	code?: string;
	oclif?: {exit: number};
	skipOclifErrorHandling?: boolean;
	suggestions?: string[];
	showHelp?: boolean;
	parse?: unknown;
	args?: unknown;
}

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
		const result = await runCommand(['repo:process', outputDir, '--tag', 'maven', '--json'], root);
		expect(result).to.deep.equal({
			result: undefined,
			stdout:
				JSON.stringify(
					{
						error: {
							code: 'NO_INPUT',
							oclif: {
								exit: 1,
							},
							suggestions: [
								'Provide --owner and --name flags',
								'Or pipe repository JSON from stdin',
								'Example: aggregator repo:process ./output --owner motlin --name JUnit-Java-8-Runner --tag maven',
							],
						},
					},
					null,
					2,
				) + '\n',
			stderr: '',
		});
	});

	it('should error when missing required tag flag', async () => {
		const result = await runCommand(['repo:process', outputDir, '--owner', 'test', '--name', 'repo'], root);
		// Missing required flags causes oclif to exit without JSON output
		// Create expected error matching actual error structure
		const expectedError = new Error(
			'The following error occurred:\n  Missing required flag tag\nSee more help with --help',
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

	it('should error when missing output directory', async () => {
		const result = await runCommand(['repo:process', '--tag', 'maven', '--owner', 'test', '--name', 'repo'], root);
		// Missing required arguments causes oclif to exit without JSON output
		// Create expected error matching actual error structure
		const expectedError = new Error(
			'Missing 1 required arg:\noutput-directory  Directory where the repository will be cloned\nSee more help with --help',
		) as ExtendedError;
		expectedError.code = undefined;
		expectedError.oclif = {exit: 2};
		expectedError.skipOclifErrorHandling = undefined;
		expectedError.suggestions = undefined;
		expectedError.showHelp = true;
		expectedError.parse = (result.error as ExtendedError)?.parse; // Copy the circular reference
		expectedError.args = (result.error as ExtendedError)?.args; // Copy the args property

		expect(result).to.deep.equal({
			stdout: '',
			stderr: '',
			error: expectedError,
		});
	});

	it('should accept flags for repository info', async () => {
		// Note: This will fail at the clone step since we're not mocking git
		const result = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven', '--json'],
			root,
		);

		const expectedPath = path.join(outputDir, 'test-user', 'test-repo');
		const expectedResult = {
			name: 'test-repo',
			owner: {login: 'test-user'},
			path: expectedPath,
			cloned: false,
			valid: false,
			tagged: false,
			error: `Command failed with exit code 1: gh repo clone test-user/test-repo ${expectedPath}\n\nGraphQL: Could not resolve to a Repository with the name 'test-user/test-repo'. (repository)`,
		};

		expect(result).to.deep.equal({
			result: expectedResult,
			stderr: '',
			stdout: JSON.stringify(expectedResult, null, 2) + '\n',
		});
	});

	it('should show non-JSON output when --json flag is not provided', async () => {
		const result = await runCommand(
			['repo:process', outputDir, '--owner', 'test-user', '--name', 'test-repo', '--tag', 'maven'],
			root,
		);

		const expectedPath = path.join(outputDir, 'test-user', 'test-repo');
		const expectedResult = {
			name: 'test-repo',
			owner: {login: 'test-user'},
			path: expectedPath,
			cloned: false,
			valid: false,
			tagged: false,
			error: `Command failed with exit code 1: gh repo clone test-user/test-repo ${expectedPath}\n\nGraphQL: Could not resolve to a Repository with the name 'test-user/test-repo'. (repository)`,
		};

		expect(result).to.deep.equal({
			result: expectedResult,
			stderr: '',
			stdout: '╭─── 🔄 Processing repository test-user/test-repo...\n│\n├──╮ 📥 Cloning repository...\n├──╯ ❌ Failed to clone repository\n├──╯\n│\n╰─── ❌ Processing failed\n',
		});
	});

	it('should handle dry run flag', async () => {
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

		const expectedPath = path.join(outputDir, 'test-user', 'test-repo');
		const expectedResult = {
			name: 'test-repo',
			owner: {login: 'test-user'},
			path: expectedPath,
			cloned: false,
			valid: false,
			tagged: false,
			error: `Command failed with exit code 1: gh repo clone test-user/test-repo ${expectedPath}\n\nGraphQL: Could not resolve to a Repository with the name 'test-user/test-repo'. (repository)`,
		};

		expect(result).to.deep.equal({
			result: expectedResult,
			stderr: '',
			stdout: JSON.stringify(expectedResult, null, 2) + '\n',
		});
	});

	it('should handle verbose flag', async () => {
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

		const expectedPath = path.join(outputDir, 'test-user', 'test-repo');
		const expectedResult = {
			name: 'test-repo',
			owner: {login: 'test-user'},
			path: expectedPath,
			cloned: false,
			valid: false,
			tagged: false,
			error: `Command failed with exit code 1: gh repo clone test-user/test-repo ${expectedPath}\n\nGraphQL: Could not resolve to a Repository with the name 'test-user/test-repo'. (repository)`,
		};

		expect(result).to.deep.equal({
			result: expectedResult,
			stderr: '',
			stdout: JSON.stringify(expectedResult, null, 2) + '\n',
		});
	});
});
