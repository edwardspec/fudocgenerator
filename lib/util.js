/**
 * Misc. utility functions.
 */

'use strict';

var util = {};

var config = require( '../config.json' ),
	fs = require( 'fs' ),
	os = require( 'os' ),
	path = require( 'path' ),
	stripJsonComments = require( 'strip-json-comments' );

/** Opened descriptor of logfile (if any). Used in util.log(). */
var logfileDescriptor = null;

/**
 * List of unknown items for which warnAboutUnknownItem() has already printed a warning.
 * Format: { ItemCode1: true, ItemCode2: true, ... }
 */
var alreadyWarnedAboutItem = {};

/**
 * Write a string into the debugging log.
 * @param {string} errorMessage
 */
util.log = function( errorMessage ) {
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
util.isValidInputOrOutput = function( someObject ) {
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
util.getStageValues = function ( valuesArray, extractorStage ) {
	var valuesForThisStage = {};

	for ( var [ itemName, counts ] of Object.entries( valuesArray ) ) {
		var count = Number.isInteger( counts ) ? counts : counts[extractorStage];

		valuesForThisStage[itemName] = { count: count };
	}

	return valuesForThisStage;
};

/**
 * Turn non-strict JSON (with comments, newlines, etc.) into a string suitable for JSON.parse().
 * @param {string} relaxedJson
 * @return {string}
 */
util.sanitizeRelaxedJson = function ( relaxedJson ) {
	// Some input files have "new line" character within the JSON strings (between " and ").
	// This is invalid JSON (would cause syntax error), but we must be tolerant to such input.
	// This is especially important for weapons/tools, as most of them have multiline descriptions.
	var sanitizedJson = '',
		isInsideQuotes = false,
		prevChar = '';

	// Remove both \r and BOM (byte order mark) symbols, because they confuse JSON.parse().
	relaxedJson = relaxedJson.replace( /(\uFEFF|\r)/g, '' );

	// Iterate over each character, and if we find "new line" or "tab" characters inside the quotes,
	// replace them with "\n" and "\t" respectively, making this a valid JSON.
	[...relaxedJson].forEach( char => {
		// Non-escaped " means that this is start/end of a string.
		if ( char == '"' && prevChar != '\\' ) {
			isInsideQuotes = !isInsideQuotes;
		}

		if ( isInsideQuotes ) {
			switch ( char ) {
				case '\n':
					char = '\\n';
					break;
				case '\t':
					char = '\\t';
			}
		}

		sanitizedJson += char;
		prevChar = char;
	} );

	// Remove comments (JSON standard doesn't allow them).
	sanitizedJson = stripJsonComments( sanitizedJson );

	return sanitizedJson;
};

/** Path to file that will be updated every time the cache of loadModFile() gets updated. */
var cacheUpdatedTouchFile;

/**
 * Modification time of cacheUpdatedTouchFile (see above).
 * Only checked once (at the first loadModFile).
 */
var cacheUpdatedMtime;

/**
 * Load the contents of one *.config/*.object file from the Starbound mod.
 * Returns the parsed structure.
 */
util.loadModFile = function ( filename ) {
	// Determine the time when the cache was last updated.
	if ( !cacheUpdatedTouchFile ) {
		cacheUpdatedTouchFile = os.tmpdir() + '/fudocgenerator/VmScriptCache/.updated';
		cacheUpdatedMtime = fs.existsSync( cacheUpdatedTouchFile ) ? fs.statSync( cacheUpdatedTouchFile ).mtimeMs : 0;
	}

	if ( filename[0] !== '/' ) {
		filename = config.pathToMod + '/' + filename;
	}

	var cachedFilename = os.tmpdir() + '/fudocgenerator/VmScriptCache' + filename + '.cache';

	if ( fs.existsSync( cachedFilename ) && cacheUpdatedMtime > fs.statSync( filename ).mtimeMs ) {
		// Found serialized result in cache.
		// This is much faster than full parsing (assets are not strict JSON and must be sanitized).
		return JSON.parse( fs.readFileSync( cachedFilename ).toString() );
	}

	var sanitizedJson = util.sanitizeRelaxedJson( new String( fs.readFileSync( filename ) ) );
	var result = JSON.parse( sanitizedJson );

	// Add to cache.
	fs.mkdirSync( path.dirname( cachedFilename ), { recursive: true } );
	fs.writeFileSync( cachedFilename, JSON.stringify( result ) );
	fs.writeFileSync( cacheUpdatedTouchFile, '' );

	return result;
};

/**
 * Remove excessive digits after the comma in float number.
 * @param {float} number Floating-point number, e.g. "1.234567".
 * @param {int} digitsAfterComma How many digits to leave, e.g. 2.
 * @return {float} Trimmed floating-point number, e.g. "1.23".
 */
util.trimFloatNumber = function ( number, digitsAfterComma ) {
	var divisor = 10 ** digitsAfterComma;
	return Math.round( number * divisor ) / divisor;
};

/**
 * Get wikitext representation of the recipe ingredients,
 * e.g. { "carbon": { count: 3 }, "oxygen": { chance: 40 }, "hydrogen": { rarity: [ "rare", 3 ] } }.
 * @param {object} ingredientsMap
 * @param {string} craftingStation
 * @return {string}
 */
util.ingredientsListToWikitext = function ( ingredientsMap, craftingStation ) {
	// TODO: move this method into a separate class ("IngredientsList" or something)
	var { ItemDatabase, AssetDatabase } = require( '.' );
	var wikitext = '';

	for ( var [ itemName, amount ] of Object.entries( ingredientsMap ) ) {
		// Human-readable string that can be used to mention this item, e.g. "[[Carbon Dioxide]]".
		// This can be provided as wikitext (e.g. pseudo-item "Air (on Desert planets)" for the
		// outputs of Atmospheric Condenser, but in most cases it will be a normal item.
		var displayNameWikitext = amount.displayNameWikitext;
		if ( !displayNameWikitext ) {
			// Normal item.
			var data = ItemDatabase.find( itemName );
			if ( !data ) {
				util.warnAboutUnknownItem( itemName );
				return '';
			}

			// Link to the article about this item.
			displayNameWikitext = '[[';
			if ( data.displayName != data.wikiPageName ) {
				displayNameWikitext += data.wikiPageName + '|';
			}
			displayNameWikitext += data.displayName + ']]';
		}

		wikitext += '* ';
		if ( amount.count ) {
			wikitext += "'''" + amount.count + "x''' ";
		}

		wikitext += displayNameWikitext;

		if ( amount.chance ) {
			// Round to 2 digits.
			wikitext += " '''" + util.trimFloatNumber( amount.chance, 2 ) + "%'''";
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

		if ( amount.subtype ) {
			// For bees, saplings, etc. (inputs that can have different outputs depending of subtype)
			wikitext += " ''(" + amount.subtype + ")''";
		}

		if ( amount.infrequency ) {
			// NOTE: this value is somewhat hard to display in understandable format.
			// Notation "1/123" is imperfect, but what else can we show?
			// Meaning of "infrequency": the larger is this number, the less frequently is the item produced.
			// But we can't display the exact chance and/or needed time, because it gets multiplied
			// by other factors (such as Bee Production stat) and is therefore not constant.
			wikitext += " ''(1/" + amount.infrequency + ")''";
		}

		if ( amount.averageCount ) {
			// Unlike "count" (which is the strict number of items of required input or guaranteed output),
			// averageCount represents an average number of items that will be obtained from 1 drop
			// (e.g. from defeating 1 monster, or from harvesting 1 plant).
			// If only 1 monster out of 5 drops 2 some item, then this value will be 2/5=0.4.
			wikitext += ' ~' + util.trimFloatNumber( amount.averageCount, 2 ) + 'x';
		}

		if ( amount.secondsToCraft ) {
			// How many seconds does it take for this output to be generated.
			// NOTE: this is exclusively for Liquid Collector and Erchius Converter.
			// Do NOT add this to crafting recipes (where it is irrelevant, as everyone who cares about it
			// is using Instant Crafting) or to recipes from Extraction Lab (it has fixed extraction time).
			wikitext += ' (' + amount.secondsToCraft + 's)';
		}

		if ( amount.planets ) {
			// For pseudo-items like "Air (Desert, Savannah planets)".
			var planetTypeNames = AssetDatabase.get( 'interface/cockpit/cockpit.config' ).data.planetTypeNames;

			var allPlanetNames = amount.planets.map( ( thisPlanetCode ) => planetTypeNames[thisPlanetCode] ),
				uniquePlanetNames = Array.from( new Set( allPlanetNames ) ),
				allPlanetLinks = uniquePlanetNames.map( ( planetName ) => {
					return ( planetName ? ( '[[' + planetName + ']]' ) : 'normal' );
				} );

			wikitext += ' (' + allPlanetLinks.join( ', ' ) + ' planets)';
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
util.craftingInputToRecipeInput = function ( nativeCraftingInput ) {
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
util.cleanDescription = function ( description ) {
	return description.replace( /\^[^;^]+;/g, '' ).trim();
};

/**
 * Print a warning about encountered unknown item (e.g. when it is mentioned in a Recipe),
 * but no more than once per item.
 */
util.warnAboutUnknownItem = function ( ItemCode ) {
	if ( ItemCode === 'PSEUDO_ITEM' ) {
		// Internally used by this script for pseudo-items like "Air (on Desert planets)".
		return;
	}

	if ( alreadyWarnedAboutItem[ItemCode] ) {
		// Already warned.
		return;
	}

	util.log( "[warning] Unknown item in the recipe: " + ItemCode );
	alreadyWarnedAboutItem[ItemCode] = true;
};

module.exports = util;
