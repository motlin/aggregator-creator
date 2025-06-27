import {expect} from 'chai';
import {restore, spy, stub} from 'sinon';
import {tagSingleRepository} from '../../src/utils/tag-single-repo.js';

type MockExeca = ReturnType<typeof stub>;

describe('tagSingleRepository', () => {
	let execaStub: MockExeca;
	let logger: {
		log: ReturnType<typeof spy>;
		warn: ReturnType<typeof spy>;
		error: ReturnType<typeof spy>;
	};

	beforeEach(() => {
		execaStub = stub();
		logger = {
			log: spy(),
			warn: spy(),
			error: spy(),
		};
	});

	afterEach(() => {
		restore();
	});

	it('tags a repository successfully', async () => {
		// Mock getting current topics
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: ['existing-topic']}),
			stderr: '',
		});

		// Mock updating topics
		execaStub
			.withArgs('gh', [
				'api',
				'repos/owner/repo/topics',
				'--method',
				'PUT',
				'-f',
				'names[]=existing-topic',
				'-f',
				'names[]=new-topic',
			])
			.resolves({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: true,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			topics: ['existing-topic', 'new-topic'],
			alreadyTagged: false,
		});

		expect(execaStub.callCount).to.equal(2);
	});

	it('handles repository that already has the topic', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: ['existing-topic', 'target-topic']}),
			stderr: '',
		});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'target-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: true,
			owner: 'owner',
			name: 'repo',
			topic: 'target-topic',
			topics: ['existing-topic', 'target-topic'],
			alreadyTagged: true,
		});

		expect(execaStub.callCount).to.equal(1);
		expect(logger.log.calledWith('Topic target-topic already exists on owner/repo')).to.be.true;
	});

	it('handles dry run mode', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: ['existing-topic']}),
			stderr: '',
		});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			dryRun: true,
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: true,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			topics: ['existing-topic', 'new-topic'],
			alreadyTagged: false,
		});

		expect(execaStub.callCount).to.equal(1);
		expect(logger.log.calledWith('[DRY RUN] Would add topic new-topic to owner/repo')).to.be.true;
	});

	it('handles error getting current topics', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 1,
			stdout: '',
			stderr: 'Not found',
		});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: false,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			error: 'Failed to get topics: Not found',
		});

		expect(logger.warn.calledWith('Failed to get topics: Not found')).to.be.true;
	});

	it('handles invalid JSON response', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: 'invalid json',
			stderr: '',
		});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result.success).to.be.false;
		expect(result.error).to.include('Error parsing topics');
		expect(logger.error.called).to.be.true;
	});

	it('handles error updating topics', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: ['existing-topic']}),
			stderr: '',
		});

		execaStub
			.withArgs('gh', [
				'api',
				'repos/owner/repo/topics',
				'--method',
				'PUT',
				'-f',
				'names[]=existing-topic',
				'-f',
				'names[]=new-topic',
			])
			.resolves({
				exitCode: 1,
				stdout: '',
				stderr: 'Permission denied',
			});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: false,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			error: 'Failed to update topics: Permission denied',
		});

		expect(logger.error.calledWith('Failed to update topics: Permission denied', {exit: false})).to.be.true;
	});

	it('handles exceptions during execution', async () => {
		execaStub.rejects(new Error('Network error'));

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: false,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			error: 'Network error',
		});

		expect(logger.error.calledWith('Failed to tag repository owner/repo: Network error', {exit: false})).to.be.true;
	});

	it('works without a logger', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: ['existing-topic']}),
			stderr: '',
		});

		execaStub
			.withArgs('gh', [
				'api',
				'repos/owner/repo/topics',
				'--method',
				'PUT',
				'-f',
				'names[]=existing-topic',
				'-f',
				'names[]=new-topic',
			])
			.resolves({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
		});

		expect(result).to.deep.equal({
			success: true,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			topics: ['existing-topic', 'new-topic'],
			alreadyTagged: false,
		});
	});

	it('handles repository with no existing topics', async () => {
		execaStub.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'GET']).resolves({
			exitCode: 0,
			stdout: JSON.stringify({names: []}),
			stderr: '',
		});

		execaStub
			.withArgs('gh', ['api', 'repos/owner/repo/topics', '--method', 'PUT', '-f', 'names[]=new-topic'])
			.resolves({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});

		const result = await tagSingleRepository({
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			execa: execaStub as Parameters<typeof tagSingleRepository>[0]['execa'],
			logger,
		});

		expect(result).to.deep.equal({
			success: true,
			owner: 'owner',
			name: 'repo',
			topic: 'new-topic',
			topics: ['new-topic'],
			alreadyTagged: false,
		});
	});
});
