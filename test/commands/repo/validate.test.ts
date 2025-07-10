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
		expect(result.stderr).to.equal('');
		expect(result.result).to.be.undefined;

		const jsonOutput = JSON.parse(result.stdout);
		expect(jsonOutput).to.deep.equal({
			error: {
				code: 'EEXIT',
				oclif: {
					exit: 1,
				},
			},
		});
	});

	it('should fail when no pom.xml exists', async () => {
		await fs.ensureDir(tempDir);

		const result = await runCommand(['repo:validate', tempDir, '--json'], root);
		expect(result.stderr).to.equal('');
		expect(result.result).to.be.undefined;

		const jsonOutput = JSON.parse(result.stdout);
		expect(jsonOutput).to.deep.equal({
			error: {
				code: 'EEXIT',
				oclif: {
					exit: 1,
				},
			},
		});
	});

	it.skip('should succeed for valid Maven repository', async () => {
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
		expect(result.stderr).to.equal('');
		expect(result.error).to.be.undefined;

		const jsonOutput = JSON.parse(result.stdout);
		expect(jsonOutput).to.deep.equal({
			path: tempDir,
			hasPom: true,
			valid: true,
			error: null,
		});
	});
});
