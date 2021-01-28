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
		// This must be fixed.
		'no-use-before-define': 'off',

		// Might enable this later.
		eqeqeq: 'off',
		'no-loop-func': 'off', // Only matters for async callbacks, many false positives for synchronous.

		// Default is { "destructuring": "any" }, which is annoying in "for ( let [ key, value ] of ... )" loops,
		// where only one of key/value might be eligible for "const".
		'prefer-const': [ 'error', { destructuring: 'all' } ],

		// Necessary to skip, e.g. process.exit() may be necessary for linter.
		'mediawiki/valid-package-file-require': 'off',
		'no-console': 'off',
		'no-process-exit': 'off',
		'jsdoc/no-undefined-types': 'off', // Don't want to add unnecessary require() just to use a class in JSDoc annotation

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
