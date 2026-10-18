import {Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {execa as execa_} from 'execa';
import {withDebugLogging} from '../../utils/debug-execa.js';
import {cloneSingleRepo} from '../../utils/clone-single-repo.js';
import {describeGhError} from '../../utils/gh-errors.js';
import {z} from 'zod';

interface CloneResponse {
	owner: string;
	name: string;
	path: string;
	cloned: boolean;
	alreadyExists?: boolean;
}

const githubNameSchema = (kind: string) =>
	z
		.string()
		.regex(/^[\w.-]+$/, `Invalid GitHub ${kind} name`)
		.refine((value) => value !== '.' && value !== '..', `Invalid GitHub ${kind} name`);

const cloneInputSchema = z.object({
	name: githubNameSchema('repository'),
	owner: z.object({login: githubNameSchema('owner')}),
});

type CloneInput = z.infer<typeof cloneInputSchema>;

export default class RepoClone extends Command {
	static override args = {};

	static override description =
		'Clone a GitHub repository, or every repository in the JSON array output of repo:list piped to stdin';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner',
		'echo \'{"name": "JUnit-Java-8-Runner", "owner": {"login": "motlin"}}\' | <%= config.bin %> <%= command.id %> --output-directory ./repos',
		'<%= config.bin %> repo:list --owner motlin --limit 5 --json | <%= config.bin %> <%= command.id %> --output-directory ./repos',
		"<%= config.bin %> repo:list --owner motlin --limit 1 --json | jq -c '.[0]' | <%= config.bin %> <%= command.id %> --output-directory ./repos",
		'<%= config.bin %> <%= command.id %> --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner --verbose',
	];

	static override flags = {
		'output-directory': Flags.string({
			description: 'Directory where the repository will be cloned',
			required: true,
		}),
		owner: Flags.string({
			char: 'o',
			description: 'GitHub username or organization (required when not using stdin)',
			required: false,
		}),
		name: Flags.string({
			char: 'n',
			description: 'Repository name (required when not using stdin)',
			required: false,
		}),
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during cloning',
			default: false,
		}),
	};

	public async run(): Promise<CloneResponse | CloneResponse[]> {
		const {flags} = await this.parse(RepoClone);
		const outputDirectory = flags['output-directory'];
		const {verbose} = flags;

		// Determine input source: stdin or flags
		const useStdin = !process.stdin.isTTY && (!flags.owner || !flags.name);

		if (!useStdin) {
			if (!flags.owner || !flags.name) {
				this.error('Both --owner and --name flags are required when not reading from stdin', {
					exit: 1,
					code: 'MISSING_FLAGS',
					suggestions: [
						'Provide both --owner and --name flags',
						'Or pipe repository JSON to stdin',
						`Example: ${this.config.bin} ${this.id} --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner`,
					],
				});
			}

			return this.cloneRepository(flags.owner, flags.name, outputDirectory, verbose);
		}

		if (verbose) {
			this.log(`Reading repository information from stdin...`);
		}

		let fullInput = '';
		for await (const chunk of process.stdin) {
			fullInput += chunk;
		}

		if (!fullInput.trim()) {
			this.error('No input provided', {
				exit: 1,
				code: 'NO_INPUT',
				suggestions: [
					'Provide both --owner and --name flags',
					'Or pipe repository JSON to stdin',
					`Example: ${this.config.bin} ${this.id} --output-directory ./repos --owner motlin --name JUnit-Java-8-Runner`,
				],
			});
		}

		let jsonData: unknown;
		try {
			jsonData = JSON.parse(fullInput);
		} catch {
			this.error('Invalid JSON input from stdin', {
				exit: 1,
				code: 'INVALID_JSON',
				suggestions: [
					'Ensure the input is valid JSON',
					'The input should be a repository object or the JSON array output of repo:list',
					'Example: {"name": "repo", "owner": {"login": "user"}}',
				],
			});
		}

		const parsed = (Array.isArray(jsonData) ? z.array(cloneInputSchema) : cloneInputSchema).safeParse(jsonData);
		if (!parsed.success) {
			const problems = parsed.error.issues
				.map((issue) => {
					const location = issue.path
						.map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
						.join('.')
						.replaceAll('.[', '[');
					return location ? `${location}: ${issue.message}` : issue.message;
				})
				.join('; ');
			this.error(`Invalid repository input from stdin: ${problems}`, {
				exit: 1,
				code: 'INVALID_REPOSITORY_INPUT',
				suggestions: [
					'The input should be a repository object or the JSON array output of repo:list',
					'Example: {"name": "repo", "owner": {"login": "user"}}',
				],
			});
		}

		const input: CloneInput | CloneInput[] = parsed.data;

		if (!Array.isArray(input)) {
			return this.cloneRepository(input.owner.login, input.name, outputDirectory, verbose);
		}

		const responses: CloneResponse[] = [];
		for (const repository of input) {
			responses.push(
				await this.cloneRepository(repository.owner.login, repository.name, outputDirectory, verbose),
			);
		}

		return responses;
	}

	private async cloneRepository(
		owner: string,
		name: string,
		outputDirectory: string,
		verbose: boolean,
	): Promise<CloneResponse> {
		const result = await cloneSingleRepo(
			owner,
			name,
			outputDirectory,
			withDebugLogging(execa_, (message) => this.debug(message)),
			verbose ? this : undefined,
		);

		if (result.error) {
			const {authenticated, message} = describeGhError(result.error);
			this.error(`Failed to clone ${owner}/${name}: ${message}`, {
				exit: 1,
				code: authenticated ? 'CLONE_FAILED' : 'GH_NOT_AUTHENTICATED',
			});
		}

		if (result.cloned) {
			if (verbose) {
				this.log(
					`Successfully cloned ${chalk.yellow(owner)}/${chalk.yellow(name)} to ${chalk.cyan(result.path)}`,
				);
			} else {
				this.log(`${owner}/${name}: cloned`);
			}
		} else if (result.skipped) {
			if (verbose) {
				this.log(
					`Repository ${chalk.yellow(owner)}/${chalk.yellow(name)} already exists at ${chalk.cyan(result.path)}`,
				);
			} else {
				this.log(`${owner}/${name}: already exists`);
			}
		}

		return {
			owner,
			name,
			path: result.path,
			cloned: result.cloned,
			...(result.skipped && {alreadyExists: result.skipped}),
		};
	}
}
