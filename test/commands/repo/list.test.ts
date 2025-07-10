import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

// Skip GitHub API tests in CI to avoid rate limiting issues
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

describe('repo:list', function () {
	this.timeout(10_000);

	it('should verify GitHub CLI is authenticated', async () => {
		const {execa} = await import('execa');
		try {
			const {stdout} = await execa('gh', ['auth', 'status']);
			console.log('GitHub auth status:', stdout);
		} catch (error) {
			console.error('GitHub auth check failed:', error instanceof Error ? error.message : error);
			if (error && typeof error === 'object' && 'stdout' in error) console.log('stdout:', error.stdout);
			if (error && typeof error === 'object' && 'stderr' in error) console.log('stderr:', error.stderr);
			throw error;
		}
	});

	it('should fetch octocat HTML repos via direct API call', async function () {
		if (isCI) {
			this.skip();
		}
		const {execa} = await import('execa');
		try {
			const query = 'user:octocat language:HTML fork:false archived:false';
			const {stdout} = await execa('gh', [
				'api',
				'-X',
				'GET',
				'search/repositories',
				'-f',
				`q=${query}`,
				'-f',
				'per_page=1',
				'-f',
				'sort=created',
				'-f',
				'order=asc',
				'--jq',
				'.items',
			]);
			const repos = JSON.parse(stdout);
			console.log('Direct API response:', JSON.stringify(repos, null, 2));
			expect(repos).to.have.length(1);
			expect(repos[0].name).to.equal('Spoon-Knife');
		} catch (error) {
			console.error('Direct API call failed:', error instanceof Error ? error.message : error);
			if (error && typeof error === 'object' && 'stdout' in error) console.log('stdout:', error.stdout);
			if (error && typeof error === 'object' && 'stderr' in error) console.log('stderr:', error.stderr);
			throw error;
		}
	});

	it('should fetch repositories with specific search criteria', async function () {
		if (isCI) {
			this.skip();
		}
		const {stdout} = await runCommand(
			['repo:list', '--user', 'torvalds', '--language', 'C', '--json', '--limit', '2'],
			root,
		);

		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'linux',
				owner: {login: 'torvalds', type: 'User'},
				language: 'C',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'uemacs',
				owner: {login: 'torvalds', type: 'User'},
				language: 'C',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});

	it('should fetch repositories for specified user', async function () {
		if (isCI) {
			this.skip();
		}
		const expected = [
			{
				name: 'jetbrains-settings',
				owner: {login: 'motlin', type: 'User'},
				language: null,
				topics: ['color-scheme', 'jetbrains', 'syntax-highlighting'],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		];

		const {stdout} = await runCommand(['repo:list', '--user', 'motlin', '--json', '--limit', '1'], root);
		expect(JSON.parse(stdout)).to.deep.equal(expected);
	});

	it('should fetch repositories for freeCodeCamp user', async function () {
		if (isCI) {
			this.skip();
		}
		const {stdout} = await runCommand(['repo:list', '--user', 'freeCodeCamp', '--json', '--limit', '1'], root);

		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'freeCodeCamp',
				owner: {login: 'freeCodeCamp', type: 'Organization'},
				language: 'TypeScript',
				topics: [
					'careers',
					'certification',
					'community',
					'curriculum',
					'd3',
					'education',
					'freecodecamp',
					'hacktoberfest',
					'javascript',
					'learn-to-code',
					'math',
					'nodejs',
					'nonprofits',
					'programming',
					'react',
					'teachers',
				],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});

	it('should support multiple language filters', async function () {
		if (isCI) {
			this.skip();
		}
		const {stdout} = await runCommand(
			['repo:list', '--user', 'motlin', '--language', 'Java', '--language', 'TypeScript', '--json'],
			root,
		);
		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'hex-zero',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: ['browser-game', 'game'],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'avalon-analytics',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'checkstyle-results',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'aggregator-creator',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: ['aggregator', 'maven', 'oclif'],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'factorio-blueprint-playground',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'typescript-template',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'JUnit-Java-8-Runner',
				owner: {login: 'motlin', type: 'User'},
				language: 'Java',
				topics: ['maven'],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
			{
				name: 'factorio-icon-cdn',
				owner: {login: 'motlin', type: 'User'},
				language: 'TypeScript',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});

	it('should include forked repositories when --include-forks flag is provided', async function () {
		if (isCI) {
			this.skip();
		}
		const {stdout} = await runCommand(
			['repo:list', '--user', 'octocat', '--language', 'HTML', '--include-forks', '--json', '--limit', '1'],
			root,
		);
		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'Spoon-Knife',
				owner: {login: 'octocat', type: 'User'},
				language: 'HTML',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});

	it('should include archived repositories when --include-archived flag is provided', async function () {
		if (isCI) {
			this.skip();
		}
		const {stdout} = await runCommand(
			['repo:list', '--user', 'octocat', '--language', 'HTML', '--include-archived', '--json', '--limit', '1'],
			root,
		);
		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'Spoon-Knife',
				owner: {login: 'octocat', type: 'User'},
				language: 'HTML',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});

	it('should support combining include flags', async function () {
		if (isCI) {
			this.skip();
		}
		const result = await runCommand(
			[
				'repo:list',
				'--user',
				'octocat',
				'--language',
				'HTML',
				'--include-forks',
				'--include-archived',
				'--json',
				'--limit',
				'1',
			],
			root,
		);

		if ('error' in result) {
			console.error('Command failed with error:', result.error);
			if (result.stderr) {
				console.error('stderr:', result.stderr);
			}
		}

		const {stdout} = result;
		expect(JSON.parse(stdout)).to.deep.equal([
			{
				name: 'Spoon-Knife',
				owner: {login: 'octocat', type: 'User'},
				language: 'HTML',
				topics: [],
				fork: false,
				archived: false,
				disabled: false,
				is_template: false,
				private: false,
				visibility: 'public',
			},
		]);
	});
});
