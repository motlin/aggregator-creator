import {Args, Command, Flags} from '@oclif/core';
import {execa as execa_} from 'execa';
import {type MavenValidationResult, validateMavenRepo} from '../../utils/maven-validation.js';

export default class RepoValidate extends Command {
	static override id = 'repo:validate';

	static override args = {
		repoPath: Args.string({
			description: 'Path to the repository to validate',
			required: true,
		}),
	};

	static override description = 'Validate a single Maven repository';

	static override enableJsonFlag = true;

	static override examples = [
		'<%= config.bin %> <%= command.id %> ./path/to/repo',
		'<%= config.bin %> <%= command.id %> /repos/owner/repo-name',
		'<%= config.bin %> <%= command.id %> ./my-maven-project --json',
		'<%= config.bin %> <%= command.id %> ./my-maven-project --verbose',
	];

	static override flags = {
		verbose: Flags.boolean({
			char: 'v',
			description: 'Show verbose output during validation',
			default: false,
		}),
	};

	public async run(): Promise<MavenValidationResult> {
		const {args, flags} = await this.parse(RepoValidate);
		const {repoPath} = args;
		const {verbose} = flags;

		if (verbose) {
			this.log(`╭─── Validating Maven repository: ${repoPath}`);
			this.log(`│`);
		}

		const validationResult = await validateMavenRepo(repoPath, execa_, verbose ? this : undefined);

		if (verbose) {
			if (validationResult.valid) {
				this.log(`├──╯ Repository is valid Maven project`);
			} else if (validationResult.hasPom) {
				this.log(
					`├──╯ Repository has pom.xml but validation failed: ${validationResult.error || 'Unknown error'}`,
				);
			} else {
				this.log(`├──╯ Repository is not a Maven project: ${validationResult.error || 'No pom.xml found'}`);
			}

			this.log(`│`);
			this.log(`╰─── Validation complete`);
		} else if (validationResult.valid) {
			this.log(`${repoPath}: valid`);
		} else if (validationResult.hasPom) {
			this.log(`${repoPath}: invalid (${validationResult.error || 'validation failed'})`);
		} else {
			this.log(`${repoPath}: not a Maven project`);
		}

		if (!validationResult.valid) {
			this.exit(1);
		}

		return validationResult;
	}
}
