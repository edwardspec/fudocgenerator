/**
 * Misc. utility functions.
 */

'use strict';

const { config } = require( '.' ),
	fs = require( 'fs' ),
	os = require( 'os' ),
	stripJsonComments = require( 'strip-json-comments' );

var util = {};

/** Directory to use for cache files, etc. */
util.tmpdir = os.tmpdir() + '/fudocgenerator';

/** Opened descriptor of logfile (if any). Used in util.log(). */
var logfileDescriptor = null;

/**
 * List of unknown items for which warnAboutUnknownItem() has already printed a warning.
 * Format: { ItemCode1, ItemCode2, ... }
 */
var alreadyWarnedAboutItem = new Set();

/**
 * List of unknown monsters for which warnAboutUnknownMonster() has already printed a warning.
 * Format: { MonsterCode1, MonsterCode2, ... }
 */
var alreadyWarnedAboutMonster = new Set();

/**
 * Write a string into the debugging log.
 *
 * @param {string} errorMessage
 */
util.log = function ( errorMessage ) {
	if ( !logfileDescriptor ) {
		logfileDescriptor = fs.openSync( config.logfile, 'w' );
	}

	fs.writeSync( logfileDescriptor, errorMessage + '\n' );
};

/**
 * Turn non-strict JSON (with comments, newlines, etc.) into a string suitable for JSON.parse().
 *
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

	// Remove comments (JSON standard doesn't allow them).
	relaxedJson = stripJsonComments( relaxedJson );

	// Remove both \r and BOM (byte order mark) symbols, because they confuse JSON.parse().
	relaxedJson = relaxedJson.replace( /(\uFEFF|\r)/g, '' );

	// Iterate over each character, and if we find "new line" or "tab" characters inside the quotes,
	// replace them with "\n" and "\t" respectively, making this a valid JSON.
	[...relaxedJson].forEach( ( char ) => {
		// Non-escaped " means that this is start/end of a string.
		if ( char === '"' && prevChar !== '\\' ) {
			isInsideQuotes = !isInsideQuotes;
		} else if ( isInsideQuotes ) {
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

	return sanitizedJson;
};

/**
 * Make error from JSON.parse() more readable by adding "text before/after the position of error".
 * Normal error like "Unexpected token { in JSON at position 1005" is inconvenient to troubleshoot.
 *
 * @param {Error} exception Exception thrown by JSON.parse().
 * @param {string} sourceCode String that was passed to JSON.parse() as parameter.
 * @return {string} Improved error message.
 * Example of improved message:
 * ... "path": "/a", "value": 123 } <<<SYNTAX ERROR HERE>>>{ "op": "add", "path": "/b" ...
 */
util.addContextToJsonError = function ( exception, sourceCode ) {
	var errorMessage = exception.message;

	var match = errorMessage.match( 'at position ([0-9]+)' );
	if ( match ) {
		// We are quoting symbolsToQuote before AND symbolsToQuote after the error position.
		// As such, up to 2*symbolsToQuote symbols can be quoted.
		var symbolsToQuote = 100,
			position = parseInt( match[1] ),
			quoteBefore = sourceCode.slice( 0, position ).replace( /\s+/g, ' ' ),
			quoteAfter = sourceCode.slice( position ).replace( /\s+/g, ' ' );

		quoteBefore = quoteBefore.slice( -1 * symbolsToQuote );
		quoteAfter = quoteAfter.slice( 0, symbolsToQuote );

		errorMessage += '\n\t... ' + quoteBefore + '<<<SYNTAX ERROR HERE>>>' + quoteAfter + ' ...';
	}

	return errorMessage;
};

/**
 * Load the contents of one *.config/*.object file from the Starbound mod.
 * Returns the parsed structure (if parsing was successful) or false (if it failed).
 *
 * @param {string} filename
 * @return {Object | false}
 */
util.loadModFile = function ( filename ) {
	if ( filename[0] !== '/' ) {
		filename = config.pathToMod + '/' + filename;
	}

	var sanitizedJson = util.sanitizeRelaxedJson( fs.readFileSync( filename ).toString() );
	var result;

	try {
		result = JSON.parse( sanitizedJson );
	} catch ( error ) {
		console.log( '[warning] Failed to load JS file: ' +
			filename + ': ' + util.addContextToJsonError( error, sanitizedJson )
		);
		return false;
	}

	return result;
};

/**
 * Slightly reduce the size of asset by removing keys that we don't use anywhere.
 * This causes the cache of loadModFile() to be more compact and slighly reduces loading time.
 *
 * @param {Object} data
 */
util.removeIrelevantAssetKeys = function ( data ) {
	for ( var keyToDelete of config.ignoredAssetKeys ) {
		delete data[keyToDelete];

		if ( data.upgradeStages ) {
			for ( var stage of data.upgradeStages ) {
				delete stage[keyToDelete];
			}
		}
	}
};

