/**
 * Misc. utility functions.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	vm = require( 'vm' );

/**
 * Returns true if someObject is a key-value map with string keys and integer values.
 * Used in sanity checks.
 */
module.exports.isStringToIntegerMap = function( someObject ) {
	if ( typeof ( someObject ) !== 'object' ) {
		return false;
	}

	for ( var key in someObject ) {
		if ( typeof( key ) !== 'string' ) {
			return false;
		}

		var value = someObject[key];
		if ( value != parseInt( value ) ) {
			return false;
		}
	}

	return true;
};

/**
 * Helper function: reduces the array like { "carbon": 3, "oxygen": [ 1, 4, 9 ] }
 * into { "carbon": 3, "oxygen": 1 } for extractorStage=0,
 * into { "carbon": 3, "oxygen": 4 } for extractorStage=1, etc.
 */
module.exports.getStageValues = function ( valuesArray, extractorStage ) {
	var valuesForThisStage = {};

	for ( var [ itemName, counts ] of Object.entries( valuesArray ) ) {
		valuesForThisStage[itemName] =
			Number.isInteger( counts ) ? counts : counts[extractorStage];
	}

	return valuesForThisStage;
};

/**
 * Load the contents of one *.config/*.object file from the Starbound mod.
 * Returns the parsed structure.
 */
module.exports.loadModFile = function ( filename ) {
	if ( filename[0] !== '/' ) {
		filename = config.pathToMod + '/' + filename;
	}

	var jsSourceCode = new String( fs.readFileSync( filename ) );

	// TODO: some input files have "new line" character within the JavaScript strings (between " and ").
	// This is invalid JavaScript (would cause syntax error), but we must be tolerant to such input.

	// This config is fully functional JavaScript code (not JSON), with comments and all,
	// but without the necessary "module.exports =", so require() can't be used.
	return vm.runInNewContext( '_ThisVariableIsNeverUsed = ' + jsSourceCode );
};
