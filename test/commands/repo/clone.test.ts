import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import {createSandbox} from 'sinon';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('repo:clone', () => {
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

	it('errors when no arguments provided', async () => {
		const result = await runCommand(['repo:clone'], root);
		expect(result).to.deep.equal({
			error: new Error(
				'Missing 1 required arg:\ntargetDirectory  Directory to clone repositories into\nSee more help with --help',
			),
			stdout: '',
			stderr: '',
		});
	});

	it('errors when no stdin input provided', async () => {
		const result = await runCommand(['repo:clone', './test-dir'], root);

		const expectedError = new Error(
			'No input provided. This command expects repository data from stdin.',
		) as Error & {
			oclif: {exit: number};
			code: string;
			suggestions: string[];
		};
		expectedError.oclif = {exit: 1};
		expectedError.code = 'NO_INPUT';
		expectedError.suggestions = [
			'Pipe repository data into this command',
			'Example: echo "owner/repo" | aggregator repo:clone ./target-dir',
			'Example: aggregator repo:list --user someuser --json | aggregator repo:clone ./target-dir',
		];

		expect(result).to.deep.equal({
			error: expectedError,
			stdout: '',
			stderr: '',
		});
	});
});
