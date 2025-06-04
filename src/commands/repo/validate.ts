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

		const execa = execa_({
			verbose: (verboseLine: string, {type}: {type: string}) => {
				switch (type) {
					case 'command': {
						this.log(`├──╮ ${verboseLine}`);
						break;
					}
					case 'duration': {
						this.log(`├──╯ ${verboseLine}`);
						break;
					}
					case 'output': {
						const MAX_LENGTH = 120;
						const truncatedLine =
							verboseLine.length > MAX_LENGTH
								? `${verboseLine.slice(0, Math.max(0, MAX_LENGTH))}...`
								: verboseLine;
						this.log(`│  │ ${truncatedLine}`);
						break;
					}
					default: {
						this.debug(`${type} ${verboseLine}`);
					}
				}
			},
		});

		this.log(`╭─── 🔍 Validating Maven repository: ${repoPath}`);
		this.log(`│`);

		const validationResult = await validateMavenRepo(repoPath, execa, this);

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
