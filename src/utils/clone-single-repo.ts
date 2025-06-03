import {execa as execa_} from 'execa';
import fs from 'fs-extra';
import path from 'node:path';

export interface CloneResult {
	owner: string;
	name: string;
	path: string;
	cloned: boolean;
	skipped: boolean;
	error: string | null;
}

export async function cloneSingleRepo(
	owner: string,
	name: string,
	targetDirectory: string,
	execa: typeof execa_ = execa_,
	logger?: {log: (message: string) => void},
): Promise<CloneResult> {
	const repoFullName = `${owner}/${name}`;
	const repoDir = path.join(targetDirectory, owner, name);

	const result: CloneResult = {
		owner,
		name,
		path: repoDir,
		cloned: false,
		skipped: false,
		error: null,
	};

	await fs.ensureDir(path.dirname(repoDir));

	try {
		const dirContents = await fs.readdir(repoDir);
		if (dirContents.length > 0) {
			if (logger) {
				logger.log('Skipped: Directory already exists and is not empty');
			}
			result.skipped = true;
			return result;
		}
	} catch {
		// Directory doesn't exist, which is fine
	}

	try {
		await execa('gh', ['repo', 'clone', repoFullName, repoDir]);
		result.cloned = true;
		return result;
	} catch (error: unknown) {
		result.error = error instanceof Error ? error.message : String(error);
		return result;
	}
}
