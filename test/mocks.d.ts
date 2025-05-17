import 'execa';
import type {Result as ExecaResult} from 'execa';

declare module 'execa' {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface ExecaDefault {}

	type r = ExecaResult;
}
