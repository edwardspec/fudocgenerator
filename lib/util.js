/**
 * Misc. utility functions.
 */

'use strict';

const { config } = require( '.' ),
	fs = require( 'fs' ),
	os = require( 'os' ),
	path = require( 'path' ),
	stripJsonComments = require( 'strip-json-comments' );

var util = {};

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
