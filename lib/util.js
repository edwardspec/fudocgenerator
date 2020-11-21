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

	// Remove comments (JSON standard doesn't allow them).
	relaxedJson = stripJsonComments( relaxedJson );

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

	return sanitizedJson;
};

/**
 * Make error from JSON.parse() more readable by adding "text before/after the position of error".
 * Normal error like "Unexpected token { in JSON at position 1005" is inconvenient to troubleshoot.
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
			quoteBefore = sourceCode.substring( 0, position ).replace( /\s+/g, ' ' ),
			quoteAfter = sourceCode.substring( position ).replace( /\s+/g, ' ' );

		quoteBefore = quoteBefore.substring( quoteBefore.length - symbolsToQuote );
		quoteAfter = quoteAfter.substring( 0, symbolsToQuote );

		errorMessage += '\n\t... ' + quoteBefore + '<<<SYNTAX ERROR HERE>>>' + quoteAfter + ' ...';
	}

	return errorMessage;
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
 * Returns the parsed structure (if parsing was successful) or false (if it failed).
 * @param {string} filename
 * @return {object|false}
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

	var sanitizedJson = util.sanitizeRelaxedJson( fs.readFileSync( filename ).toString() );
	var result;

	try {
		result = JSON.parse( sanitizedJson );
	} catch ( error ) {
		util.log( '[warning] Failed to load JS file: ' +
			filename + ': ' + util.addContextToJsonError( error, sanitizedJson )
		);
		return false;
	}

	// Remove keys that we don't use (reduces cache size, improves loading time).
	util.removeIrelevantAssetKeys( result );

	// Add to cache.
	fs.mkdirSync( path.dirname( cachedFilename ), { recursive: true } );
	fs.writeFileSync( cachedFilename, JSON.stringify( result ) );
	fs.writeFileSync( cacheUpdatedTouchFile, '' );

	return result;
};

/**
 * Slightly reduce the size of asset by removing keys that we don't use anywhere.
 * This causes the cache of loadModFile() to be more compact and slighly reduces loading time.
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
 * Normalize the title of MediaWiki page, e.g. "cat Ship  Door" -> "Cat Ship Door".
 * @param {string} title
 * @return {string}
 */
util.cleanPageName = function ( title ) {
	return util.ucfirst( title ).replace( /\s+/g, ' ' );
};

/**
 * Capitalize the first letter of string.
 * @param {string} str
 * @return {string}
 */
util.ucfirst = function ( str ) {
	return str.charAt(0).toUpperCase() + str.substr(1);
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
