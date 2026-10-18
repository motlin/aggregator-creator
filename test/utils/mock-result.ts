import type {Result} from "execa";

export function createMockResult(override: Partial<Result> = {}): Result {
	const mockResult = {
		command: "mock-command",
		escapedCommand: "mock-command",
		exitCode: 0,
		stdout: "",
		stderr: "",
		all: undefined,
		stdio: [undefined, "", ""],
		ipcOutput: [],
		pipedFrom: [],
		cwd: process.cwd(),
		durationMs: 0,
		failed: false,
		timedOut: false,
		isCanceled: false,
		isGracefullyCanceled: false,
		isMaxBuffer: false,
		isTerminated: false,
		isForcefullyTerminated: false,
		killed: false,
		...override,
	};

	// oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- execa's Result type depends on its options generic, which a partial mock cannot satisfy
	return mockResult as unknown as Result;
}
