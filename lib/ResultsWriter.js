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
	 * @param {string} ItemCode Internal ID of the item, e.g. "waxsword".
	 */
	write( ItemName, wikitext, ItemCode ) {
		if ( [ 'Research', 'Pixels' ].indexOf( ItemName ) !== -1 ) {
			// Don't record anything for Research or Pixels,
			// these are extremely huge pages that are not very useful.
			return;
		}

		this.writeIntoSeparateFile( ItemName, wikitext );
		this.writeIntoPywikibotImportFile( ItemName, wikitext, ItemCode );
	}

	/**
	 * Write information about this item into a separate *.txt file in the results directory.
	 */
	writeIntoSeparateFile( ItemName, wikitext ) {
		var validFilename = ItemName.replace( / /g, '_' ).replace( '/', '%2F' );

		var fd = fs.openSync( config.outputDir + '/' + validFilename + '.txt', 'w' );
		fs.writeSync( fd, wikitext );
		fs.closeSync( fd );
	}

	/**
	 * Add information about this item into Pywikibot's import file (for mass creation of pages).
	 * @see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
	 */
	writeIntoPywikibotImportFile( ItemName, wikitext, ItemCode ) {
		if ( !this.pywikibotFd ) {
			this.pywikibotFd = fs.openSync( config.outputDir + '/pywikibot.import.txt', 'w' );
		}

		if ( ItemName.indexOf( '[' ) !== -1 || ItemName.indexOf( ']' ) !== -1 ) {
			// Can't create pages with titles like "Kiri Fruit [FU]",
			// because "[" and "]" are invalid characters for MediaWiki titles.
			// TODO: just rename such pages to use braces ( and ) instead of [ and ].
			return;
		}

		// We create two pages. One is [[Template:Automatic item info/NameOfItemHere]], which is meant
		// to be overwritten by bot and not edited by humans.
		// Another is the page [[NameOfItemHere]], which only includes the above-mentioned template
		// and can be skipped by passing "-nocontent:Automatic" to parameter "pwb.py pagefromfile".
		var wrappedWikitext = '';
		wrappedWikitext += "{{-start-}}\n'''Template:Automatic item info/" + ItemName + "'''\n" + wikitext + '\n{{-stop-}}\n';
		wrappedWikitext += "{{-start-}}\n'''" + ItemName + "'''\n";
		wrappedWikitext += '{{Automatic infobox item|' + ItemCode + "}}<!-- Please don't delete this line -->\n";
		wrappedWikitext += "<!-- You can write the text below. -->\n\n\n";
		wrappedWikitext += '{{Automatic item info/' + ItemName + "}}<!-- Please don't delete this line -->\n{{-stop-}}\n";

		fs.writeSync( this.pywikibotFd, wrappedWikitext );
	}
}

module.exports = new ResultsWriter();
