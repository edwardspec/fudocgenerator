'use strict';

module.exports = {
	ignorePatterns: [ 'package-lock.json', 'package.json' ],
	env: {
		node: true,
		es2020: true
	},
	extends: [
		'wikimedia',
		'wikimedia/node',
		'wikimedia/language/es2020'
	],
	parserOptions: {
		ecmaVersion: 11
	},
	rules: {
		// Might enable this later.
		'no-loop-func': 'off', // Only matters for async callbacks, many false positives for synchronous.

		// Necessary to skip, e.g. process.exit() may be necessary for linter.
		'no-console': 'off',
		'no-process-exit': 'off',
		'jsdoc/no-undefined-types': 'off', // Don't want to add unnecessary require() just to use a class in JSDoc annotation

		// Not exactly against applying these in the future,
		// but they are very annoying with the current codestyle ("for ( var [ a, b ] of ..." loops, etc.).
		'prefer-const': 'off',

		// Don't want to apply these.
		'array-bracket-spacing': 'off',
		'computed-property-spacing': 'off',
		'max-len': 'off',
		'no-var': 'off',

		// Misconfiguration of "eslint-config-wikimedia": rule is used, but is not installed via package.json.
		'es/no-promise-any': 'off'
	},
	overrides: [
		{
			// Duplicate "@doc" keys in JSON file
			files: [ 'config.json' ],
			rules: {
				'no-dupe-keys': 'off'
			}
		}
	]
};
