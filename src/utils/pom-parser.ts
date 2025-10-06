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

export interface ParseModulesResult {
	modules: string[];
	success: boolean;
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
		modules?: {
			module?: string | string[];
		};
		packaging?: string;
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

		if (project.groupId) {
			gav.groupId = project.groupId;
		} else if (project.parent?.groupId) {
			gav.groupId = project.parent.groupId;
		}

		if (project.artifactId) {
			gav.artifactId = project.artifactId;
		}

		if (project.version) {
			gav.version = project.version;
		} else if (project.parent?.version) {
			gav.version = project.parent.version;
		}

		if (!gav.groupId || !gav.artifactId || !gav.version) {
			return {
				gav,
				needsMavenFallback: true,
				reason: `Missing coordinates: ${gav.groupId ? '' : 'groupId '}${gav.artifactId ? '' : 'artifactId '}${gav.version ? '' : 'version'}`.trim(),
			};
		}

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

/**
 * Parses module declarations directly from POM XML without invoking Maven.
 * This is much faster than using Maven to evaluate the modules.
 */
export async function parsePomForModules(pomPath: string): Promise<ParseModulesResult> {
	try {
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const pomData = await parseXML(pomContent, {
			explicitArray: false,
			ignoreAttrs: true,
			trim: true,
		});

		if (!pomData?.project) {
			return {
				modules: [],
				success: true,
			};
		}

		const {project} = pomData;

		if (!project.modules?.module) {
			return {
				modules: [],
				success: true,
			};
		}

		const moduleData = project.modules.module;
		const modules = Array.isArray(moduleData) ? moduleData : [moduleData];

		return {
			modules: modules.filter((m): m is string => typeof m === 'string' && m.length > 0),
			success: true,
		};
	} catch (error) {
		return {
			modules: [],
			success: false,
			reason: `XML parsing failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Parses packaging type directly from POM XML without invoking Maven.
 */
export async function parsePomForPackaging(pomPath: string): Promise<string> {
	try {
		const pomContent = await fs.readFile(pomPath, 'utf8');

		const pomData = await parseXML(pomContent, {
			explicitArray: false,
			ignoreAttrs: true,
			trim: true,
		});

		if (!pomData?.project) {
			return 'jar';
		}

		return pomData.project.packaging || 'jar';
	} catch {
		return 'jar';
	}
}
