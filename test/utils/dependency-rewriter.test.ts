import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {DependencyRewriter} from '../../src/utils/dependency-rewriter.js';
import MavenGAVCoords from '../../src/maven-gav.js';
import {createSandbox, type SinonStub} from 'sinon';

describe('DependencyRewriter', () => {
	let tempDir: string;
	let mockExeca: SinonStub;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-rewriter-test-'));
		const sandbox = createSandbox();
		mockExeca = sandbox.stub();
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	it('should rewrite dependencies in child poms', async () => {
		// Create test structure
		const module1Dir = path.join(tempDir, 'module1');
		const module2Dir = path.join(tempDir, 'module2');
		await fs.ensureDir(module1Dir);
		await fs.ensureDir(module2Dir);

		// Create pom files
		await fs.writeFile(path.join(module1Dir, 'pom.xml'), '<project></project>');
		await fs.writeFile(path.join(module2Dir, 'pom.xml'), '<project></project>');

		// Setup GAVs to update
		const gavs = [
			new MavenGAVCoords('com.example', 'lib1', '1.0.0'),
			new MavenGAVCoords('com.example', 'lib2', '2.0.0'),
		];

		// Mock successful executions
		mockExeca.resolves({exitCode: 0, stdout: '', stderr: ''});

		const rewriter = new DependencyRewriter(
			{
				aggregatorPath: tempDir,
				gavs,
				modules: ['module1', 'module2'],
				verbose: false,
			},
			mockExeca,
		);

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1', 'module2']);
		expect(result.errors).to.be.empty;

		// Verify Maven commands were called correctly
		expect(mockExeca.callCount).to.equal(4); // 2 modules × 2 GAVs

		// Check first module, first GAV
		expect(mockExeca.getCall(0).args[0]).to.equal('mvn');
		expect(mockExeca.getCall(0).args[1]).to.include('-f');
		expect(mockExeca.getCall(0).args[1]).to.include(module1Dir);
		expect(mockExeca.getCall(0).args[1]).to.include('versions:use-dep-version');
		expect(mockExeca.getCall(0).args[1]).to.include('-Dincludes=com.example:lib1');
		expect(mockExeca.getCall(0).args[1]).to.include('-DdepVersion=1.0.0');
	});

	it('should handle missing pom files gracefully', async () => {
		const gavs = [new MavenGAVCoords('com.example', 'lib1', '1.0.0')];

		const rewriter = new DependencyRewriter(
			{
				aggregatorPath: tempDir,
				gavs,
				modules: ['non-existent-module'],
				verbose: false,
			},
			mockExeca,
		);

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.be.empty;
		expect(result.errors).to.be.empty;
		expect(mockExeca.callCount).to.equal(0);
	});

	it('should handle Maven errors gracefully', async () => {
		// Create test module
		const moduleDir = path.join(tempDir, 'module1');
		await fs.ensureDir(moduleDir);
		await fs.writeFile(path.join(moduleDir, 'pom.xml'), '<project></project>');

		const gavs = [new MavenGAVCoords('com.example', 'lib1', '1.0.0')];

		// Mock Maven error - this is caught internally and doesn't fail the overall process
		mockExeca.rejects(new Error('Maven error'));

		const rewriter = new DependencyRewriter(
			{
				aggregatorPath: tempDir,
				gavs,
				modules: ['module1'],
				verbose: false,
			},
			mockExeca,
		);

		const result = await rewriter.rewriteDependencies();

		// The implementation handles Maven errors gracefully and continues
		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.be.empty;
		expect(result.errors).to.be.empty;
	});

	it('should skip when no GAVs provided', async () => {
		const rewriter = new DependencyRewriter(
			{
				aggregatorPath: tempDir,
				gavs: [],
				modules: ['module1'],
				verbose: false,
			},
			mockExeca,
		);

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.be.empty;
		expect(result.errors).to.be.empty;
		expect(mockExeca.callCount).to.equal(0);
	});
});
