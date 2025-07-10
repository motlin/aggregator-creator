import type {Result} from 'execa';

export function createMockResult(override: Partial<Result> = {}): Result {
	const mockResult = {
		command: 'mock-command',
		escapedCommand: 'mock-command',
		exitCode: 0,
		stdout: '',
		stderr: '',
		all: undefined,
		stdio: [undefined, '', ''],
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
	} as unknown as Result;

	return mockResult;
}
