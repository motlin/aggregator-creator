import type {execa as execa_} from "execa";

type Execa = typeof execa_;

/**
 * Wrap execa so every external command (gh, mvn, git) is reported through the given debug logger,
 * which oclif prints when DEBUG matches the command's namespace (for example DEBUG=*).
 */
export function withDebugLogging(execa: Execa, debug: (message: string) => void): Execa {
	// oxlint-disable-next-line typescript/promise-function-async -- must return execa's subprocess, not a wrapping Promise
	const wrapped = (file: string | URL, args?: readonly string[], options?: Record<string, unknown>) => {
		const commandLine = [String(file), ...(Array.isArray(args) ? args : [])].join(" ");
		debug(`Running: ${commandLine}`);

		const subprocess = execa(file, args, options);
		Promise.resolve(subprocess).then(
			(result) => {
				if (result.failed) {
					debug(`Failed: ${result.message}`);
				} else {
					debug(`Finished with exit code ${result.exitCode}: ${commandLine}`);
				}
			},
			(error: unknown) => {
				debug(`Failed: ${error instanceof Error ? error.message : String(error)}`);
			},
		);
		return subprocess;
	};

	return wrapped as unknown as Execa;
}
