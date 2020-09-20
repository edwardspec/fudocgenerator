/**
 * Misc. utility functions.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	vm = require( 'vm' ),
	util = require( './util' ),
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
		if ( typeof( key ) !== 'string' || key === 'undefined' ) {
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

	// Some input files have "new line" character within the JavaScript strings (between " and ").
	// This is invalid JavaScript (would cause syntax error), but we must be tolerant to such input.
	// This is especially important for weapons/tools, as most of them have multiline descriptions.
	var sanitizedJsCode = '',
		isInsideQuotes = false,
		prevChar = '';

	// Iterate over each character, and if we find "new line" character inside the quotes,
	// replace it with "\n", making this a valid JavaScript code.
	[...jsSourceCode].forEach( char => {
		// Remove \r symbols everywhere, \n is enough.
		if ( char == '\r' ) {
			return;
		}

		// Non-escaped " means that this is start/end of a string.
		if ( char == '"' && prevChar != '\\' ) {
			isInsideQuotes = !isInsideQuotes;
		}

		if ( isInsideQuotes && char == '\n' ) {
			// Found invalid JavaScript, let's fix it.
			char = '\\n';
		}

		sanitizedJsCode += char;
		prevChar = char;
	} );

	// This config is fully functional JavaScript code (not JSON), with comments and all,
	// but without the necessary "module.exports =", so require() can't be used.
	return vm.runInThisContext( '_ThisVariableIsNeverUsed = ' + sanitizedJsCode );
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
		// Human-readable string that can be used to mention this item, e.g. "[[Carbon Dioxide]]".
		// This can be provided as wikitext (e.g. pseudo-item "Air (on Desert planets)" for the
		// outputs of Atmospheric Condenser, but in most cases it will be a normal item.
		var displayNameWikitext = amount.displayNameWikitext;
		if ( !displayNameWikitext ) {
			// Normal item.
			var displayName = ItemDatabase.getDisplayName( itemName );
			if ( !displayName ) {
				util.log( "[warning] Ignoring the recipe that refers to unknown item: " + itemName );
				return '';
			}

			// Link to the article about this item.
			displayNameWikitext = '[[' + displayName + ']]';
		}

		wikitext += '* ';
		if ( amount.count ) {
			wikitext += "'''" + amount.count + "x''' ";
		}

		wikitext += displayNameWikitext;

		if ( amount.chance ) {
			// Round to 2 digits.
			wikitext += " '''" + ( Math.round( amount.chance * 100 ) / 100 ) + "%'''";
		}

		if ( amount.rarity ) {
			// Note: we use MediaWiki templates (Template:CentrifugeRarity and its subtemplates
			// such as Template:CentrifugeChange/IronCentrifuge) to display actual values.
			// See "templatesAndStyles/" directory for examples.
			var [ rarity, chanceDivisor ] = amount.rarity;
			wikitext += " ''({{CentrifugeRarity|" + rarity + '|' + chanceDivisor;

			if ( craftingStation === 'Gas Centrifuge' ) {
				wikitext += '|onlyGasCentrifuge=1';
			} else if ( craftingStation === 'Sifter' ) {
				wikitext += '|sifter=1';
			} else if ( craftingStation === 'Rock Crusher' ) {
				wikitext += '|rock=1';
			}

			wikitext += "}})''";
		}

		wikitext += '\n';
	}

	return wikitext;
};

/**
 * Convert representation of input/output ingredients from *.recipe files (native crafting recipes),
 * such as [ { "item" : "something", "count" : 1 } ],
 * into inputs/outputs maps expected by Recipe class,
 * such as { "something": { count: 1 } }
 * @param {object} nativeCraftingInput
 * @return {object} Value suitable for being used as inputs/outputs in RecipeDatabase.add().
 */
module.exports.craftingInputToRecipeInput = function ( nativeCraftingInput ) {
	var inputs = {};

	if ( !Array.isArray( nativeCraftingInput ) ) {
		nativeCraftingInput = [ nativeCraftingInput ];
	}

	nativeCraftingInput.forEach( function ( ingredient ) {
		inputs[ingredient.item || ingredient.name] = { count: ingredient.count };
	} );

	return inputs;
}

/**
 * Normalize the item description for showing it outside of game.
 * For example, removes the color codes (e.g. "^#e43774;" or "^reset;" ),
 * as they only work in-game, and we don't really care to implement them here.
 * @param {string} description Value of "shortdescription" key in items/objects.
 * @return {string}
 */
module.exports.cleanDescription = function ( description ) {
	return description.replace( /\^[^;^]+;/g, '' ).trim();
};
