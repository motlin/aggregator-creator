import {execa as execa_} from 'execa';
import {githubTopicsResponseSchema} from '../types/repository.js';

export interface TopicSingleRepoOptions {
	owner: string;
	name: string;
	topic: string;
	dryRun?: boolean;
	verbose?: boolean;
	execa?: typeof execa_;
	logger?: {
		log: (message: string) => void;
		warn: (message: string) => void;
		error: (message: string, options?: {exit?: boolean}) => void;
	};
}

export interface TopicSingleRepoResult {
	success: boolean;
	owner: string;
	name: string;
	topic: string;
	topics?: string[];
	alreadyAdded?: boolean;
	error?: string;
}

export async function topicSingleRepository(options: TopicSingleRepoOptions): Promise<TopicSingleRepoResult> {
	const {owner, name, topic, dryRun = false, verbose = false, execa = execa_, logger} = options;
	const verboseLogger = verbose ? logger : undefined;

	try {
		// Get current topics
		const result = await execa('gh', ['api', `repos/${owner}/${name}/topics`, '--method', 'GET'], {
			reject: false,
		});

		if (result.exitCode !== 0) {
			const error = `Failed to get topics: ${result.stderr}`;
			if (logger) {
				logger.warn(error);
			}
			return {
				success: false,
				owner,
				name,
				topic,
				error,
			};
		}

		// Parse topics
		let topics: string[];
		try {
			const topicsData = githubTopicsResponseSchema.parse(JSON.parse(result.stdout));
			topics = topicsData.names;
		} catch (parseError) {
			const error = `Error parsing topics: ${parseError}`;
			if (logger) {
				logger.error(error, {exit: false});
			}
			return {
				success: false,
				owner,
				name,
				topic,
				error,
			};
		}

		// Check if topic already exists
		if (topics.includes(topic)) {
			if (verboseLogger) {
				verboseLogger.log(`Topic ${topic} already exists on ${owner}/${name}`);
			}
			return {
				success: true,
				owner,
				name,
				topic,
				topics,
				alreadyAdded: true,
			};
		}

		// Add new topic
		if (dryRun) {
			topics.push(topic);
			if (verboseLogger) {
				verboseLogger.log(`[DRY RUN] Would add topic ${topic} to ${owner}/${name}`);
			}
			return {
				success: true,
				owner,
				name,
				topic,
				topics,
				alreadyAdded: false,
			};
		}

		// Update topics
		topics.push(topic);
		const args = ['api', `repos/${owner}/${name}/topics`, '--method', 'PUT'];
		for (const t of topics) {
			args.push('-f', `names[]=${t}`);
		}

		const updateResult = await execa('gh', args, {reject: false});

		if (updateResult.exitCode !== 0) {
			const error = `Failed to update topics: ${updateResult.stderr}`;
			if (logger) {
				logger.error(error, {exit: false});
			}
			return {
				success: false,
				owner,
				name,
				topic,
				error,
			};
		}

		return {
			success: true,
			owner,
			name,
			topic,
			topics,
			alreadyAdded: false,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (logger) {
			logger.error(`Failed to add topic to repository ${owner}/${name}: ${errorMessage}`, {exit: false});
		}
		return {
			success: false,
			owner,
			name,
			topic,
			error: errorMessage,
		};
	}
}
