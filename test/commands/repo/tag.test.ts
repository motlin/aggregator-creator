import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createSandbox} from 'sinon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('repo:tag', () => {
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
		it.skip('should error when missing required flags', async () => {
			// FIXME: This test hangs because runCommand doesn't respect the process.stdin.isTTY stub
			const {error} = await runCommand(['repo:tag', '--topic', 'maven'], root);
			expect(error).to.exist;
			expect(error?.message).to.include('Both --owner and --name flags are required');
		});

		it.skip('should error when missing topic flag', async () => {
			// FIXME: @oclif/test v4 doesn't capture validation errors properly
			const result = await runCommand(['repo:tag', '--owner', 'motlin', '--name', 'test-repo'], root);
			// @oclif/test v4 only returns exit code for validation errors
			expect(result.error).to.exist;
			expect(result.error?.oclif?.exit).to.equal(2);
		});

		it('should handle GitHub API errors gracefully', async () => {
			// Use a non-existent repository to trigger an API error
			const {stdout} = await runCommand(
				[
					'repo:tag',
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

			const result = JSON.parse(stdout);
			expect(result).to.have.property('error');
			expect(result.error).to.have.property('oclif');
			expect(result.error.oclif).to.have.property('exit', 1);
		});

		it('should handle dry run mode', async () => {
			// Note: This will still try to fetch topics but won't update them
			const result = await runCommand(
				['repo:tag', '--owner', 'octocat', '--name', 'Hello-World', '--topic', 'maven', '--dryRun'],
				root,
			);

			// In dry run mode, it should fetch existing topics and show what would be done
			expect(result.stdout).to.include('Tagging repository: octocat/Hello-World');
			expect(result.stdout).to.include("[DRY RUN] Would add topic 'maven'");
			expect(result.error).to.be.undefined;
		});

		it('should return JSON output with --json flag on error', async () => {
			const {stdout} = await runCommand(
				['repo:tag', '--owner', 'octocat', '--name', 'Hello-World', '--topic', 'maven', '--json'],
				root,
			);

			const result = JSON.parse(stdout);
			expect(result).to.have.property('error');
			expect(result.error).to.have.property('oclif');
			expect(result.error.oclif).to.have.property('exit', 1);
		});
	});

	// Note: stdin tests are difficult to implement with @oclif/test
	// The command does support stdin input but testing it requires actual process spawning
	// which is beyond the scope of unit tests. This functionality would be tested in integration tests.
});
