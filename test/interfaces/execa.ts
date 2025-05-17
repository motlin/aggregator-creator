import type {Result} from 'execa';

export type ExecaMockFn = (command: string, args?: string[]) => Promise<Result>;

export const defaultExecaMock: ExecaMockFn = async (_command: string, _args?: string[]) =>
	({
		stdout: '',
		stderr: '',
		exitCode: 0,
	}) as Result;

export const ghCliMock: ExecaMockFn = async (command: string, args?: string[]): Promise<Result> => {
	if (command === 'gh' && args?.[0] === '--version') {
		return {
			stdout: 'gh version 2.0.0',
			stderr: '',
			exitCode: 0,
		} as Result;
	}

	if (command === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
		return {
			stdout: 'Logged in to github.com as username',
			stderr: '',
			exitCode: 0,
		} as Result;
	}

	return defaultExecaMock(command, args);
};
