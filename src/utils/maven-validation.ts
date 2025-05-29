import {execa as execa_} from 'execa';
import fs from 'fs-extra';
import path from 'node:path';

export interface MavenValidationResult {
	path: string;
	hasPom: boolean;
	valid: boolean;
	error: string | null;
}

export async function validateMavenRepo(
	repoPath: string,
	execa: typeof execa_ = execa_,
	logger?: {log: (message: string) => void; warn: (message: string) => void},
): Promise<MavenValidationResult> {
	const absolutePath = path.resolve(repoPath);

	try {
		const stats = await fs.stat(absolutePath);
		if (!stats.isDirectory()) {
			return {
				path: absolutePath,
				hasPom: false,
				valid: false,
				error: 'Path is not a directory',
			};
		}
	} catch {
		return {
			path: absolutePath,
			hasPom: false,
			valid: false,
			error: 'Path does not exist',
		};
	}

	const pomPath = path.join(absolutePath, 'pom.xml');
	try {
		const pomExists = await fs.pathExists(pomPath);
		if (!pomExists) {
			logger?.log(`│  │  │ No pom.xml found at: ${pomPath}`);
			return {
				path: absolutePath,
				hasPom: false,
				valid: false,
				error: null,
			};
		}
	} catch {
		return {
			path: absolutePath,
			hasPom: false,
			valid: false,
			error: 'Error checking for pom.xml',
		};
	}

	try {
		await execa('mvn', ['help:effective-pom', '--quiet', '--file', pomPath]);
		return {
			path: absolutePath,
			hasPom: true,
			valid: true,
			error: null,
		};
	} catch (execError) {
		if (execError instanceof Error && execError.message.includes('ENOENT')) {
			logger?.warn(`│  │  │ Maven (mvn) command not found. Please install Maven.`);
			return {
				path: absolutePath,
				hasPom: true,
				valid: false,
				error: 'Maven (mvn) command not found',
			};
		}
		return {
			path: absolutePath,
			hasPom: true,
			valid: false,
			error: 'Maven validation failed',
		};
	}
}
