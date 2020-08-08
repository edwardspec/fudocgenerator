/**
 * Misc. utility functions.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	vm = require( 'vm' ),
	ItemDatabase = require( './ItemDatabase' );

/** Opened descriptor of logfile (if any). Used in util.log(). */
var logfileDescriptor = null;

/**
 * Write a string into the debugging log.
 * @param {string} errorMessage
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
 * Valid values are: {} (unknown/any quantity), { count: Integer }, { chance: Float }.
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

		if ( value.count && value.count != parseInt( value.count ) ) {
			// Not a valid integer.
			return false;
		}

		if ( value.chance && value.chance != parseFloat( value.chance ) ) {
			// Not a valid number.
			return false;
		}

		// TODO: check value.rarity too (for Centrifuge recipes).
	}

	return true;
};

/**
 * Helper function: reduces the array like { "carbon": 3, "oxygen": [ 1, 4, 9 ] }
 * into { "carbon": { count: 3 }, "oxygen": { count: 1 } } for extractorStage=0,
 * into { "carbon": { count: 3 }, "oxygen": { count: 4 } } for extractorStage=1, etc.
 */
module.exports.getStageValues = function ( valuesArray, extractorStage ) {
	var valuesForThisStage = {};

	for ( var [ itemName, counts ] of Object.entries( valuesArray ) ) {
		var count = Number.isInteger( counts ) ? counts : counts[extractorStage];

		valuesForThisStage[itemName] = { count: count };
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
 * Get wikitext representation of the recipe ingredients,
 * e.g. { "carbon": { count: 3 }, "oxygen": { chance: 40 }, "hydrogen": { rarity: [ "rare", 3 ] } }.
 * @param {object} ingredientsMap
 * @param {string} craftingStation
 * @return {string}
 */
module.exports.ingredientsListToWikitext = function ( ingredientsMap, craftingStation ) {
	var wikitext = '';

	for ( var [ itemName, amount ] of Object.entries( ingredientsMap ) ) {
		wikitext += '* ';
		if ( amount.count ) {
			wikitext += "'''" + amount.count + "x''' ";
		}

		wikitext += '[[' + ItemDatabase.getDisplayName( itemName ) + ']]';

		if ( amount.chance ) {
			wikitext += " '''" + amount.chance + "%'''";
		}

		if ( amount.rarity ) {
			// Note: we use MediaWiki templates (Template:CentrifugeRarity and its subtemplates
			// such as Template:CentrifugeChange/IronCentrifuge) to display actual values.
			// See "templatesAndStyles/" directory for examples.
			var [ rarity, chanceDivisor ] = amount.rarity;
			wikitext += " ''({{CentrifugeRarity|" + rarity + '|' + chanceDivisor;

			if ( craftingStation === 'Gas Centrifuge' ) {
				wikitext += '|onlyGasCentrifuge=1'
			}

			if ( craftingStation === 'Sifter' ) {
				wikitext += '|sifter=1'
			}

			wikitext += "}})''";
		}

		wikitext += '\n';
	}

	return wikitext;
};
