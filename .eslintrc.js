'use strict';

module.exports = {
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
		eqeqeq: 'off',
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
		'no-multiple-empty-lines': 'off',
		'no-var': 'off',
		'one-var': 'off',
		'vars-on-top': 'off'
	}
};
