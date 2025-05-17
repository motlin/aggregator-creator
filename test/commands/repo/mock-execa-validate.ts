import type {Options, Result} from 'execa';

type ExecaFactoryResult = {
	(file: string, arguments_?: readonly string[], options?: Options): Promise<Result>;
	sync: (file: string, arguments_?: readonly string[], options?: Options) => Result;
};

export const execa = async (command: string, args?: string[]): Promise<Result> => {
	if (command === 'mvn' && args?.[0] === 'help:effective-pom') {
		return {
			command: 'mvn help:effective-pom',
			exitCode: 0,
			stdout: 'effective-pom',
			stderr: '',
			failed: false,
			isCanceled: false,
			killed: false,
			timedOut: false,
		} as Result;
	}

	return {
		stdout: 'mock stdout',
		stderr: '',
		exitCode: 0,
		command: `${command} ${args?.join(' ') || ''}`,
		failed: false,
		isCanceled: false,
		killed: false,
		timedOut: false,
	} as Result;
};

export const execa_ = (options?: {verbose?: (message: string, meta: unknown) => void}): ExecaFactoryResult => {
	const execaFn = async (command: string, args?: readonly string[]): Promise<Result> => {
		if (options?.verbose) {
			options.verbose(`${command} ${args?.join(' ') || ''}`, {type: 'command'});

			const result = await execa(command, args as string[]);

			if (result.stdout) {
				options.verbose(result.stdout, {type: 'output'});
			}

			options.verbose(`Completed in 0.1s`, {type: 'duration'});

			return result;
		}

		return execa(command, args as string[]);
	};

	execaFn.sync = (command: string, args?: readonly string[]): Result =>
		({
			command: `${command} ${args?.join(' ') || ''}`,
			exitCode: 0,
			stdout: 'mock stdout sync',
			stderr: '',
			failed: false,
			isCanceled: false,
			killed: false,
			timedOut: false,
		}) as Result;

	return execaFn;
};

export const execaCommand = async (command: string): Promise<Result> => {
	if (command.startsWith('mvn help:effective-pom')) {
		return {
			command,
			exitCode: 0,
			stdout: 'effective-pom',
			stderr: '',
			failed: false,
			isCanceled: false,
			killed: false,
			timedOut: false,
		} as Result;
	}

	const parts = command.split(' ');
	return execa(parts[0], parts.slice(1));
};
