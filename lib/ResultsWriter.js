'use strict';

const { config, ChunkWriter, util, WikiStatusCache } = require( '.' ),
	fs = require( 'fs' );

/**
 * Methods used by generate.js to write the generated wikitext into the output file(s).
 */
class ResultsWriter {
	constructor() {
		this.outputDir = config.outputDir + '/pywikibot';
		fs.mkdirSync( this.outputDir, { recursive: true } );

		// Maps the name of Cargo table (e.g. "research_node") to chunk group (e.g. "node").
		this.tableToChunkGroup = {
			'item': 'item',
			'item_metadata': 'item',
			'recipe': 'recipe',
			'research_node': 'node',
			'armorset': 'armorset',
			'codex_text': 'item' // TODO: move into a separate chunk
		};

		this.cargoChunkWriter = new ChunkWriter( {
			filename: this.outputDir + '/cargoDatabase.import.txt',
			headerText: "{{-start-}}\n'''Template:Cargo/$1'''\n<!-- schema version " + this.getSchemaVersion() + " -->\n",
			footerText: '\n{{-stop-}}\n',
			maxChunkSizeBytes: config.cargoMaxChunkSizeKBytes * 1024,
			groups: {
				'item': {
					idxPattern: 'item/$1',
					chunksCount: config.cargoChunksCount['item']
				},
				'recipe': {
					idxPattern: 'recipe/$1',
					chunksCount: config.cargoChunksCount['recipe']
				},
				'node': {
					idxPattern: 'node/$1',
					chunksCount: config.cargoChunksCount['node']
				},
				'armorset': {
					idxPattern: 'armorset/$1',
					chunksCount: config.cargoChunksCount['armorset']
				}
			}
		} );

		// Methods like writeToPrecreateArticlesList() update the buffer, finalize() writes it to files.
		this.buffer = {
			precreatedList: '',
			precreatedListNewOnly: ''
		};
	}

	/**
	 * Write everything about item.
	 * @param {Item} item One item from the ItemDatabase.
	 */
	writeItem( item ) {
		var itemCode = item.itemCode;

		if ( itemCode.endsWith( ':1' ) ) {
			// For multi-stage items like Apothecary ("craftingmedical") we skip pseudo-item of its first stage
			// (e.g. "craftingmedical:1"), because stage 1 is the same as the main item.
			// However, we don't skip "craftingmedical:2, etc. (upgrades of Apothecary).
			return;
		}

		// Cargo database of all known items.
		this.writeToCargo( item );

		// Pywikibot's import file (to mass-create articles about all items).
		// See https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
		// These pages merely include {{All recipes for item}} and {{Automatic infobox item}}.
		// Any detailed information should be in the Cargo database (these templates can use it).
		this.addPrecreatedItemArticle( itemCode, item.wikiPageName );

		// Additionally create categories like "Category:ColonyTag:swamp".
		( item.itemTags || [] ).forEach( ( tag ) => {
			this.addPrecreatedCategory( 'ItemTag:' + tag, '[[Category:Items by item tag|' + tag + ']]' );
		} );
		( item.colonyTags || [] ).forEach( ( tag ) => {
			this.addPrecreatedCategory( 'ColonyTag:' + tag, '[[Category:Items by colony tag|' + tag + ']]' );
		} );
	}

	/**
	 * Write everything about recipe.
	 * @param {Recipe} item One recipe from the RecipeDatabase.
	 */
	writeRecipe( Recipe ) {
		this.writeToCargo( Recipe );
	}

	/**
	 * Write everything about research node.
	 * @param {ResearchNode} node One node from the ResearchTreeDatabase.
	 */
	writeResearchNode( node ) {
		this.writeToCargo( node );
	}

	/**
	 * Write everything about armor set.
	 * @param {ArmorSet} node One set from the ArmorSetDatabase.
	 */
	writeArmorSet( armorSet ) {
		this.writeToCargo( armorSet );
	}

	/**
	 * Get arbitrary string to add to Cargo pages.
	 * @return string
	 */
	getSchemaVersion() {
		// This file contains an arbitrary number. Incrementing this number will cause all Chunk pages
		// to become modified, which is useful when populating "replacement table" of Extension:Cargo.
		// (if some pages were unchanged, then "pwb.py pagefromfile" of Pywikibot would skip them)
		var versionPath = __dirname + '/../schemaversion.txt';
		if ( !fs.existsSync( versionPath ) ) {
			// Default
			return '1';
		}

		return fs.readFileSync( versionPath ).toString().trim();
	}

