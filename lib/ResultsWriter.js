'use strict';

var config = require( '../config.json' ),
	ChunkWriter = require( './ChunkWriter' ),
	util = require( './util' ),
	fs = require( 'fs' );

/**
 * Methods used by generate.js to write the generated wikitext into the output file(s).
 */
class ResultsWriter {
	constructor( station, inputs, outputs ) {
		fs.mkdirSync( config.outputDir, { recursive: true } );
		fs.mkdirSync( config.outputDir + '/pywikibot', { recursive: true } );
		fs.mkdirSync( config.outputDir + '/pages', { recursive: true } );

		this.cargoChunkWriter = new ChunkWriter(
			config.outputDir + '/pywikibot/cargoDatabase.import.txt',
			"{{-start-}}\n'''Template:Cargo/Chunk$1'''\n",
			'\n{{-stop-}}\n',
			config.cargoChunkSizeKBytes * 1024
		);
	}

	/**
	 * Add footers to opened files, if any.
	 */
	finalize() {
		this.cargoChunkWriter.finalize();
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
	 * This is mainly used for troubleshooting (to manually check the correctness of output),
	 * unlike pywikibot's import file(s), which are for quick creation of pages.
	 */
	writeIntoSeparateFile( ItemName, wikitext ) {
		var validFilename = ItemName.replace( / /g, '_' ).replace( '/', '%2F' );

		var fd = fs.openSync( config.outputDir + '/pages/' + validFilename + '.txt', 'w' );
		fs.writeSync( fd, wikitext );
		fs.closeSync( fd );
	}

	/**
	 * @param {string} wikitext
	 */
	writeIntoCargoDatabase( wikitext ) {
		this.cargoChunkWriter.write( wikitext );
	}

	/**
	 * Add information about this item into Pywikibot's import file (for mass creation of pages).
	 * @see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
	 */
	writeIntoPywikibotImportFile( ItemName, wikitext, ItemCode ) {
		if ( !this.precreateArticlesFd ) {
			var pwbOutputDir = config.outputDir + '/pywikibot';

			this.precreateArticlesFd = fs.openSync( pwbOutputDir + '/precreateArticles.import.txt', 'w' );
			this.cargoDatabaseFd = fs.openSync( pwbOutputDir + '/itemDatabase.import.txt', 'w' );
		}

		if ( ItemName.indexOf( '[' ) !== -1 || ItemName.indexOf( ']' ) !== -1 ) {
			// Can't create pages with titles like "Kiri Fruit [FU]",
			// because "[" and "]" are invalid characters for MediaWiki titles.
			// TODO: just rename such pages to use braces ( and ) instead of [ and ].
			return;
		}

		if ( !this.seenItemNames ) {
			this.seenItemNames = [];
		}

		if ( this.seenItemNames[ItemName] ) {
			// Sometimes there are different items with the same name (e.g. Ancient Artifact),
			// currently they would overwrite the same page N times if we add them to the import file.
			// TODO: solve this in ItemDatabase instead by providing unique "ArticleName",
			// which would be based on DisplayName, but would additionally be made unique.
			util.log( "ResultsWriter: skipped duplicate item: " + ItemName );
			return;
		}

		this.seenItemNames[ItemName] = true;

		// We create two pages. One is [[Template:Automatic item info/NameOfItemHere]], which is meant
		// to be overwritten by bot and not edited by humans.
		// Another is the page [[NameOfItemHere]], which only includes the above-mentioned template
		// and can be skipped by passing "-nocontent:Automatic" to parameter "pwb.py pagefromfile".
		fs.writeSync( this.cargoDatabaseFd,
			"{{-start-}}\n'''Template:Automatic item info/" + ItemName + "'''\n" + wikitext + '\n{{-stop-}}\n' );

		var wrappedWikitext = '';
		wrappedWikitext += "{{-start-}}\n'''" + ItemName + "'''\n";
		wrappedWikitext += '{{Automatic infobox item|' + ItemCode + "}}<!-- Please don't delete this line -->\n";
		wrappedWikitext += "<!-- You can write the text below. -->\n\n\n";
		wrappedWikitext += '{{All recipes for item|id=' + ItemCode + '|name=' + ItemName + '}}';
		wrappedWikitext += "<!-- Please don't delete this line -->\n{{-stop-}}\n";

		fs.writeSync( this.precreateArticlesFd, wrappedWikitext );
	}
}

module.exports = new ResultsWriter();