/**
 * Find the file by searching both in the mod and in vanilla. (files from the mod have priority)
 *
 * @param {string} relativePath
 * @return {string|false} Full path to existing file (if found) or false (if not found).
 */
util.findInModOrVanilla = function ( relativePath ) {
	var pathCandidates = [
		config.pathToMod + '/' + relativePath,
		config.pathToVanilla + '/' + relativePath
	];
	for ( var possiblePath of pathCandidates ) {
		if ( fs.existsSync( possiblePath ) ) {
			// Found the file!
			return possiblePath;
		}
	}

	return false;
};

/**
 * Remove excessive digits after the comma in float number.
 *
 * @param {float} number Floating-point number, e.g. "1.234567".
 * @param {int} digitsAfterComma How many digits to leave, e.g. 2.
 * @return {float} Trimmed floating-point number, e.g. "1.23".
 */
util.trimFloatNumber = function ( number, digitsAfterComma ) {
	var divisor = 10 ** digitsAfterComma;
	return Math.round( number * divisor ) / divisor;
};

/**
 * Correctly convert number like "0.55" into percent (55).
 *
 * @param {float} ratio Floating-point number between 0 and 1, e.g. "0.123".
 * @return {float} Resulting percent, e.g. "12.3".
 */
util.ratioToPercent = function ( ratio ) {
	// We can't just multiply ratio by 100, because in JavaScript 0.55*100 = 55.00000000000001.
	return parseFloat( ratio + 'e+2' );
};

/**
 * Escape and/or replace characters that will break {{#cargo_store:}} when used as field values.
 *
 * @param {string|number} arbitraryString
 * @return {string}
 */
util.escapeParameterOfCargoStore = function ( arbitraryString ) {
	if ( typeof ( arbitraryString ) !== 'string' ) {
		// Likely a number. Cast to string.
		arbitraryString = String( arbitraryString );
	}

	return arbitraryString.replace( /\{/g, '(' ).replace( /\}/g, ')' ).replace( /\|/g, '{{!}}' );
};

/**
 * Capitalize the first letter of string.
 *
 * @param {string} str
 * @return {string}
 */
util.ucfirst = function ( str ) {
	return str.charAt( 0 ).toUpperCase() + str.slice( 1 );
};

/**
 * Calculate sum of numbers.
 *
 * @param {number[]} values
 * @return {number}
 */
util.sum = function ( values ) {
	var sum = 0;
	for ( var i = 0; i < values.length; i++ ) {
		sum += values[i];
	}
	return sum;
};

/**
 * Callback to use with Array.sort() for numeric sort.
 *
 * @param {number} a
 * @param {number} b
 * @return {number}
 */
util.compareNum = function ( a, b ) {
	return a - b;
};

/**
 * For a list of values like [ 10, 20, 20, 40 ], calculate a human-readable list of chances
 * to have each value (e.g. "20 (50%), 10 (25%), 40 (25%)").
 *
 * @param {Mixed[]} arbitraryValues
 * @param {string} optionalSuffixAfterValue
 * @return {string}
 */
util.describeDistribution = function ( arbitraryValues, optionalSuffixAfterValue = '' ) {
	let useCount = {}; // { value: numberOfOccurences1, ... }
	for ( let value of arbitraryValues ) {
		useCount[value] = ( useCount[value] || 0 ) + 1;
	}

	return Object.entries( useCount )
		.sort( ( a, b ) => b[1] - a[1] )
		.map( ( [ value, uses ] ) => {
			var percent = Math.ceil( 100 * uses / arbitraryValues.length );
			return value + optionalSuffixAfterValue + ' (' + percent + '%)';
		} ).join( ', ' );
};

/**
 * Add all methods from mixin to some class, including getters/setters.
 *
 * @param {Object} targetClass
 * @param {Object} mixin
 */
util.addMixin = function ( targetClass, mixin ) {
	Object.defineProperties(
		targetClass.prototype,
		Object.getOwnPropertyDescriptors( mixin )
	);
};

/**
 * Convert an array like [ [ 0.15, "value1" ], [ 0.25, "value2" ], ... ],
 * where 0.15 and 0.25 are arbitrary weights, into an array where the sum of all weights is 1.
 *
 * @param {Array} weightedOptions
 * @return {Array} normalizedOptions
 */
util.normalizeWeights = function ( weightedOptions ) {
	var weight, value;
	var sumOfWeights = 0;
	for ( [ weight, value ] of weightedOptions ) {
		sumOfWeights += weight;
	}
	if ( sumOfWeights === 0 ) {
		// Sanity check.
		throw new Error( 'normalizeWeights(): sum of weights is 0.' );
	}

	var normalizedOptions = [];
	for ( [ weight, value ] of weightedOptions ) {
		normalizedOptions.push( [ weight / sumOfWeights, value ] );
	}

	return normalizedOptions;
};