	/**
	 * Add footers to opened files, if any.
	 */
	finalize() {
		this.cargoChunkWriter.finalize();

		fs.writeFileSync( this.outputDir + '/precreateArticles.import.txt', this.buffer.precreatedList );
		fs.writeFileSync( this.outputDir + '/precreateArticles.onlyNew.import.txt', this.buffer.precreatedListNewOnly );
	}

	/**
	 * Add wikitext to chunked pages for {{#cargo_store:}} directives.
	 * @param {object} entity Arbitrary object with toCargoDatabase() and getPartitionKey() methods,
	 * where toCargoDatabase() returns {CargoRow|CargoRow[]} (all Cargo entries that must be written),
	 * and getPartitionKey() returns arbitrary {string}.
	 */
	writeToCargo( entity ) {
		var partitionKey = entity.getPartitionKey();
		var rows = entity.toCargoDatabase();

		if ( !Array.isArray( rows ) ) {
			rows = [ rows ];
		}

		for ( var cargoRow of rows ) {
			var chunkGroup = this.tableToChunkGroup[cargoRow.table];
			this.cargoChunkWriter.write( chunkGroup, partitionKey, cargoRow.toWikitext() );
		}
	}

	/**
	 * Add this item to Pywikibot's import file (can be used to mass-create articles about all items).
	 * @param {string} itemCode Internal ID of the item, e.g. "waxsword".
	 * @param {string} wikiPageName Title of MediaWiki article about item, e.g. "Wax Sword".
	 */
	addPrecreatedItemArticle( itemCode, wikiPageName ) {
		if ( [ 'Research', 'Pixels' ].includes( wikiPageName ) ) {
			// Don't record anything for Research or Pixels,
			// these are extremely huge pages that are not very useful.
			return;
		}

		if ( wikiPageName.match( /[[\]]/ ) ) {
			// Can't create pages with titles like "Kiri Fruit [FU]",
			// because "[" and "]" are invalid characters for MediaWiki titles.
			// TODO: just rename such pages to use braces ( and ) instead of [ and ].
			return;
		}

		if ( itemCode === 'crewshop:2' ) {
			// Unobtainable.
			return;
		}

		if ( !this.seenItemNames ) {
			this.seenItemNames = new Set();
		}

		if ( this.seenItemNames.has( wikiPageName ) ) {
			// Sometimes there are different items with the same name (e.g. Ancient Artifact),
			// currently they would overwrite the same page N times if we add them to the import file.
			// TODO: solve this in ItemDatabase instead by providing unique "ArticleName",
			// which would be based on DisplayName, but would additionally be made unique.
			util.log( "ResultsWriter: skipped duplicate item: " + wikiPageName );
			return;
		}

		this.seenItemNames.add( wikiPageName );

		var wikitext = '';
		wikitext += "{{-start-}}\n'''" + wikiPageName + "'''\n";
		wikitext += '{{Automatic infobox item|' + itemCode + "}}<!-- Please don't delete this line -->\n";
		wikitext += "<!-- You can write the text below. -->\n\n\n";
		wikitext += '{{All recipes for item|id=' + itemCode + '|name=' + wikiPageName + '}}';
		wikitext += "<!-- Please don't delete this line -->\n{{-stop-}}\n";

		this.buffer.precreatedList += wikitext;
		if ( !WikiStatusCache.pageExists( wikiPageName ) ) {
			this.buffer.precreatedListNewOnly += wikitext;
		}
	}

	/**
	 * Add this item to Pywikibot's import file (can be used to mass-create articles about all items).
	 * @param {string} categoryName Name of category, e.g. "ColonyTag:commerce".
	 * @param {string} wikitext Contents of the category page.
	 */
	addPrecreatedCategory( categoryName, wikitext ) {
		// Create each category only once.
		if ( !this.seenCategories ) {
			this.seenCategories = new Set();
		} else if ( this.seenCategories.has( categoryName ) ) {
			// Already created.
			return;
		}

		this.seenCategories.add( categoryName );

		var title = 'Category:' + categoryName;
		wikitext = "{{-start-}}\n'''" + title + "'''\n" + wikitext + "\n{{-stop-}}\n";

		this.buffer.precreatedList += wikitext;
		if ( !WikiStatusCache.pageExists( title ) ) {
			this.buffer.precreatedListNewOnly += wikitext;
		}
	}
}

module.exports = new ResultsWriter();
