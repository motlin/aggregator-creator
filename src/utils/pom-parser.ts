import fs from 'fs-extra';
import {type OptionsV2, parseString} from 'xml2js';
import {promisify} from 'node:util';

export interface PomGAV {
	groupId?: string;
	artifactId?: string;
	version?: string;
}

export interface ParsePomResult {
	gav: PomGAV;
	needsMavenFallback: boolean;
	reason?: string;
}

interface ParsedPomData {
	project?: {
		groupId?: string;
		artifactId?: string;
		version?: string;
		parent?: {
			groupId?: string;
			artifactId?: string;
			version?: string;
		};
	};
}

const parseXML = promisify<string, OptionsV2, ParsedPomData>(parseString);

/**
 * Attempts to extract GAV coordinates directly from POM XML without invoking Maven.
 * Returns the coordinates if all are found and don't contain property placeholders,
 * otherwise indicates that Maven fallback is needed.
 */
export async function parsePomForGAV(pomPath: string): Promise<ParsePomResult> {
	try {
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const pomData = await parseXML(pomContent, {
			explicitArray: false,
			ignoreAttrs: true,
			trim: true,
		});

		if (!pomData?.project) {
			return {
				gav: {},
				needsMavenFallback: true,
				reason: 'No project element found in POM',
			};
		}

		const {project} = pomData;
		const gav: PomGAV = {};

		// Extract groupId
		if (project.groupId) {
			gav.groupId = project.groupId;
		} else if (project.parent?.groupId) {
			// Inherited from parent - might need Maven to resolve
			gav.groupId = project.parent.groupId;
		}

		// Extract artifactId (should always be present)
		if (project.artifactId) {
			gav.artifactId = project.artifactId;
		}

		// Extract version
		if (project.version) {
			gav.version = project.version;
		} else if (project.parent?.version) {
			// Inherited from parent - might need Maven to resolve
			gav.version = project.parent.version;
		}

		// Check if we have all three coordinates
		if (gav.groupId && gav.artifactId && gav.version) {
			// All coordinates found, continue to check for placeholders
		} else {
			return {
				gav,
				needsMavenFallback: true,
				reason: `Missing coordinates: ${gav.groupId ? '' : 'groupId '}${gav.artifactId ? '' : 'artifactId '}${gav.version ? '' : 'version'}`.trim(),
			};
		}

		// Check for property placeholders (${...})
		const hasPlaceholders = [gav.groupId, gav.artifactId, gav.version].some(
			(coord) => coord && coord.includes('${'),
		);

		if (hasPlaceholders) {
			return {
				gav,
				needsMavenFallback: true,
				reason: 'Contains property placeholders that need Maven resolution',
			};
		}

		// All coordinates found and no placeholders - we can use direct parsing
		return {
			gav,
			needsMavenFallback: false,
		};
	} catch (error) {
		return {
			gav: {},
			needsMavenFallback: true,
			reason: `XML parsing failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
