'use strict';

const { AssetDatabase, util } = require( '.' );

/**
 * Discovers all known biomes.
 */
class BiomeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known biomes,
		// e.g. { "arcticoceanfloor": { ... }, ... }
		this.knownBiomes = {};
	}

	/**
	 * Scan the AssetDatabase and find all biomes.
	 */
	load() {
		AssetDatabase.forEach( 'biome', ( filename, asset ) => {
			var biome = asset.data;
			this.knownBiomes[biome.name] = biome;
		} );

		util.log( '[info] BiomeDatabase: found ' + Object.keys( this.knownBiomes ).length + ' biomes.' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each biome.
	 * Callback gets the following parameters: 1) biome code, 2) loaded data.
	 *
	 * @param {biomeCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ biomeCode, loadedData ] of Object.entries( this.knownBiomes ) ) {
			callback( biomeCode, loadedData );
		}
	}

	/**
	 * Callback expected by BiomeDatabase.forEach().
	 *
	 * @callback biomeCallback
	 * @param {string} biomeCode
	 * @param {Object} biome
	 */

	/**
	 * Find the biome called "biomeCode" in the database.
	 *
	 * @param {string} biomeCode E.g. "nitrogensea".
	 * @return {Object|undefined} Arbitrary information about this biome.
	 */
	find( biomeCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownBiomes[biomeCode];
	}
}

module.exports = new BiomeDatabase();
