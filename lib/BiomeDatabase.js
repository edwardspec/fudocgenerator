/**
 * Discovers all known biomes.
 */

const AssetDatabase = require( './AssetDatabase' ),
	util = require( './util' ),
	config = require( '../config' );

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
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.type !== 'biome' ) {
				return;
			}

			var biome = asset.data;
			this.knownBiomes[biome.name] = biome;
		} );

		util.log( '[info] BiomeDatabase: found ' + Object.keys( this.knownBiomes ).length + ' monsters.' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each biome.
	 * Callback gets the following parameters: 1) biome code, 2) loaded data.
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
	 * Find the biome called "biomeCode" in the database.
	 * @return {object|null} Arbitrary information about this biome.
	 */
	find( biomeCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownBiomes[biomeCode];
	}
}

module.exports = new BiomeDatabase();
