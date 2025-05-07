import 'execa'

declare module 'execa' {
  // Allow any custom implementation for execa
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ExecaDefault {}
}
