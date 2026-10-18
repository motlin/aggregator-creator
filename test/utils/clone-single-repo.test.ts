import {expect} from 'chai';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import {restore, spy, stub} from 'sinon';
import {cloneSingleRepo} from '../../src/utils/clone-single-repo.js';
import {createMockResult} from './mock-result.js';

type ExecaParam = Parameters<typeof cloneSingleRepo>[3];

describe('cloneSingleRepo', () => {
	let tempDir: string;
	let execaStub: ReturnType<typeof stub>;
	let logger: {log: ReturnType<typeof spy>};

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clone-single-repo-test-'));
		execaStub = stub();
		logger = {log: spy()};
	});

	afterEach(async () => {
		restore();
		await fs.remove(tempDir);
	});

	it('clones into <target>/<owner>/<name> with gh and creates the owner directory', async () => {
		execaStub.resolves(createMockResult());
		const repoDir = path.join(tempDir, 'octo', 'widget');

		const result = await cloneSingleRepo('octo', 'widget', tempDir, execaStub as unknown as ExecaParam, logger);

		expect({
			result,
			execaArgs: execaStub.args,
			ownerDirExists: await fs.pathExists(path.join(tempDir, 'octo')),
			logs: logger.log.args,
		}).to.deep.equal({
			result: {owner: 'octo', name: 'widget', path: repoDir, cloned: true, skipped: false, error: null},
			execaArgs: [['gh', ['repo', 'clone', 'octo/widget', repoDir]]],
			ownerDirExists: true,
			logs: [],
		});
	});

	it('clones into an existing empty directory', async () => {
		const repoDir = path.join(tempDir, 'octo', 'widget');
		await fs.ensureDir(repoDir);
		execaStub.resolves(createMockResult());

		const result = await cloneSingleRepo('octo', 'widget', tempDir, execaStub as unknown as ExecaParam, logger);

		expect(result).to.deep.equal({
			owner: 'octo',
			name: 'widget',
			path: repoDir,
			cloned: true,
			skipped: false,
			error: null,
		});
	});

	it('skips a non-empty existing directory without calling gh', async () => {
		const repoDir = path.join(tempDir, 'octo', 'widget');
		await fs.ensureDir(repoDir);
		await fs.writeFile(path.join(repoDir, 'README.md'), 'existing');

		const result = await cloneSingleRepo('octo', 'widget', tempDir, execaStub as unknown as ExecaParam, logger);

		expect({result, execaCalls: execaStub.callCount, logs: logger.log.args}).to.deep.equal({
			result: {owner: 'octo', name: 'widget', path: repoDir, cloned: false, skipped: true, error: null},
			execaCalls: 0,
			logs: [['Skipped: Directory already exists and is not empty']],
		});
	});

	it('returns the gh error message when cloning fails', async () => {
		execaStub.rejects(new Error('GraphQL: Could not resolve to a Repository'));

		const result = await cloneSingleRepo('octo', 'missing', tempDir, execaStub as unknown as ExecaParam, logger);

		expect(result).to.deep.equal({
			owner: 'octo',
			name: 'missing',
			path: path.join(tempDir, 'octo', 'missing'),
			cloned: false,
			skipped: false,
			error: 'GraphQL: Could not resolve to a Repository',
		});
	});

	it('stringifies non-Error rejections', async () => {
		// eslint-disable-next-line prefer-promise-reject-errors -- exercising a non-Error rejection
		execaStub.callsFake(() => Promise.reject('plain failure'));

		const result = await cloneSingleRepo('octo', 'widget', tempDir, execaStub as unknown as ExecaParam);

		expect(result).to.deep.equal({
			owner: 'octo',
			name: 'widget',
			path: path.join(tempDir, 'octo', 'widget'),
			cloned: false,
			skipped: false,
			error: 'plain failure',
		});
	});
});
