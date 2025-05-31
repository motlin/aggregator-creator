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
		tempDir = path.join(process.cwd(), 'test-temp-dir');
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
			result: undefined,
			stdout: `{\n  "error": {\n    "code": "ENOENT",\n    "oclif": {\n      "exit": 1\n    },\n    "suggestions": [\n      "ENOENT: no such file or directory, stat '${nonExistentPath}'"\n    ]\n  }\n}\n`,
			stderr: '',
		});
	});

	it('should fail when no pom.xml exists', async () => {
		await fs.ensureDir(tempDir);

		const {stdout} = await runCommand(['repo:validate', tempDir, '--json'], root);
		const result = JSON.parse(stdout);
		expect(result).to.deep.equal({
			validCount: 0,
			validRepos: [],
		});
	});

	it('should succeed for valid Maven repo at root directory', async () => {
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

		const {stdout} = await runCommand(['repo:validate', tempDir, '--json'], root);
		const result = JSON.parse(stdout);
		expect(result).to.deep.equal({
			validCount: 1,
			validRepos: [
				{
					path: tempDir,
					owner: {login: path.basename(path.dirname(tempDir)), type: 'User'},
					name: path.basename(tempDir),
					hasPom: true,
					valid: true,
					language: null,
					topics: [],
					fork: false,
					archived: false,
					disabled: false,
					is_template: false,
					private: false,
					visibility: 'public',
				},
			],
		});
	});

	it('should validate nested owner/repo directory structure', async () => {
		// Create owner directories
		const owner1Path = path.join(tempDir, 'owner1');
		const owner2Path = path.join(tempDir, 'owner2');
		await fs.ensureDir(owner1Path);
		await fs.ensureDir(owner2Path);

		// Create repositories with pom.xml files
		const repo1Path = path.join(owner1Path, 'repo1');
		const repo2Path = path.join(owner1Path, 'repo2');
		const repo3Path = path.join(owner2Path, 'repo3');
		const invalidRepoPath = path.join(owner2Path, 'invalid-repo');

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

		await fs.ensureDir(repo1Path);
		await fs.writeFile(path.join(repo1Path, 'pom.xml'), validPom);

		await fs.ensureDir(repo2Path);
		await fs.writeFile(path.join(repo2Path, 'pom.xml'), validPom);

		await fs.ensureDir(repo3Path);
		await fs.writeFile(path.join(repo3Path, 'pom.xml'), validPom);

		// Create invalid repo (no pom.xml)
		await fs.ensureDir(invalidRepoPath);

		const {stdout} = await runCommand(['repo:validate', tempDir, '--json'], root);
		const result = JSON.parse(stdout);

		expect(result.validCount).to.equal(3);
		expect(result.validRepos).to.have.lengthOf(3);

		// Check that the valid repos are included
		const validRepoNames = result.validRepos
			.map((r: {owner: {login: string}; name: string}) => `${r.owner.login}/${r.name}`)
			.sort();
		expect(validRepoNames).to.deep.equal(['owner1/repo1', 'owner1/repo2', 'owner2/repo3']);
	});

	it('should handle mixed valid and invalid repositories', async () => {
		const ownerPath = path.join(tempDir, 'owner');
		await fs.ensureDir(ownerPath);

		// Create valid repo
		const validRepoPath = path.join(ownerPath, 'valid-repo');
		await fs.ensureDir(validRepoPath);
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
		await fs.writeFile(path.join(validRepoPath, 'pom.xml'), validPom);

		// Create repo without pom.xml
		const noPomRepoPath = path.join(ownerPath, 'no-pom-repo');
		await fs.ensureDir(noPomRepoPath);

		// Create repo with invalid pom.xml
		const invalidPomRepoPath = path.join(ownerPath, 'invalid-pom-repo');
		await fs.ensureDir(invalidPomRepoPath);
		await fs.writeFile(path.join(invalidPomRepoPath, 'pom.xml'), 'invalid xml');

		const {stdout} = await runCommand(['repo:validate', tempDir, '--json'], root);
		const result = JSON.parse(stdout);

		expect(result.validCount).to.equal(1);
		expect(result.validRepos).to.have.lengthOf(1);
		expect(result.validRepos[0]).to.include({
			name: 'valid-repo',
			hasPom: true,
			valid: true,
		});
		expect(result.validRepos[0].owner).to.deep.equal({login: 'owner', type: 'User'});
	});
});
