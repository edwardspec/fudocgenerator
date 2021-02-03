'use strict';

const { config, ChunkWriter, PageNameRegistry, WikiStatusCache } = require( '.' ),
	crypto = require( 'crypto' ),
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
			/* eslint-disable camelcase */
			item: 'item',
			item_metadata: 'item',
			recipe: 'recipe',
			research_node: 'node',
			armorset: 'armorset',
			codex_text: 'codex',
			monster: 'monster',
			planet: 'planet',
			layer: 'planet',
			region: 'planet',
			biome: 'planet',
			weatherpool: 'weather',
			statuseffect: 'status'
			/* eslint-enable camelcase */
		};

		this.cargoChunkWriter = new ChunkWriter( {
			groups: {
				item: {
					idxPattern: 'item/$1',
					chunksCount: config.cargoChunksCount.item
				},
				recipe: {
					idxPattern: 'recipe/$1',
					chunksCount: config.cargoChunksCount.recipe
				},
				node: {
					idxPattern: 'node/$1',
					chunksCount: config.cargoChunksCount.node
				},
				armorset: {
					idxPattern: 'armorset/$1',
					chunksCount: config.cargoChunksCount.armorset
				},
				codex: {
					idxPattern: 'codex/$1',
					chunksCount: config.cargoChunksCount.codex
				},
				monster: {
					idxPattern: 'monster/$1',
					chunksCount: config.cargoChunksCount.monster
				},
				planet: {
					idxPattern: 'planet/$1',
					chunksCount: config.cargoChunksCount.planet
				},
				weather: {
					idxPattern: 'weather/$1',
					chunksCount: config.cargoChunksCount.weather
				},
				status: {
					idxPattern: 'status/$1',
					chunksCount: config.cargoChunksCount.status
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
	 *
	 * @param {Item} item One item from the ItemDatabase.
	 */
	writeItem( item ) {
		// Cargo database of all known items.
		this.writeToCargo( item );

		// Pywikibot's import file (to mass-create articles about all items).
		// See https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py
		// These pages merely include {{All recipes for item}} and {{Automatic infobox item}}.
		// Any detailed information should be in the Cargo database (these templates can use it).
		if ( !config.itemsThatDoNotNeedAnArticle.includes( item.itemCode ) ) {
			this.writeToArticle( item );
		}

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
	 *
	 * @param {Recipe} recipe One recipe from the RecipeDatabase.
	 */
	writeRecipe( recipe ) {
		this.writeToCargo( recipe );
	}

	/**
	 * Write everything about research node.
	 *
	 * @param {ResearchNode} node One node from the ResearchTreeDatabase.
	 */
	writeResearchNode( node ) {
		this.writeToCargo( node );
	}

	/**
	 * Write everything about armor set.
	 *
	 * @param {ArmorSet} armorSet One set from the ArmorSetDatabase.
	 */
	writeArmorSet( armorSet ) {
		this.writeToCargo( armorSet );
	}

	/**
	 * Write everything about monster.
	 *
	 * @param {Monster} monster One monster from the MonsterDatabase.
	 */
	writeMonster( monster ) {
		this.writeToCargo( monster );
		this.writeToArticle( monster );
	}

	/**
	 * Write everything about TreasurePool.
	 *
	 * @param {TreasurePool} pool One pool from the TreasurePoolDatabase.
	 */
	writeTreasurePool( pool ) {
		this.writeToArticle( pool );
	}

	/**
	 * Write everything about planet and its layers.
	 *
	 * @param {Planet} planet One planet from the PlanetDatabase.
	 */
	writePlanet( planet ) {
		this.writeToCargo( planet );
	}

	/**
	 * Write everything about planetary region.
	 *
	 * @param {Region} region One region from the RegionDatabase.
	 */
	writeRegion( region ) {
		this.writeToCargo( region );
	}

	/*
	 * Write everything about biome.
	 *
	 * @param {Biome} biome One biome from the BiomeDatabase.
	 */
	writeBiome( biome ) {
		this.writeToCargo( biome );
		this.writeToArticle( biome );
	}

	/**
	 * Write everything about weather pool.
	 *
	 * @param {WeatherPool} pool One pool from the WeatherPoolDatabase.
	 */
	writeWeatherPool( pool ) {
		this.writeToCargo( pool );
	}

	/**
	 * Write everything about status effect.
	 *
	 * @param {StatusEffect} effect One effect from the StatusEffectDatabase.
	 */
	writeStatusEffect( effect ) {
		this.writeToCargo( effect );
	}

	/**
	 * Write everything about sapling part.
	 *
	 * @param {SaplingPart} part One stem/foliage from the SaplingDatabase.
	 */
	writeSaplingPart( part ) {
		this.writeToArticle( part );
	}

	/**
	 * Get arbitrary string to add to Cargo pages.
	 *
	 * @return {string}
	 */
	getSchemaVersion() {
		if ( !this.schemaVersion ) {
			// This file contains an arbitrary number. Incrementing this number will cause all Chunk pages
			// to become modified, which is useful when populating "replacement table" of Extension:Cargo.
			// (if some pages were unchanged, then "pwb.py pagefromfile" of Pywikibot would skip them)
			var versionPath = __dirname + '/../schemaversion.txt';
			this.schemaVersion = fs.existsSync( versionPath ) ?
				fs.readFileSync( versionPath ).toString().trim() : '1';
		}

		return this.schemaVersion;
	}

	/**
	 * Add footers to opened files, if any.
	 */
	finalize() {
		this.cargoDatabaseFd = fs.openSync( this.outputDir + '/cargoDatabase.import.txt', 'w' );
		this.cargoDatabaseOnlyNewFd = fs.openSync( this.outputDir + '/cargoDatabase.onlyNew.import.txt', 'w' );

		this.cargoChunkWriter.finalize( this.chunkOutputCallback.bind( this ) );

		fs.closeSync( this.cargoDatabaseOnlyNewFd );
		fs.closeSync( this.cargoDatabaseFd );

		fs.writeFileSync( this.outputDir + '/precreateArticles.import.txt', this.buffer.precreatedList );
		fs.writeFileSync( this.outputDir + '/precreateArticles.onlyNew.import.txt', this.buffer.precreatedListNewOnly );
	}

	/**
	 * Write one chunk into cargoDatabase.import.txt.
	 * This is called by ChunkWriter.finalize() for every chunk.
	 *
	 * @param {string} chunkName
	 * @param {string} contents
	 */
	chunkOutputCallback( chunkName, contents ) {
		var pageName = 'Template:Cargo/' + chunkName;
		contents = '<!-- schema version ' + this.getSchemaVersion() + ' -->\n' + contents;

		var checksum = crypto.createHash( 'sha1' ).update( contents.trimEnd(), 'utf8' ).digest( 'hex' );
		var wrappedContents = "{{-start-}}\n'''" + pageName + "'''\n" + contents + '\n{{-stop-}}\n';

		fs.writeSync( this.cargoDatabaseFd, wrappedContents );
		if ( !WikiStatusCache.pageHasChecksum( pageName, checksum ) ) {
			fs.writeSync( this.cargoDatabaseOnlyNewFd, wrappedContents );
		}
	}

	/**
	 * Add wikitext to chunked pages for {{#cargo_store:}} directives.
	 *
	 * @param {Object} entity Arbitrary object with toCargoDatabase() and getPartitionKey() methods,
	 * where toCargoDatabase() returns {CargoRow|CargoRow[]} (all Cargo entries that must be written),
	 * and getPartitionKey() returns arbitrary {string}.
	 */
	writeToCargo( entity ) {
		var partitionKey = entity.getPartitionKey();
		var rows = entity.toCargoDatabase();

		if ( !Array.isArray( rows ) ) {
			rows = [ rows ];
		}

		for ( var i = 0; i < rows.length; i++ ) {
			var cargoRow = rows[i];
			this.cargoChunkWriter.write(
				this.tableToChunkGroup[cargoRow.table],
				partitionKey + '-' + i,
				cargoRow.toWikitext()
			);
		}
	}

	/**
	 * Add article about an object that supports it.
	 * It only works on objects that were passed to PageNameRegistry.add() earlier.
	 *
	 * @param {Object} entity Arbitrary object with toArticleText() method.
	 */
	writeToArticle( entity ) {
		var wikiPageName = PageNameRegistry.getTitleFor( entity );
		if ( !wikiPageName ) {
			// This object didn't get a PageName.
			return;
		}

		var wikitext = entity.toArticleText( wikiPageName );
		this.writeWikitextToPage( wikiPageName, wikitext );
	}

	/**
	 * Write arbitrary wikitext to Pywikibot's "automatically create articles" import file.
	 *
	 * @param {string} wikiPageName Name of the target page.
	 * @param {string} wikitext Contents of the target page.
	 */
	writeWikitextToPage( wikiPageName, wikitext ) {
		wikitext = "{{-start-}}\n'''" + wikiPageName + "'''\n" + wikitext + '\n{{-stop-}}\n';

		this.buffer.precreatedList += wikitext;
		if ( !WikiStatusCache.pageExists( wikiPageName ) ) {
			this.buffer.precreatedListNewOnly += wikitext;
		}
	}

	/**
	 * Add this item to Pywikibot's import file (can be used to mass-create articles about all items).
	 *
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
		this.writeWikitextToPage( 'Category:' + categoryName, wikitext );
	}
}

module.exports = new ResultsWriter();
