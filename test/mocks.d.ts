import 'execa'
import type {Result as ExecaResult} from 'execa'

declare module 'execa' {
  // Allow any custom implementation for execa
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ExecaDefault {}

  // Define 'r' as an alias for Result to fix type errors
  type r = ExecaResult
}
