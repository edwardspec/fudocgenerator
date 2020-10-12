'use strict';

var config = require( '../config.json' ),
	ChunkWriter = require( './ChunkWriter' ),
	util = require( './util' ),
	fs = require( 'fs' ),
	shellQuote = require( 'shell-quote' ).quote;

/**
 * Methods used by generate.js to write the generated wikitext into the output file(s).
 */
class ResultsWriter {
	constructor( station, inputs, outputs ) {
		fs.mkdirSync( config.outputDir, { recursive: true } );
		fs.mkdirSync( config.outputDir + '/pywikibot', { recursive: true } );

		this.cargoChunkWriter = new ChunkWriter();
	}

	/**
	 * Write everything about item.
	 * @param {object} item One item from the ItemDatabase.
	 */
	writeItem( item ) {
		var itemCode = item.itemCode;

		// Cargo database of all known items.
		this.writeIntoCargoDatabase( 'item-' + itemCode, util.itemToCargoDatabase( item ) );

		// Legacy pages: [[Template:Automatic item info/NameOfItemHere]].
		var wikitext = '{{All recipes for item|id=' + itemCode + '|name=' + item.displayName + '}}\n';
		this.write( item.wikiPageName, wikitext, itemCode );

		// Add discovered icon of this item (small PNG image) into "upload these icons" list.
		var iconPath = item.inventoryIconPath;
		if ( iconPath ) {
			this.writeToUploadThisList( itemCode, iconPath );
		}
	}

	/**
	 * Write everything about recipe.
	 * @param {Recipe} item One recipe from the RecipeDatabase.
	 */
	writeRecipe( Recipe ) {
		// We split the recipes into chunks by the ID of the first item in "outputs",
		// because "inputs" might have only pseudo-items, such as "Air (on Desert planets)".
		var chunkPartitionKey = 'recipe-' + Object.keys( Recipe.outputs )[0];
		this.writeIntoCargoDatabase( chunkPartitionKey, Recipe.toCargoDatabase() );
	}

	/**
	 * Write everything about research node.
	 * @param {object} node One node from the ResearchTreeDatabase.
	 */
	writeResearchNode( node ) {
		this.writeIntoCargoDatabase( 'node-' + node.id, util.researchNodeToCargoDatabase( node ) );
	}

	/**
	 * Add footers to opened files, if any.
	 */
	finalize() {
		this.cargoChunkWriter.finalize(
			config.outputDir + '/pywikibot/cargoDatabase.import.txt',
			"{{-start-}}\n'''Template:Cargo/$1'''\n",
			'\n{{-stop-}}\n',
			config.cargoChunkSizeKBytes * 1024,
			config.cargoMaxChunkSizeKBytes * 1024
		);

		fs.closeSync( this.precreateArticlesFd );
		fs.closeSync( this.legacySubpagesFd );
		fs.closeSync( this.uploadListFd );
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

		this.writeIntoPywikibotImportFile( ItemName, wikitext, ItemCode );
	}

	/**
	 * Add wikitext to chunked pages for {{#cargo_store:}} directives.
	 * @param {string} partitionKey Arbitrary string that determines which Chunk page will be used.
	 * @param {string} wikitext
	 */
	writeIntoCargoDatabase( partitionKey, wikitext ) {
		this.cargoChunkWriter.write( partitionKey, wikitext );
	}

	/**
	 * Add image to "upload these images" script.
	 * @param {string} ItemCode
	 * @param {string} path
	 */
	 writeToUploadThisList( ItemCode, path ) {
		if ( !this.uploadListFd ) {
			this.uploadListFd = fs.openSync( config.outputDir + '/pywikibot/uploadInventoryIcons.sh', 'w' );
			fs.writeSync( this.uploadListFd, '#!bash\n' );
		}

		var pathWithoutTopDir = path.replace( config.pathToMod, '' ).replace( config.pathToVanilla, '' )
			.replace( /^\//, '' );

		var description = '{{Inventory icon description|' + ItemCode + '|' + pathWithoutTopDir + '}}',
			targetFilename = 'Item_icon_' + ItemCode + '.png',
			escapedBashParams = shellQuote( [
				'-filename:' + targetFilename,
				path,
				description
			] );

		fs.writeSync( this.uploadListFd, config.pywikibotCommand +
			' upload -always -ignorewarn -abortonwarn:exists ' +
			escapedBashParams + '\n'
		);
	}

	/**
	 * Add information about this item into Pywikibot's import file (for mass creation of pages).
	 * @see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
	 */
	writeIntoPywikibotImportFile( ItemName, wikitext, ItemCode ) {
		if ( !this.precreateArticlesFd ) {
			var pwbOutputDir = config.outputDir + '/pywikibot';

			this.precreateArticlesFd = fs.openSync( pwbOutputDir + '/precreateArticles.import.txt', 'w' );
			this.legacySubpagesFd = fs.openSync( pwbOutputDir + '/itemDatabase.import.txt', 'w' );
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
		fs.writeSync( this.legacySubpagesFd,
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
