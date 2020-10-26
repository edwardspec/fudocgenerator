'use strict';

var config = require( '../config.json' ),
	{ ChunkWriter, util } = require( '.' ),
	fs = require( 'fs' ),
	shellQuote = require( 'shell-quote' ).quote;

/**
 * Methods used by generate.js to write the generated wikitext into the output file(s).
 */
class ResultsWriter {
	constructor() {
		this.outputDir = config.outputDir + '/pywikibot';
		fs.mkdirSync( this.outputDir, { recursive: true } );

		this.cargoChunkWriter = new ChunkWriter();
	}

	/**
	 * Write everything about item.
	 * @param {Item} item One item from the ItemDatabase.
	 */
	writeItem( item ) {
		var itemCode = item.itemCode;

		// Cargo database of all known items.
		this.writeIntoCargoDatabase( 'item-' + itemCode, item.toCargoDatabase() );

		// Pywikibot's import file (to mass-create articles about all items).
		// See https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
		// These pages merely include {{All recipes for item}} and {{Automatic infobox item}}.
		// Any detailed information should be in the Cargo database (these templates can use it).
		this.writeToPrecreateArticlesList( itemCode, item.wikiPageName );

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
	 * @param {ResearchNode} node One node from the ResearchTreeDatabase.
	 */
	writeResearchNode( node ) {
		this.writeIntoCargoDatabase( 'node-' + node.id, node.toCargoDatabase() );
	}

	/**
	 * Add footers to opened files, if any.
	 */
	finalize() {
		this.cargoChunkWriter.finalize(
			this.outputDir + '/cargoDatabase.import.txt',
			"{{-start-}}\n'''Template:Cargo/$1'''\n<!-- schema version " + config.cargoSchemaVersion + " -->\n",
			'\n{{-stop-}}\n',
			config.cargoChunksCount,
			config.cargoMaxChunkSizeKBytes * 1024
		);

		fs.closeSync( this.precreateArticlesFd );
		fs.closeSync( this.uploadListFd );
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
			this.uploadListFd = fs.openSync( this.outputDir + '/uploadInventoryIcons.sh', 'w' );
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
	 * Add this item to Pywikibot's import file (can be used to mass-create articles about all items).
	 * @param {string} ItemCode Internal ID of the item, e.g. "waxsword".
	 * @param {string} ItemName Human-readable name of item, e.g. "Wax Sword".
	 */
	writeToPrecreateArticlesList( ItemCode, ItemName ) {
		if ( [ 'Research', 'Pixels' ].indexOf( ItemName ) !== -1 ) {
			// Don't record anything for Research or Pixels,
			// these are extremely huge pages that are not very useful.
			return;
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

		var wikitext = '';
		wikitext += "{{-start-}}\n'''" + ItemName + "'''\n";
		wikitext += '{{Automatic infobox item|' + ItemCode + "}}<!-- Please don't delete this line -->\n";
		wikitext += "<!-- You can write the text below. -->\n\n\n";
		wikitext += '{{All recipes for item|id=' + ItemCode + '|name=' + ItemName + '}}';
		wikitext += "<!-- Please don't delete this line -->\n{{-stop-}}\n";

		if ( !this.precreateArticlesFd ) {
			this.precreateArticlesFd = fs.openSync( this.outputDir + '/precreateArticles.import.txt', 'w' );
		}
		fs.writeSync( this.precreateArticlesFd, wikitext );
	}
}

module.exports = new ResultsWriter();
