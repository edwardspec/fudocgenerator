/**
 * Misc. utility functions.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	vm = require( 'vm' ),
	ItemDatabase = require( './ItemDatabase' );

/** Open descriptor of logfile (if any). Used in util.log(). */
var logfileDescriptor = null;

/**
 * Returns true if someObject is a key-value map with string keys and integer values.
 * Used in sanity checks.
 */
module.exports.log = function( errorMessage ) {
	if ( !logfileDescriptor ) {
		logfileDescriptor = fs.openSync( config.logfile, 'a' );
	}

	fs.writeSync( logfileDescriptor, errorMessage + "\n" );
};

/**
 * Returns true if someObject is a key-value map that can be inputs/outputs of a Recipe,
 * such as a set of { itemCode: quantityOrChangeOrUnknown, ... } pairs.
 * Used in sanity checks.
 * Valid values are: integer (for count), number followed by "%" (for chance), string "UNKNOWN".
 */
module.exports.isValidInputOrOutput = function( someObject ) {
	if ( typeof ( someObject ) !== 'object' ) {
		return false;
	}

	for ( var key in someObject ) {
		if ( typeof( key ) !== 'string' ) {
			return false;
		}

		var value = someObject[key];
		if ( value === 'UNKNOWN' ) {
			// This value is allowed.
			continue;
		}

		if ( typeof( value ) === 'string' && value.slice( -1 ) === '%' ) {
			// Numbers followed by '%' symbol are allowed.
			value = value.slice( 0, -1 );
			if ( value != parseFloat( value ) ) {
				// Not a valid number.
				return false;
			}

			// This value is allowed.
			continue;
		}

		if ( value != parseInt( value ) ) {
			// Not a valid integer.
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
	return vm.runInThisContext( '_ThisVariableIsNeverUsed = ' + jsSourceCode );
};

/**
 * Get wikitext representation of the recipe ingredients, e.g. { "carbon": 3, "oxygen": 4 }.
 * @param {object} ingredientsMap
 * @return {string}
 */
module.exports.ingredientsListToWikitext = function ( ingredientsMap ) {
	var wikitext = '';

	for ( var [ itemName, quantityOrChance ] of Object.entries( ingredientsMap ) ) {
		// FIXME: don't need this duplicated (see isValidInputOrOutput) check for "is this is a percent?".
		// Have this value normalized beforehand.
		var count = null,
			percent = null;

		if ( quantityOrChance !== 'UNKNOWN' ) {
			if ( typeof( quantityOrChance ) == 'string' && quantityOrChance.slice( -1 ) == '%' ) {
				percent = quantityOrChance; // With trailing '%' preserved
			} else {
				count = quantityOrChance;
			}
		}

		wikitext += '* ';
		if ( count ) {
			wikitext += "'''" + count + "x''' ";
		}

		wikitext += '[[' + ItemDatabase.getDisplayName( itemName ) + ']]';

		if ( percent ) {
			wikitext += " '''" + percent + "'''";
		}

		wikitext += '\n';
	}

	return wikitext;
};
