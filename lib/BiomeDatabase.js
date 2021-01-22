'use strict';

const { AssetDatabase, Biome, PageNameRegistry, util } = require( '.' );

/**
 * Discovers all known biomes.
 */
class BiomeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known biomes: { "orchardapple": Biome1, ... }
		this.knownBiomes = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all biomes.
	 */
	load() {
		AssetDatabase.forEach( 'biome', ( filename, asset ) => {
			var biome = new Biome( asset.data );
			this.knownBiomes.set( biome.biomeCode, biome );

			PageNameRegistry.add( biome );
		} );

		util.log( '[info] BiomeDatabase: found ' + this.knownBiomes.size + ' biomes.' );

		this.loaded = true;
	}

	/**
	 * Find the biome called "biomeCode" in the database.
	 *
	 * @param {string} biomeCode E.g. "nitrogensea".
	 * @return {Biome|null} Arbitrary information about this biome.
	 */
	find( biomeCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownBiomes.get( biomeCode );
	}

	/**
	 * Callback expected by BiomeDatabase.forEach().
	 *
	 * @callback biomeCallback
	 * @param {Region} region
	 */

	/**
	 * Iterate over all biome types. Run the callback for each of them.
	 * Callback receives 1 parameter (Biome object).
	 *
	 * @param {biomeCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var biome of this.knownBiomes.values() ) {
			callback( biome );
		}
	}
}

module.exports = new BiomeDatabase();
