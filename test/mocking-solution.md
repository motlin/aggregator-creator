# Testing and Mocking Solution for ESM

## Current Issues

We've encountered several challenges when writing tests for this ESM-based codebase:

1. **ES Modules properties are read-only by default**, which causes problems with traditional mocking libraries like Sinon.
2. **Module mocking in ESM** is fundamentally different than CommonJS, and many established patterns don't work.
3. **Test isolation** is important but difficult to achieve with Node.js's module caching behavior.

## Recommended Solutions

### Option 1: Use Dependency Injection

The cleanest solution for making testable code in ESM is to use dependency injection. Rather than directly importing dependencies, we can:

1. Accept dependencies as constructor or function parameters
2. Create factory functions that can be overridden in tests
3. Use a dependency injection container

Example:

```typescript
// Bad - difficult to test
import {execa} from 'execa'

export class GitService {
  async getRepos() {
    return execa('git', ['ls-remote'])
  }
}

// Good - testable
export class GitService {
  constructor(private execaFn = execa) {
    this.execaFn = execaFn
  }

  async getRepos() {
    return this.execaFn('git', ['ls-remote'])
  }
}

// In tests:
const mockExeca = async () => ({stdout: 'mock result'})
const service = new GitService(mockExeca)
```

### Option 2: Use Mock Override Files

For existing code bases, we can create mock versions of dependencies in the test directory with the same export interface. Then, use test runners or module resolution to load the mock instead of the real module.

```
src/
  utils/
    git.ts  // Real implementation
test/
  mocks/
    git.ts  // Mock implementation with same exports
```

This works because Node.js's module resolution allows us to specify module paths that take precedence. We can use Jest's moduleNameMapper or Mocha with ts-node/register hooks.

### Option 3: Use a Module Interceptor/Loader

For more complex cases, we can use a custom loader to intercept module imports. Node.js supports custom loaders via the `--experimental-loader` flag.

This is more complex but can provide the most flexible solution for deep mocking of ES modules.

## Immediate Recommendations

1. Start moving critical functions that need mocking to use dependency injection
2. For modules that are frequently mocked (like execa), create a small wrapper that makes testing easier:

```typescript
// src/utils/exec.ts
import {execa as realExeca} from 'execa'

export const execa = realExeca

// In tests, you can then override this module more easily
```

3. Consider setting up a proper testing framework that supports ES modules well, like Vitest (which handles ESM mocking very well).

## Additional Resources

- [Node.js Loaders API](https://nodejs.org/api/esm.html#loaders)
- [Vitest for ESM Testing](https://vitest.dev/guide/mocking.html)
- [TestDouble.js](https://github.com/testdouble/testdouble.js) - A mocking library with ESM support
