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

describe('aggregator:create with parent POM resolution errors', () => {
	let tempDir: string;
	const sandbox = createSandbox();

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aggregator-parent-pom-error-test-'));

		const validRepo1 = path.join(tempDir, 'valid-repo1');
		const problematicRepo = path.join(tempDir, 'problematic-repo');

		await fs.ensureDir(validRepo1);
		await fs.ensureDir(problematicRepo);

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

		const problematicPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.example</groupId>
        <artifactId>parent</artifactId>
        <version>1.0.0</version>
    </parent>
    <groupId>com.test</groupId>
    <artifactId>test-project-child</artifactId>
    <version>1.0.0</version>
</project>`;

		await fs.writeFile(path.join(validRepo1, 'pom.xml'), validPom);
		await fs.writeFile(path.join(problematicRepo, 'pom.xml'), problematicPom);
	});

	afterEach(async () => {
		await fs.remove(tempDir);
		sandbox.restore();
	});

	it('should continue processing when Maven parent POM resolution errors occur', async function () {
		this.timeout(30_000);

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

		const {stdout} = await runCommand(['aggregator:create', tempDir, '--yes', '--json'], root);
		const output = JSON.parse(stdout);

		expect(output).to.deep.equal({
			success: true,
			pomPath: path.join(tempDir, 'pom.xml'),
			modules: [
				{
					path: 'problematic-repo',
					valid: true,
				},
				{
					path: 'valid-repo1',
					valid: true,
				},
			],
			stats: {
				totalScanned: 2,
				validRepositories: 2,
				skippedRepositories: 0,
			},
			mavenCoordinates: {
				groupId: 'com.example',
				artifactId: 'aggregator',
				version: '1.0.0-SNAPSHOT',
			},
		});

		const pomPath = path.join(tempDir, 'pom.xml');
		expect(fs.existsSync(pomPath)).to.be.true;

		const pomContent = await fs.readFile(pomPath, 'utf8');
		expect(pomContent).to.include('<module>valid-repo1</module>');
		expect(pomContent).to.include('<module>problematic-repo</module>');
	});
});
