import {Args, Command} from '@oclif/core';
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
	];

	public async run(): Promise<MavenValidationResult> {
		const {args} = await this.parse(RepoValidate);
		const {repoPath} = args;

		this.log(`╭─── 🔍 Validating Maven repository: ${repoPath}`);
		this.log(`│`);

		const validationResult = await validateMavenRepo(repoPath, execa_, this);

		if (validationResult.valid) {
			this.log(`├──╯ ✅ Repository is valid Maven project`);
		} else if (validationResult.hasPom) {
			this.log(
				`├──╯ ❌ Repository has pom.xml but validation failed: ${validationResult.error || 'Unknown error'}`,
			);
		} else {
			this.log(`├──╯ ❌ Repository is not a Maven project: ${validationResult.error || 'No pom.xml found'}`);
		}

		this.log(`│`);
		this.log(`╰─── 🔍 Validation complete`);

		// Exit with appropriate code: 0 if valid, 1 if not valid
		if (!validationResult.valid) {
			this.exit(1);
		}

		return validationResult;
	}
}
