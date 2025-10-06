import {expect} from 'chai';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import MavenGAVCoords from '../../src/maven-gav.js';
import {XmlDependencyRewriter} from '../../src/utils/xml-dependency-rewriter.js';

describe('XmlDependencyRewriter edge cases', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xml-rewriter-edge-test-'));
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	it('handles dependencies with scope', async () => {
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
            <scope>test</scope>
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
		expect(updatedContent).to.include('<scope>test</scope>');
	});

	it('handles dependencies with classifier', async () => {
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
            <classifier>tests</classifier>
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
		expect(updatedContent).to.include('<classifier>tests</classifier>');
	});

	it('handles dependencies with type', async () => {
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
            <type>test-jar</type>
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
		expect(updatedContent).to.include('<type>test-jar</type>');
	});

	it('handles dependencies with all optional fields', async () => {
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
            <scope>provided</scope>
            <type>war</type>
            <classifier>jdk8</classifier>
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
		expect(updatedContent).to.include('<scope>provided</scope>');
		expect(updatedContent).to.include('<type>war</type>');
		expect(updatedContent).to.include('<classifier>jdk8</classifier>');
	});

	it('handles empty dependencies section', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencies>
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

	it('handles POM without dependencies section', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>
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

	it('handles property placeholders in groupId', async () => {
		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>\${project.groupId}</groupId>
            <artifactId>library-a</artifactId>
            <version>1.0.0</version>
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

		expect(result.rewrittenPoms).to.be.empty;
	});

	it('handles property placeholders in multiple locations', async () => {
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
                <artifactId>lib1</artifactId>
                <version>\${lib.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>lib2</artifactId>
            <version>1.0.0</version>
        </dependency>
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = [
			new MavenGAVCoords('com.example', 'lib1', '1.5.0'),
			new MavenGAVCoords('com.example', 'lib2', '2.0.0'),
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
		expect(updatedPom).to.match(/<artifactId>lib1<\/artifactId>\s*<version>1\.5\.0<\/version>/);
		expect(updatedPom).to.match(/<artifactId>lib2<\/artifactId>\s*<version>2\.0\.0<\/version>/);
		expect(updatedPom).not.to.match(/\$\{lib\.version\}/);
	});

	it('handles mixed plain and array dependency structures', async () => {
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
			new MavenGAVCoords('com.example', 'library-b', '2.5.0'),
		];

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
		expect(updatedContent).to.include('<version>2.5.0</version>');
	});

	it('handles very large number of dependencies', async () => {
		const dependencies = Array.from(
			{length: 100},
			(_, i) => `        <dependency>
            <groupId>com.example</groupId>
            <artifactId>library-${i}</artifactId>
            <version>1.0.0</version>
        </dependency>`,
		).join('\n');

		const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>test-module</artifactId>
    <version>1.0.0</version>

    <dependencies>
${dependencies}
    </dependencies>
</project>`;

		const modulePath = path.join(tempDir, 'module1');
		await fs.ensureDir(modulePath);
		await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);

		const gavs = Array.from({length: 100}, (_, i) => new MavenGAVCoords('com.example', `library-${i}`, '2.0.0'));

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules: ['module1'],
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.deep.equal(['module1']);

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.include('<version>2.0.0</version>');
		const versionMatches = updatedContent.match(/<version>1\.0\.0<\/version>/g);
		expect(versionMatches?.length).to.equal(1);
	});

	it('handles concurrent updates to different modules', async () => {
		const modules = Array.from({length: 10}, (_, i) => `module${i}`);

		for (const module of modules) {
			const modulePath = path.join(tempDir, module);
			await fs.ensureDir(modulePath);

			const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.test</groupId>
    <artifactId>${module}</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>shared-lib</artifactId>
            <version>1.0.0</version>
        </dependency>
    </dependencies>
</project>`;

			await fs.writeFile(path.join(modulePath, 'pom.xml'), pomContent);
		}

		const gavs = [new MavenGAVCoords('com.example', 'shared-lib', '2.0.0')];

		const rewriter = new XmlDependencyRewriter({
			aggregatorPath: tempDir,
			gavs,
			modules,
		});

		const result = await rewriter.rewriteDependencies();

		expect(result.success).to.be.true;
		expect(result.rewrittenPoms).to.have.members(modules);

		for (const module of modules) {
			const updatedContent = await fs.readFile(path.join(tempDir, module, 'pom.xml'), 'utf8');
			expect(updatedContent).to.include('<version>2.0.0</version>');
		}
	});

	it('preserves XML formatting and indentation', async () => {
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

		await rewriter.rewriteDependencies();

		const updatedContent = await fs.readFile(path.join(modulePath, 'pom.xml'), 'utf8');
		expect(updatedContent).to.match(/^\s{4}<modelVersion>/m);
		expect(updatedContent).to.match(/^\s{12}<groupId>/m);
	});
});
