/**
 * Prepare all words that are used in item descriptions, etc. for spellcheck via "hunspell" tool.
 * (obviously "hunspell" must be installed, or it won't work)
 *
 * Usage: node tools/spellcheck.js | hunspell -d en_US,en_GB -1 -L
 *
 * TODO: add a whitelist of made up words like "Durasteel" (which are not in any dictionaries).
 */

'use strict';

const { ItemDatabase } = require( '../lib' );

// Find all words in assets: { "word1": [ "filename1", "filename2", ... ], "word2": [ ... ], ... }
var wordToFilenames = new Map();

ItemDatabase.forEach( ( itemCode, item ) => {
	var asset = item.asset;
	if ( asset.vanilla && !asset.patched ) {
		// Skip vanilla assets that are not patched by the mod.
		return;
	}

	// TODO: possibly add monster description, codex text, etc.
	var stringsToCheck = [
		item.description
	];

	var words = stringsToCheck.join( ' ' ).match( /[a-z]+/ig ) || [];
	words.forEach( ( word ) => {
		word = word.toLowerCase();

		var filenames = wordToFilenames.get( word );
		if ( !filenames ) {
			filenames = new Set();
			wordToFilenames.set( word, filenames );
		}

		filenames.add( asset.filename );
	} );
} );

// Iterate over unique, alphabetically sorted list of words.
for ( let word of [...wordToFilenames.keys()].sort() ) {
	// When you run hunspell with -1 flag, it will only check the first word (before \t).
	// Everything after that (the list of files where this word is present) is to make error messages
	// more useful (hunspell with -L flag will print the entire line where it found an unknown word).
	console.log( word + '\t' + [...wordToFilenames.get( word )].join( ' | ' ) );
}
