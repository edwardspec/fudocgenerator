'use strict';

var config = require( '../config.json' ),
	fs = require( 'fs' );

// Create the output files with wikitext.
// TODO: this is temporary (for checking the correctness of output).
// Ultimately the output should be something like *.xml dump for Special:Import
// or an import file for pywikipediabot - something that would allow quick creation of pages.

/**
 * Methods used by generate.js to write the generated wikitext into the output file(s).
 */
class ResultsWriter {
	constructor( station, inputs, outputs ) {
		fs.mkdirSync( config.outputDir, { recursive: true } );
	}

	/**
	 * @param {string} ItemName Human-readable name of item, e.g. "Wax Sword".
	 * @param {string} wikitext Contents of the automatically generated wikitext page.
	 */
	write( ItemName, wikitext ) {
		var validFilename = ItemName.replace( / /g, '_' ).replace( '/', '%2F' );

		var fd = fs.openSync( config.outputDir + '/' + validFilename + '.txt', 'w' );
		fs.writeSync( fd, wikitext );
		fs.closeSync( fd );
	}
}

module.exports = new ResultsWriter();
