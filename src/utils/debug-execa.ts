import type {execa as execa_, Result} from "execa";

type Execa = typeof execa_;

async function logOutcome(subprocess: PromiseLike<Result>, commandLine: string, debug: (message: string) => void) {
	try {
		const result = await subprocess;
		if (result.failed) {
			debug(`Failed: ${result.message ?? "unknown error"}`);
		} else {
			debug(`Finished with exit code ${result.exitCode}: ${commandLine}`);
		}
	} catch (error: unknown) {
		debug(`Failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Wrap execa so every external command (gh, mvn, git) is reported through the given debug logger,
 * which oclif prints when DEBUG matches the command's namespace (for example DEBUG=*).
 */
export function withDebugLogging(execa: Execa, debug: (message: string) => void): Execa {
	// oxlint-disable-next-line typescript/promise-function-async -- must return execa's subprocess, not a wrapping Promise
	const wrapped = (file: string | URL, args?: readonly string[], options?: Record<string, unknown>) => {
		const commandLine = [String(file), ...(args ?? [])].join(" ");
		debug(`Running: ${commandLine}`);

		const subprocess = execa(file, args, options);
		void logOutcome(subprocess, commandLine, debug);
		return subprocess;
	};

	// oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- execa's overloaded template-tag signature cannot be implemented without a cast
	return wrapped as unknown as Execa;
}
