import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createSandbox} from 'sinon';

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

describe('repo:topic', () => {
	const sandbox = createSandbox();

	beforeEach(() => {
		// Define the property first since it doesn't exist by default
		Object.defineProperty(process.stdin, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		// Now stub it
		sandbox.stub(process.stdin, 'isTTY').value(true);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('with flags', () => {
		it('should error when missing required flags', async () => {
			const result = await runCommand(['repo:topic', '--topic', 'maven', '--json'], root);
			expect(result).to.deep.equal({
				result: undefined,
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
									'Example: aggregator repo:topic --owner motlin --name JUnit-Java-8-Runner --topic maven',
								],
							},
						},
						null,
						2,
					) + '\n',
				stderr: '',
			});
		});

		it('should error when missing topic flag', async () => {
			const result = await runCommand(['repo:topic', '--owner', 'motlin', '--name', 'test-repo'], root);
			// Missing required flags causes oclif to exit without JSON output
			// Create expected error matching actual error structure
			const expectedError = new Error(
				'The following error occurred:\n  Missing required flag topic\nSee more help with --help',
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

		it('should handle GitHub API errors gracefully', async () => {
			// Use a non-existent repository to trigger an API error
			const {stdout} = await runCommand(
				[
					'repo:topic',
					'--owner',
					'non-existent-user-12345',
					'--name',
					'non-existent-repo-67890',
					'--topic',
					'maven',
					'--json',
				],
				root,
			);

			const jsonOutput = JSON.parse(stdout);
			// The command exits with an error
			expect(jsonOutput).to.deep.equal({
				error: {
					code: 'EEXIT',
					oclif: {
						exit: 1,
					},
				},
			});
		});

		it('should handle dry run mode', async () => {
			// Note: This will still try to fetch topics but won't update them
			const result = await runCommand(
				['repo:topic', '--owner', 'octocat', '--name', 'Hello-World', '--topic', 'maven', '--dryRun'],
				root,
			);

			// In dry run mode, it should fetch existing topics and show what would be done
			expect(result).to.deep.equal({
				stdout: "╭─── 🏷️  Adding github topic to repository: octocat/Hello-World\n│\n[DRY RUN] Would add topic maven to octocat/Hello-World\n├──╯ 🔍 [DRY RUN] Would add github topic 'maven'\n│\n╰─── 🏷️  Github topic operation complete\n",
				stderr: '',
				result: {
					owner: 'octocat',
					name: 'Hello-World',
					topics: ['maven'],
					topicAdded: false,
				},
			});
		});

		it('should return JSON output with --json flag on error', async () => {
			const {stdout} = await runCommand(
				['repo:topic', '--owner', 'octocat', '--name', 'Hello-World', '--topic', 'maven', '--json'],
				root,
			);

			const jsonOutput = JSON.parse(stdout);
			// The command exits with an error
			expect(jsonOutput).to.deep.equal({
				error: {
					code: 'EEXIT',
					oclif: {
						exit: 1,
					},
				},
			});
		});
	});

	// Note: stdin tests are difficult to implement with @oclif/test
	// The command does support stdin input but testing it requires actual process spawning
	// which is beyond the scope of unit tests. This functionality would be tested in integration tests.
});
