import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

export default [
  includeIgnoreFile(gitignorePath),
  ...oclif,
  prettier,
  {
    rules: {
      'perfectionist/sort-object-types': 'off',
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-classes': 'off',
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-interfaces': 'off',
      'perfectionist/sort-union-types': 'off',
      'perfectionist/sort-switch-case': 'off',
      'no-await-in-loop': 'off',
      'camelcase': ['error', {
        'properties': 'never',
        'ignoreDestructuring': true
      }],
      '@stylistic/lines-between-class-members': 'off',
      '@stylistic/padding-line-between-statements': 'off',
      'max-params': 'off',
      'complexity': 'off',
      'no-warning-comments': 'off',
      'max-depth': 'off',
      'import/default': 'off',
      'import/export': 'off',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-duplicates': 'off',
      'import/no-unresolved': 'off',
      'mocha/consistent-spacing-between-blocks': 'off'
    }
  }
]
