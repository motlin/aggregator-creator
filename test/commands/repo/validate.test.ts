import {describe, it, beforeEach, afterEach} from 'vite-plus/test';
import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('repo:validate', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = path.join(process.cwd(), 'test-temp-validate-single');
	});

	afterEach(async () => {
		if (fs.existsSync(tempDir)) {
			await fs.remove(tempDir);
		}
	});

	it('should fail when directory does not exist', async () => {
		const nonExistentPath = path.join(tempDir, 'non-existent');

		const result = await runCommand(['repo:validate', nonExistentPath, '--json'], root);
		expect(result).to.deep.equal({
			stderr: '',
			result: undefined,
			stdout:
				JSON.stringify(
					{
						error: {
							code: 'EEXIT',
							oclif: {
								exit: 1,
							},
						},
					},
					null,
					2,
				) + '\n',
		});
	});

	it('should explain why a non-existent directory is not a Maven project', async () => {
		const nonExistentPath = path.join(tempDir, 'non-existent');

		const result = await runCommand(['repo:validate', nonExistentPath], root);
		expect({stdout: result.stdout, stderr: result.stderr, exit: result.error?.oclif?.exit}).to.deep.equal({
			stdout: `${nonExistentPath}: not a Maven project (Path does not exist)\n`,
			stderr: '',
			exit: 1,
		});
	});

	it('should fail when no pom.xml exists', async () => {
		await fs.ensureDir(tempDir);

		const result = await runCommand(['repo:validate', tempDir, '--json'], root);
		expect(result).to.deep.equal({
			stderr: '',
			result: undefined,
			stdout:
				JSON.stringify(
					{
						error: {
							code: 'EEXIT',
							oclif: {
								exit: 1,
							},
						},
					},
					null,
					2,
				) + '\n',
		});
	});

	it('should explain that a directory without pom.xml is not a Maven project', async () => {
		await fs.ensureDir(tempDir);

		const result = await runCommand(['repo:validate', tempDir], root);
		expect({stdout: result.stdout, stderr: result.stderr, exit: result.error?.oclif?.exit}).to.deep.equal({
			stdout: `${tempDir}: not a Maven project (No pom.xml found)\n`,
			stderr: '',
			exit: 1,
		});
	});

	it('should succeed for valid Maven repository', async () => {
		await fs.ensureDir(tempDir);

		// Create a valid minimal Maven POM
		const validPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0.0</version>
</project>`;
		await fs.writeFile(path.join(tempDir, 'pom.xml'), validPom);

		const result = await runCommand(['repo:validate', tempDir, '--json'], root);
		expect(result).to.deep.equal({
			stderr: '',
			stdout:
				JSON.stringify(
					{
						path: tempDir,
						hasPom: true,
						valid: true,
						error: null,
					},
					null,
					2,
				) + '\n',
			result: {
				path: tempDir,
				hasPom: true,
				valid: true,
				error: null,
			},
		});
	});
});
