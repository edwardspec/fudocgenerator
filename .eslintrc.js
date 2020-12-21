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
		camelcase: 'off',
		'no-loop-func': 'off',
		'no-new-wrappers': 'off',
		'max-statements-per-line': 'off',
		'no-return-assign': 'off',
		'no-shadow': 'off',
		'no-tabs': 'off',
		'no-underscore-dangle': 'off',
		'no-use-before-define': 'off',

		// Might enable this later.
		eqeqeq: 'off',

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
