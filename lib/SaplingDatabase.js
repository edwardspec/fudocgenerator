'use strict';

const { AssetDatabase, RecipeSide, util } = require( '.' );

/**
 * Discovers all known tree stems (*.modularstem) and tree foliages (*.modularfoliage).
 * A tree sapling is a combination of any 1 stem and any 1 foliage.
 */
class SaplingDatabase {
	constructor() {
		this.loaded = false;

		// Array of known stems, e.g. { "stemName1": { drops: RecipeSide1 }, ... }
		this.knownStems = new Map();

		// Array of known foliages, e.g. { "foliageName1": { drops: RecipeSide1 }, ... }
		this.knownFoliages = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all stems/foliages.
	 */
	load() {
		// Load human-readable names of saplings.
		var saplingConf = AssetDatabase.getData( 'items/buildscripts/buildsaplingfu.config' );

		this.stemNames = saplingConf.stem;
		this.foliageNames = saplingConf.foliage;

		// Load all stems/foliages.
		AssetDatabase.forEach( 'stem', ( filename, asset ) => {
			this.addTreePart( asset, false );
		} );
		AssetDatabase.forEach( 'foliage', ( filename, asset ) => {
			this.addTreePart( asset, true );
		} );

		util.log( '[info] SaplingDatabase: found ' + this.knownStems.size + ' stems and ' + this.knownFoliages.size + ' foliages.' );
		this.loaded = true;
	}

	/**
	 * Add stem or foliage from LoadedAsset into this SaplingDatabase.
	 *
	 * @param {LoadedAsset} asset
	 * @param {boolean} isFoliage True for foliage, false for stem.
	 */
	addTreePart( asset, isFoliage ) {
		var map = isFoliage ? this.knownFoliages : this.knownStems;

		var data = asset.data;
		var outputs = RecipeSide.newFromCraftingInput(
			data.dropConfig ? data.dropConfig.drops[0] : []
		);

		if ( outputs.isEmpty() ) {
			outputs.addComment( "''(drops nothing)''" );
		}

		// TODO: refactor: this needs to be a class.
		var treePart = {
			name: data.name,
			displayName: isFoliage ? this.foliageNames[data.name] : this.stemNames[data.name],
			wikiPageName: 'Template:Modular tree part/' + ( isFoliage ? 'Foliage' : 'Stem' ) + '/' + data.name,
			drops: outputs
		};
		map.set( treePart.name, treePart );
	}

	/**
	 * Find the stem by its name.
	 *
	 * @param {string} name
	 * @return {Object|null}
	 */
	findStem( name ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownStems.get( name );
	}

	/**
	 * Find the foliage by its name.
	 *
	 * @param {string} name
	 * @return {Object|null}
	 */
	findFoliage( name ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownFoliages.get( name );
	}

	/**
	 * Find human-readable name of the tree from of its foliage and its stem.
	 *
	 * @param {string} foliageCode Machine-readable code of the foliage, e.g. "snowleafy".
	 * @param {string} stemCode Machine-readable code of the stem, e.g. "coconutwood".
	 * @return {string}
	 */
	getSaplingName( foliageCode, stemCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		var saplingName = this.stemNames[stemCode] || 'Unknown';
		var foliageName = this.foliageNames[foliageCode];
		if ( foliageName ) {
			saplingName += ' ' + foliageName;
		}

		return saplingName + ' Sapling';
	}
}

module.exports = new SaplingDatabase();
