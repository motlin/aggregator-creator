import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import MavenGAVCoords from '../../src/maven-gav.js';
import {XmlDependencyRewriter} from '../../src/utils/xml-dependency-rewriter.js';

const pomTemplate = (artifactId: string, depVersion: string) => `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>shared-lib</artifactId>
            <version>${depVersion}</version>
        </dependency>
    </dependencies>
</project>`;

describe('XmlDependencyRewriter', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xml-rewriter-test-'));
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	it('updates simple dependency versions', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>2.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-a</artifactId>
            <version>1.0.0</version>
        </dependency>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-b</artifactId>
            <version>2.0.0</version>
        </dependency>
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [
			new MavenGAVCoords('com.example', 'library-a', '1.5.0'),
			new MavenGAVCoords('com.example', 'library-b', '2.1.0'),
		];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
			verbose: false,
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);
		expect(result.errors).to.be.empty;
		expect(result.mavenFallbacks).to.be.empty;

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>1.5.0</version>');
		expect(updatedContent).to.include('<version>2.1.0</version>');
		expect(updatedContent).to.not.include('<version>1.0.0</version>');
	});

	it('updates dependencies in dependencyManagement section', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>managed-lib</artifactId>
                <version>3.0.0</version>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'managed-lib', '3.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>3.5.0</version>');
		expect(updatedContent).to.not.include('<version>3.0.0</version>');
	});

	it('updates plugin dependencies', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.8.0</version>
                <dependencies>
                    <dependency>
                        <groupId>com.example</groupId>
                        <artifactId>plugin-dep</artifactId>
                        <version>1.0.0</version>
                    </dependency>
                </dependencies>
            </plugin>
        </plugins>
    </build>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'plugin-dep', '1.2.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>1.2.0</version>');
	});

	it('updates profile dependencies', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <profiles>
        <profile>
            <id>dev</id>
            <dependencies>
                <dependency>
                    <groupId>com.example</groupId>
                    <artifactId>profile-lib</artifactId>
                    <version>2.0.0</version>
                </dependency>
            </dependencies>
        </profile>
    </profiles>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'profile-lib', '2.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>2.5.0</version>');
	});

	it('replaces property placeholders regardless of property name', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <properties>
        <lib.version>1.0.0</lib.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-a</artifactId>
            <version>\${lib.version}</version>
        </dependency>
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'library-a', '1.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);
		expect(result.mavenFallbacks).to.be.empty;

		const updatedPom = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedPom).to.include('<lib.version>1.0.0</lib.version>');
		expect(updatedPom).to.match(/<artifactId>library-a<\/artifactId>\s*<version>1\.5\.0<\/version>/);
		expect(updatedPom).not.to.match(/\$\{lib\.version\}/);
	});

	it('does not modify dependencies not in GAV list', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-a</artifactId>
            <version>1.0.0</version>
        </dependency>
        <dependency>
            <groupId>com.other</groupId>
            <artifactId>library-b</artifactId>
            <version>2.0.0</version>
        </dependency>
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'library-a', '1.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>1.5.0</version>');
		expect(updatedContent).to.include('<version>2.0.0</version>');
	});

	it('processes multiple modules in parallel', async () => {
		const modules = ['module1', 'module2', 'module3'];
		for (const module of modules) {
			const modulePath = path.join(tempDir, module);
			await fs.ensureDir(modulePath);
			await fs.writeFile(path.join(modulePath, 'pom.xml'), pomTemplate(module, '1.0.0'));
		}

		const gavs = [new MavenGAVCoords('com.example', 'shared-lib', '1.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules,
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.have.members(modules);
		expect(result.errors).to.be.empty;

		for (const module of modules) {
			const updatedContent = await fs.readFile(path.join(tempDir, module, 'pom.xml'), 'utf8');
			expect(updatedContent).to.include('<version>1.5.0</version>');
		}
	});

	it('reports errors for invalid POMs', async () => {
		const invalidPomContent = 'This is not valid XML';

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), invalidPomContent);

		const gavs = [new MavenGAVCoords('com.example', 'library-a', '1.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.false;
		expect(result.errors).to.have.lengthOf(1);
		expect(result.errors[0].pom).to.equal('module1');
	});

	it('skips modules without pom.xml', async () => {
		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);

		const gavs = [new MavenGAVCoords('com.example', 'library-a', '1.5.0')];

		const logs: string[] = [];
		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
			log: (message) => logs.push(message),
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.rewrittenPoms).to.be.empty;
		expect(logs.some((log) => log.includes('pom.xml not found'))).to.be.true;
	});

	it('returns early when no GAVs provided', async () => {
		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs: [],
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.be.empty;
		expect(result.errors).to.be.empty;
		expect(result.mavenFallbacks).to.be.empty;
	});

	it('does not update when version matches', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-a</artifactId>
            <version>1.5.0</version>
        </dependency>
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('com.example', 'library-a', '1.5.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.be.empty;
	});

	it('updates parent version', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>io.liftwizard</groupId>
        <artifactId>liftwizard-profile-parent</artifactId>
        <version>2.1.33</version>
    </parent>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('io.liftwizard', 'liftwizard-profile-parent', '2.1.34-SNAPSHOT')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedPom = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedPom).to.include('<version>2.1.34-SNAPSHOT</version>');
		expect(updatedPom).not.to.include('<version>2.1.33</version>');
	});

	it('replaces property placeholders with actual versions', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <properties>
        <liftwizard.version>2.1.33</liftwizard.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.liftwizard</groupId>
                <artifactId>liftwizard-dependencies</artifactId>
                <version>\${liftwizard.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [new MavenGAVCoords('io.liftwizard', 'liftwizard-dependencies', '2.1.34-SNAPSHOT')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedPom = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedPom).to.include('<liftwizard.version>2.1.33</liftwizard.version>');
		expect(updatedPom).to.match(
			/<artifactId>liftwizard-dependencies<\/artifactId>\s*<version>2\.1\.34-SNAPSHOT<\/version>/,
		);
		expect(updatedPom).not.to.match(/\$\{liftwizard\.version\}/);
	});

	it('updates parent and replaces property placeholders in dependencies', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>io.liftwizard</groupId>
        <artifactId>liftwizard-profile-parent</artifactId>
        <version>2.1.33</version>
    </parent>
    <groupId>cool.klass</groupId>
    <artifactId>klass</artifactId>
    <version>0.6.0-SNAPSHOT</version>

    <properties>
        <liftwizard.version>2.1.33</liftwizard.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.liftwizard</groupId>
                <artifactId>liftwizard-dependencies</artifactId>
                <version>\${liftwizard.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <dependency>
                <groupId>io.liftwizard</groupId>
                <artifactId>liftwizard-bom</artifactId>
                <version>\${liftwizard.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [
			new MavenGAVCoords('io.liftwizard', 'liftwizard-profile-parent', '2.1.34-SNAPSHOT'),
			new MavenGAVCoords('io.liftwizard', 'liftwizard-dependencies', '2.1.34-SNAPSHOT'),
			new MavenGAVCoords('io.liftwizard', 'liftwizard-bom', '2.1.34-SNAPSHOT'),
		];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);
		expect(result.mavenFallbacks).to.be.empty;

		const updatedPom = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedPom).to.include('<liftwizard.version>2.1.33</liftwizard.version>');
		expect(updatedPom).to.match(/<parent>[\s\S]*<version>2.1.34-SNAPSHOT<\/version>/);
		expect(updatedPom).not.to.match(/<parent>[\s\S]*<version>2.1.33<\/version>/);
		expect(updatedPom).not.to.match(/\$\{liftwizard\.version\}/);
		expect(updatedPom).to.match(
			/<artifactId>liftwizard-dependencies<\/artifactId>\s*<version>2\.1\.34-SNAPSHOT<\/version>/,
		);
		expect(updatedPom).to.match(/<artifactId>liftwizard-bom<\/artifactId>\s*<version>2\.1\.34-SNAPSHOT<\/version>/);
	});
});