/**
 * Flatten the array like  [ [ 0.15, value1 ], [ 0.25, value2 ], ... ],
 * where "value" can also be an array like that, by integrating these subarrays into main array.
 * Resulting array should only have strings as values.
 *
 * @param {Array} weightedOptions
 * @return {Array} unwrappedOptions
 */
util.flattenWeightedPool = function ( weightedOptions ) {
	var unwrappedOptions = [];

	for ( let [ weight, value ] of weightedOptions ) {
		if ( Array.isArray( value ) ) {
			// This subpool can have other subpools inside,
			// so let's unwrap it recursively.
			let subpool = util.flattenWeightedPool( value );
			for ( let [ subweight, stringValue ] of subpool ) {
				unwrappedOptions.push( [ weight * subweight, stringValue ] );
			}
		} else {
			// Already a string, not a subpool.
			unwrappedOptions.push( [ weight, value ] );
		}
	}

	// Ensure that there aren't any duplicates within unwrappedOptions.
	var values = {}; // { value1: weight1, ... }
	for ( let [ weight, value ] of unwrappedOptions ) {
		values[value] = ( values[value] || 0 ) + weight;
	}

	var unwrappedOptionsUnique = [];
	for ( let [ value, weight ] of Object.entries( values ) ) {
		unwrappedOptionsUnique.push( [ weight, value ] );
	}

	return unwrappedOptionsUnique;
};

/**
 * Print a warning about encountered unknown item (e.g. when it is mentioned in a Recipe),
 * but no more than once per item.
 *
 * @param {string} itemCode
 */
util.warnAboutUnknownItem = function ( itemCode ) {
	if ( alreadyWarnedAboutItem.has( itemCode ) ) {
		return;
	}

	util.log( '[warning] Unknown item in the recipe: ' + itemCode );
	alreadyWarnedAboutItem.add( itemCode );
};

/**
 * Print a warning about encountered unknown monster (e.g. when it is mentioned in a Recipe),
 * but no more than once per monster.
 *
 * @param {string} monsterCode
 */
util.warnAboutUnknownMonster = function ( monsterCode ) {
	if ( alreadyWarnedAboutMonster.has( monsterCode ) ) {
		return;
	}

	util.log( '[warning] Unknown monster in the recipe: ' + monsterCode );
	alreadyWarnedAboutMonster.add( monsterCode );
};

// Used by getAttackMetadata().
var trivialAbilities = new Set( config.trivialWeaponAbilities );

/**
 * Gather metadata (key-value parameters for storing in Cargo) of {primary,alt}Ability of item.
 *
 * @param {Object} attack Either item.primaryAbility or item.altAbility.
 * @param {string} prefix Arbitrary string that will be prepended to keys of resulting object.
 * @param {float} damageMultiplier The damage values (if any) will be multiplied by this number.
 * @return {Object} Key-value map (string => string).
 */
util.getAttackMetadata = function ( attack, prefix, damageMultiplier ) {
	var metadata = {};
	if ( attack.name && !trivialAbilities.has( attack.name ) ) {
		metadata.ability = attack.name;
	}

	var dps = attack.baseDps;
	if ( !dps && attack.chainDps && attack.crackDps ) {
		// Whips
		dps = attack.chainDps + attack.crackDps;
	}

	if ( dps ) {
		var fireTime = attack.fireTime || 1;

		// Randomly generated weapons don't have a fixed baseDps/fireTime,
		// they use [minValue, maxValue] arrays instead.
		if ( Array.isArray( dps ) ) {
			// Average DPS.
			dps = 0.5 * ( dps[0] + dps[1] );
		}
		if ( Array.isArray( fireTime ) ) {
			// Average fire time.
			fireTime = 0.5 * ( fireTime[0] + fireTime[1] );
		}

		metadata.hitsPerSecond = util.trimFloatNumber( 1 / fireTime, 1 );
		metadata.damagePerHit = util.trimFloatNumber( damageMultiplier * dps * fireTime, 1 );
	}

	// Technically crit chance/bonus can be zero, but it's equal to not having any crit bonuses.
	if ( attack.critChance && attack.critBonus ) {
		metadata.critChance = attack.critChance;
		metadata.critBonus = attack.critBonus;
	}

	if ( attack.comboSteps ) {
		metadata.comboSteps = attack.comboSteps;
	}

	// Prepend prefix (string) to each key in "metadata" object.
	var prefixedMetadata = {};
	for ( var [ key, value ] of Object.entries( metadata ) ) {
		prefixedMetadata[prefix + key] = value;
	}
	return prefixedMetadata;
};

module.exports = util;
