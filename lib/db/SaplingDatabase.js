'use strict';

const { AssetDatabase, PageNameRegistry, SaplingPart, util } = require( '..' );

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
			var part = new SaplingPart( asset.data, false, this.stemNames[asset.data.name] );
			this.knownStems.set( part.name, part );

			PageNameRegistry.add( part );
		} );
		AssetDatabase.forEach( 'foliage', ( filename, asset ) => {
			var part = new SaplingPart( asset.data, true, this.foliageNames[asset.data.name] );
			this.knownFoliages.set( part.name, part );

			PageNameRegistry.add( part );
		} );

		util.log( '[info] SaplingDatabase: found ' + this.knownStems.size + ' stems and ' + this.knownFoliages.size + ' foliages.' );
		this.loaded = true;
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

	/**
	 * Callback expected by SaplingDatabase.forEach().
	 *
	 * @callback saplingPartCallback
	 * @param {SaplingPart} part
	 */

	/**
	 * Iterate over all sapling parts. Run the callback for each of them.
	 * Callback receives 1 parameter (SaplingPart object).
	 *
	 * @param {SaplingPart} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( const saplingPart of this.knownStems.values() ) {
			callback( saplingPart );
		}

		for ( const saplingPart of this.knownFoliages.values() ) {
			callback( saplingPart );
		}
	}
}

module.exports = new SaplingDatabase();
