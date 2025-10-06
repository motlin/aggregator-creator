import {runCommand} from '@oclif/test';
import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

describe('aggregator:create processAllReactorModules', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reactor-modules-test-'));
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	it('collects modules from single-module repository', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'repo1');
		await fs.ensureDir(repo1);

		const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>single-module</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), pom);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const depMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>single-module<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(depMatch).to.not.be.null;
	});

	it('collects modules from multi-module repository', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'multi-repo');
		await fs.ensureDir(repo1);

		const parentPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>parent</artifactId>
    <version>2.0.0</version>
    <packaging>pom</packaging>

    <modules>
        <module>module-a</module>
        <module>module-b</module>
    </modules>
</project>`;

		const moduleAPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent</artifactId>
        <version>2.0.0</version>
    </parent>
    <artifactId>module-a</artifactId>
    <packaging>jar</packaging>
</project>`;

		const moduleBPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent</artifactId>
        <version>2.0.0</version>
    </parent>
    <artifactId>module-b</artifactId>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), parentPom);
		await fs.ensureDir(path.join(repo1, 'module-a'));
		await fs.writeFile(path.join(repo1, 'module-a', 'pom.xml'), moduleAPom);
		await fs.ensureDir(path.join(repo1, 'module-b'));
		await fs.writeFile(path.join(repo1, 'module-b', 'pom.xml'), moduleBPom);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const parentMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>parent<\/artifactId>[\s\S]*?<version>2\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(parentMatch).to.not.be.null;

		const moduleAMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>module-a<\/artifactId>[\s\S]*?<version>2\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(moduleAMatch).to.not.be.null;

		const moduleBMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>module-b<\/artifactId>[\s\S]*?<version>2\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(moduleBMatch).to.not.be.null;
	});

	it('collects modules from multiple repositories', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'repo1');
		const repo2 = path.join(tempDir, 'repo2');
		await fs.ensureDir(repo1);
		await fs.ensureDir(repo2);

		const pom1 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>repo1-artifact</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		const pom2 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>repo2-artifact</artifactId>
    <version>2.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), pom1);
		await fs.writeFile(path.join(repo2, 'pom.xml'), pom2);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const repo1Match = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>repo1-artifact<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(repo1Match).to.not.be.null;

		const repo2Match = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<groupId>com\.example<\/groupId>[\s\S]*?<artifactId>repo2-artifact<\/artifactId>[\s\S]*?<version>2\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(repo2Match).to.not.be.null;
	});

	it('handles nested modules', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'nested-repo');
		await fs.ensureDir(repo1);

		const rootPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>root</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>

    <modules>
        <module>parent</module>
    </modules>
</project>`;

		const parentPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>parent</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>

    <modules>
        <module>child</module>
    </modules>
</project>`;

		const childPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>child</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), rootPom);
		await fs.ensureDir(path.join(repo1, 'parent'));
		await fs.writeFile(path.join(repo1, 'parent', 'pom.xml'), parentPom);
		await fs.ensureDir(path.join(repo1, 'parent', 'child'));
		await fs.writeFile(path.join(repo1, 'parent', 'child', 'pom.xml'), childPom);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const rootMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>root<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(rootMatch).to.not.be.null;

		const parentMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>parent<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(parentMatch).to.not.be.null;

		const childMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>child<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(childMatch).to.not.be.null;
	});

	it('handles repositories with only pom packaging', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'pom-only');
		await fs.ensureDir(repo1);

		const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>pom-only</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), pom);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		expect(pomContent).to.match(
			/<dependencyManagement>[\s\S]*<dependencies>[\s\S]*<\/dependencies>[\s\S]*<\/dependencyManagement>/,
		);

		const pomOnlyMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>pom-only<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(pomOnlyMatch).to.not.be.null;
	});

	it('skips modules that fail to parse', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'mixed-repo');
		await fs.ensureDir(repo1);

		const validPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>valid</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), validPom);

		const repo2 = path.join(tempDir, 'broken-repo');
		await fs.ensureDir(repo2);
		await fs.writeFile(path.join(repo2, 'pom.xml'), 'invalid XML');

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const validMatch = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>valid<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(validMatch).to.not.be.null;

		expect(pomContent).to.not.include('broken-repo');
	});

	it('processes with --parallel flag', async function () {
		this.timeout(10_000);

		const repo1 = path.join(tempDir, 'repo1');
		const repo2 = path.join(tempDir, 'repo2');
		await fs.ensureDir(repo1);
		await fs.ensureDir(repo2);

		const pom1 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>parallel1</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>`;

		const pom2 = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>parallel2</artifactId>
    <version>2.0.0</version>
    <packaging>jar</packaging>
</project>`;

		await fs.writeFile(path.join(repo1, 'pom.xml'), pom1);
		await fs.writeFile(path.join(repo2, 'pom.xml'), pom2);

		const result = await runCommand(['aggregator:create', tempDir, '--yes', '--parallel', '--json'], root);

		const output = JSON.parse(result.stdout);
		expect(output.success).to.be.true;

		const pomPath = path.join(tempDir, 'pom.xml');
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const parallel1Match = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>parallel1<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(parallel1Match).to.not.be.null;

		const parallel2Match = pomContent.match(
			/<dependencyManagement>[\s\S]*?<dependency>[\s\S]*?<artifactId>parallel2<\/artifactId>[\s\S]*?<\/dependency>[\s\S]*?<\/dependencyManagement>/,
		);
		expect(parallel2Match).to.not.be.null;
	});
});
