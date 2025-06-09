import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import {parsePomForGAV} from '../../src/utils/pom-parser.js';

describe('pom-parser', () => {
	const testDir = path.join(process.cwd(), 'test', 'temp', 'pom-parser');

	before(async () => {
		await fs.ensureDir(testDir);
	});

	after(async () => {
		await fs.remove(testDir);
	});

	describe('parsePomForGAV', () => {
		it('should extract GAV coordinates from a simple POM', async () => {
			const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>my-project</artifactId>
    <version>1.0.0</version>
</project>`;

			const pomPath = path.join(testDir, 'simple-pom.xml');
			await fs.writeFile(pomPath, pomContent);

			const result = await parsePomForGAV(pomPath);

			expect(result.needsMavenFallback).to.be.false;
			expect(result.gav.groupId).to.equal('com.example');
			expect(result.gav.artifactId).to.equal('my-project');
			expect(result.gav.version).to.equal('1.0.0');
		});

		it('should indicate Maven fallback needed for property placeholders', async () => {
			// eslint-disable-next-line no-template-curly-in-string
			const versionPlaceholder = '${project.version}';
			const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>my-project</artifactId>
    <version>${versionPlaceholder}</version>
    <properties>
        <project.version>1.0.0</project.version>
    </properties>
</project>`;

			const pomPath = path.join(testDir, 'placeholder-pom.xml');
			await fs.writeFile(pomPath, pomContent);

			const result = await parsePomForGAV(pomPath);

			expect(result.needsMavenFallback).to.be.true;
			expect(result.reason).to.include('property placeholders');
			expect(result.gav.groupId).to.equal('com.example');
			expect(result.gav.artifactId).to.equal('my-project');
			expect(result.gav.version).to.equal(versionPlaceholder);
		});

		it('should indicate Maven fallback needed for inherited coordinates', async () => {
			const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent</artifactId>
        <version>1.0.0</version>
    </parent>
    <artifactId>my-project</artifactId>
</project>`;

			const pomPath = path.join(testDir, 'inherited-pom.xml');
			await fs.writeFile(pomPath, pomContent);

			const result = await parsePomForGAV(pomPath);

			expect(result.needsMavenFallback).to.be.false; // Parent coordinates are present directly
			expect(result.gav.groupId).to.equal('com.example');
			expect(result.gav.artifactId).to.equal('my-project');
			expect(result.gav.version).to.equal('1.0.0');
		});

		it('should indicate Maven fallback needed for missing coordinates', async () => {
			const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <artifactId>my-project</artifactId>
</project>`;

			const pomPath = path.join(testDir, 'incomplete-pom.xml');
			await fs.writeFile(pomPath, pomContent);

			const result = await parsePomForGAV(pomPath);

			expect(result.needsMavenFallback).to.be.true;
			expect(result.reason).to.include('Missing coordinates');
			expect(result.gav.artifactId).to.equal('my-project');
			expect(result.gav.groupId).to.be.undefined;
			expect(result.gav.version).to.be.undefined;
		});

		it('should handle invalid XML gracefully', async () => {
			const pomContent = `<invalid xml content`;

			const pomPath = path.join(testDir, 'invalid-pom.xml');
			await fs.writeFile(pomPath, pomContent);

			const result = await parsePomForGAV(pomPath);

			expect(result.needsMavenFallback).to.be.true;
			expect(result.reason).to.include('XML parsing failed');
		});

		it('should handle missing files gracefully', async () => {
			const nonExistentPath = path.join(testDir, 'does-not-exist.xml');

			const result = await parsePomForGAV(nonExistentPath);

			expect(result.needsMavenFallback).to.be.true;
			expect(result.reason).to.include('XML parsing failed');
		});
	});
});
