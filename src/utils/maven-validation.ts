import {execa as execa_} from 'execa';
import fs from 'fs-extra';
import path from 'node:path';

export async function validateMavenRepo(
	repoPath: string,
	execa: typeof execa_ = execa_,
	logger: {log: (message: string) => void; warn: (message: string) => void},
): Promise<boolean> {
	const absolutePath = path.resolve(repoPath);

	try {
		const stats = await fs.stat(absolutePath);
		if (!stats.isDirectory()) {
			return false;
		}
	} catch {
		return false;
	}

	const pomPath = path.join(absolutePath, 'pom.xml');
	try {
		const pomExists = await fs.pathExists(pomPath);
		if (!pomExists) {
			logger.log(`│  │  │ No pom.xml found at: ${pomPath}`);
			return false;
		}
	} catch {
		return false;
	}

	try {
		await execa('mvn', ['help:effective-pom', '--quiet', '--file', pomPath]);
		return true;
	} catch (execError) {
		if (execError instanceof Error && execError.message.includes('ENOENT')) {
			logger.warn(`│  │  │ Maven (mvn) command not found. Please install Maven.`);
		}
		return false;
	}
}
