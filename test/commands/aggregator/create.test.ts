import {describe, it, beforeEach, afterEach} from 'vite-plus/test';
import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import https from 'node:https';
import path from 'node:path';
import os from 'node:os';
import {createSandbox} from 'sinon';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('aggregator:create', () => {
	let tempDir: string;
	const sandbox = createSandbox();

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-test-'));

		const validRepo1 = path.join(tempDir, 'valid-repo1');
		const validRepo2 = path.join(tempDir, 'valid-repo2');
		const invalidRepo = path.join(tempDir, 'invalid-repo');

		await fs.ensureDir(validRepo1);
		await fs.ensureDir(validRepo2);
		await fs.ensureDir(invalidRepo);

		const validPom1 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example.test</groupId>
    <artifactId>valid-repo1</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		const validPom2 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example.test</groupId>
    <artifactId>valid-repo2</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(validRepo1, 'pom.xml'), validPom1);
		await fs.writeFile(path.join(validRepo2, 'pom.xml'), validPom2);

		Object.defineProperty(process.stdin, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		sandbox.stub(process.stdin, 'isTTY').value(true);
	});

	afterEach(async () => {
		await fs.remove(tempDir);
		sandbox.restore();
	});

	it('errors when no directory is provided', async () => {
		Object.defineProperty(process.stdin, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		sandbox.stub(process.stdin, 'isTTY').value(true);

		const result = await runCommand(['aggregator:create', '--json'], root);
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
								'Provide a directory path as an argument',
								'Pipe JSON data from repo:list or repo:process command',
								'Example: aggregator repo:list --owner someuser --json | aggregator aggregator:create ./output',
							],
						},
					},
					null,
					2,
				) + '\n',
			stderr: '',
		});
	});

	it('creates an aggregator POM with default values', async () => {
		const mockResponse = {
			statusCode: 200,
			on(event: string, callback: (data?: string) => void) {
				if (event === 'data') {
					callback(
						JSON.stringify({
							response: {
								docs: [
									{
										latestVersion: '2.1.1',
									},
								],
							},
						}),
					);
				} else if (event === 'end') {
					callback();
				}

				return this;
			},
		};

		sandbox.stub(https, 'get').callsFake((url, options, callback) => {
			if (typeof options === 'function') {
				callback = options;
			}
			callback!(mockResponse as Parameters<typeof https.get>[2] extends (res: infer R) => void ? R : never);
			return {
				on() {
					return this;
				},
			} as unknown as ReturnType<typeof https.get>;
		});

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const expectedResult = {
			success: true,
			pomPath: path.join(tempDir, 'pom.xml'),
			modules: [
				{
					path: 'valid-repo1',
					valid: true,
				},
				{
					path: 'valid-repo2',
					valid: true,
				},
			],
			stats: {
				totalScanned: 3,
				validRepositories: 2,
				skippedRepositories: 0,
			},
			mavenCoordinates: {
				groupId: 'com.example',
				artifactId: 'aggregator',
				version: '1.0.0-SNAPSHOT',
			},
		};

		expect(result).to.deep.equal({
			stdout: JSON.stringify(expectedResult, null, 2) + '\n',
			stderr: '',
			result: expectedResult,
		});

		const pomPath = path.join(tempDir, 'pom.xml');
		expect(fs.existsSync(pomPath)).to.be.true;

		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.include('<parent>');
		expect(pomContent).to.include('<groupId>io.liftwizard</groupId>');
		expect(pomContent).to.include('<artifactId>liftwizard-profile-parent</artifactId>');
		expect(pomContent).to.match(/<version>\d+\.\d+\.\d+<\/version>/);

		expect(pomContent).to.include('<groupId>com.example</groupId>');
		expect(pomContent).to.include('<artifactId>aggregator</artifactId>');
		expect(pomContent).to.include('<version>1.0.0-SNAPSHOT</version>');

		expect(pomContent).to.match(
			/<modules>[\s\S]*<module>valid-repo1<\/module>[\s\S]*<module>valid-repo2<\/module>[\s\S]*<\/modules>/,
		);

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const depMgmtMatches = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example\.test<\/groupId>[\s\S]*?<artifactId>valid-repo1<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(depMgmtMatches).to.not.be.null;

		const depMgmtMatches2 = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example\.test<\/groupId>[\s\S]*?<artifactId>valid-repo2<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(depMgmtMatches2).to.not.be.null;
	});

	it('creates an aggregator POM with custom values', async () => {
		const mockResponse = {
			statusCode: 200,
			on(event: string, callback: (data?: string) => void) {
				if (event === 'data') {
					callback(
						JSON.stringify({
							response: {
								docs: [
									{
										latestVersion: '2.1.1',
									},
								],
							},
						}),
					);
				} else if (event === 'end') {
					callback();
				}

				return this;
			},
		};

		sandbox.stub(https, 'get').callsFake((url, options, callback) => {
			if (typeof options === 'function') {
				callback = options;
			}
			callback!(mockResponse as Parameters<typeof https.get>[2] extends (res: infer R) => void ? R : never);
			return {
				on() {
					return this;
				},
			} as unknown as ReturnType<typeof https.get>;
		});
		const result = await runCommand(
			[
				'aggregator:create',
				tempDir,
				'--groupId',
				'org.test',
				'--artifactId',
				'custom-agg',
				'--pomVersion',
				'2.0.0',
				'--yes',
				'--json',
			],
			root,
		);

		const expectedResult = {
			success: true,
			pomPath: path.join(tempDir, 'pom.xml'),
			modules: [
				{
					path: 'valid-repo1',
					valid: true,
				},
				{
					path: 'valid-repo2',
					valid: true,
				},
			],
			stats: {
				totalScanned: 3,
				validRepositories: 2,
				skippedRepositories: 0,
			},
			mavenCoordinates: {
				groupId: 'org.test',
				artifactId: 'custom-agg',
				version: '2.0.0',
			},
		};

		expect(result).to.deep.equal({
			stdout: JSON.stringify(expectedResult, null, 2) + '\n',
			stderr: '',
			result: expectedResult,
		});

		const pomPath = path.join(tempDir, 'pom.xml');
		expect(fs.existsSync(pomPath)).to.be.true;

		const pomContent = await fs.readFile(pomPath, 'utf8');
		expect(pomContent).to.include('<parent>');
		expect(pomContent).to.include('<groupId>io.liftwizard</groupId>');
		expect(pomContent).to.include('<artifactId>liftwizard-profile-parent</artifactId>');
		expect(pomContent).to.match(/<version>\d+\.\d+\.\d+<\/version>/);
		expect(pomContent).to.include('<groupId>org.test</groupId>');
		expect(pomContent).to.include('<artifactId>custom-agg</artifactId>');
		expect(pomContent).to.include('<version>2.0.0</version>');
	});

	it('outputs in json format when --json flag is provided', async () => {
		const mockResponse = {
			statusCode: 200,
			on(event: string, callback: (data?: string) => void) {
				if (event === 'data') {
					callback(
						JSON.stringify({
							response: {
								docs: [
									{
										latestVersion: '2.1.1',
									},
								],
							},
						}),
					);
				} else if (event === 'end') {
					callback();
				}

				return this;
			},
		};

		sandbox.stub(https, 'get').callsFake((url, options, callback) => {
			if (typeof options === 'function') {
				callback = options;
			}
			callback!(mockResponse as Parameters<typeof https.get>[2] extends (res: infer R) => void ? R : never);
			return {
				on() {
					return this;
				},
			} as unknown as ReturnType<typeof https.get>;
		});

		const {stdout} = await runCommand(['aggregator:create', tempDir, '--json', '--yes'], root);

		const output = JSON.parse(stdout);

		expect(output).to.deep.equal({
			success: true,
			pomPath: path.join(tempDir, 'pom.xml'),
			modules: [
				{
					path: 'valid-repo1',
					valid: true,
				},
				{
					path: 'valid-repo2',
					valid: true,
				},
			],
			stats: {
				totalScanned: 3,
				validRepositories: 2,
				skippedRepositories: 0,
			},
			mavenCoordinates: {
				groupId: 'com.example',
				artifactId: 'aggregator',
				version: '1.0.0-SNAPSHOT',
			},
		});
	});

	it('returns a structured error when no Maven repositories are found with --json flag', async () => {
		const mockResponse = {
			statusCode: 200,
			on(event: string, callback: (data?: string) => void) {
				if (event === 'data') {
					callback(
						JSON.stringify({
							response: {
								docs: [
									{
										latestVersion: '2.1.1',
									},
								],
							},
						}),
					);
				} else if (event === 'end') {
					callback();
				}

				return this;
			},
		};

		sandbox.stub(https, 'get').callsFake((url, options, callback) => {
			if (typeof options === 'function') {
				callback = options;
			}
			callback!(mockResponse as Parameters<typeof https.get>[2] extends (res: infer R) => void ? R : never);
			return {
				on() {
					return this;
				},
			} as unknown as ReturnType<typeof https.get>;
		});

		const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-dir-'));

		try {
			const {stdout} = await runCommand(['aggregator:create', emptyDir, '--json', '--yes'], root);

			const output = JSON.parse(stdout);

			expect(output).to.deep.equal({
				success: false,
				pomPath: '',
				modules: [],
				stats: {
					totalScanned: 0,
					validRepositories: 0,
					skippedRepositories: 0,
				},
				mavenCoordinates: {
					groupId: 'com.example',
					artifactId: 'aggregator',
					version: '1.0.0-SNAPSHOT',
				},
				error: 'No Maven repositories found. Each repository must contain a pom.xml file.',
			});
		} finally {
			await fs.remove(emptyDir);
		}
	});

	it('errors instead of creating the directory when it does not exist', async () => {
		const missingDir = path.join(tempDir, 'does-not-exist');

		const {error} = await runCommand(['aggregator:create', missingDir, '--yes'], root);

		expect({
			message: error?.message,
			code: (error as {code?: string} | undefined)?.code,
			created: await fs.pathExists(missingDir),
		}).to.deep.equal({
			message: `Directory does not exist: ${missingDir}`,
			code: 'DIRECTORY_NOT_FOUND',
			created: false,
		});
	});

	it('skips repositories with a malformed pom.xml and reports why', async () => {
		const malformedRepo = path.join(tempDir, 'owner', 'malformed-repo');
		await fs.ensureDir(malformedRepo);
		await fs.writeFile(path.join(malformedRepo, 'pom.xml'), '<project><groupId>broken</groupId');

		const {stdout} = await runCommand(['aggregator:create', tempDir, '--json', '--yes'], root);

		const output = JSON.parse(stdout);

		expect({modules: output.modules, stats: output.stats}).to.deep.equal({
			modules: [
				{path: 'valid-repo1', valid: true},
				{path: 'valid-repo2', valid: true},
				{
					path: path.join('owner', 'malformed-repo'),
					valid: false,
					reason: 'Malformed pom.xml: XML parsing failed: Unclosed root tag\nLine: 0\nColumn: 33\nChar: ',
				},
			],
			stats: {
				totalScanned: 5,
				validRepositories: 2,
				skippedRepositories: 1,
			},
		});
	});

	it('uses the latest liftwizard-profile-parent version that maven-dependency-plugin resolves into the local repository', async () => {
		const fakeHome = path.join(tempDir, 'fake-home');
		const liftwizardVersionsDir = path.join(
			fakeHome,
			'.m2',
			'repository',
			'io',
			'liftwizard',
			'liftwizard-profile-parent',
		);
		await fs.ensureDir(path.join(liftwizardVersionsDir, '2.1.9'));
		await fs.ensureDir(path.join(liftwizardVersionsDir, '2.1.40'));

		const fakeBin = path.join(tempDir, 'fake-bin');
		await fs.outputFile(
			path.join(fakeBin, 'mvn'),
			'#!/bin/sh\n[ "$1" = "org.apache.maven.plugins:maven-dependency-plugin:3.6.0:get" ] && [ "$2" = "-Dartifact=io.liftwizard:liftwizard-profile-parent:LATEST:pom" ] && exit 0\nexit 1\n',
			{mode: 0o755},
		);
		sandbox.stub(process.env, 'PATH').value(`${fakeBin}${path.delimiter}${process.env.PATH}`);
		sandbox.stub(process.env, 'HOME').value(fakeHome);
		await fs.remove(path.join(tempDir, 'invalid-repo'));

		await runCommand(['aggregator:create', tempDir, '--yes', '--json', '--no-rewriteDependencies'], root);

		const pomContent = await fs.readFile(path.join(tempDir, 'pom.xml'), 'utf8');
		expect(pomContent).to.include(`<parent>
    <groupId>io.liftwizard</groupId>
    <artifactId>liftwizard-profile-parent</artifactId>
    <version>2.1.40</version>
  </parent>`);
	});
});
