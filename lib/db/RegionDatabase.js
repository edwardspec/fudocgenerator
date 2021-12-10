/**
 * Discovers all known planetary regions (e.g. "tidewaterfloor", "nitrogencore", "clouds", etc.).
 */

'use strict';

const { AssetDatabase, Region, util } = require( '..' );

class RegionDatabase {
	constructor() {
		this.loaded = false;

		// Array of known "regions", as defined in [terrestrial_worlds.config].
		// Each region is biome + some additional options not from biome (e.g. cave liquid, ocean liquid).
		// Format: { "bogoceanfloor": Region1, "crystalmoon": Region2, ... }
		this.knownRegions = new Map();
	}

	/**
	 * Scan terrestrial_worlds.config and find all regions.
	 */
	load() {
		var planetsConf = AssetDatabase.getData( '/terrestrial_worlds.config' );

		for ( var [ regionCode, regionInfo ] of Object.entries( planetsConf.regionTypes ) ) {
			this.knownRegions.set( regionCode, new Region( regionCode, regionInfo ) );
		}

		util.log( '[info] RegionDatabase: found ' + this.knownRegions.size + ' regions.' );
		this.loaded = true;
	}

	/**
	 * Find the planetary region by its ID (e.g. "strangeseafloor").
	 *
	 * @param {string} regionCode
	 * @return {Region|null}
	 */
	find( regionCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownRegions.get( regionCode );
	}

	/**
	 * Callback expected by RegionDatabase.forEach().
	 *
	 * @callback regionCallback
	 * @param {Region} region
	 */

	/**
	 * Iterate over all region types. Run the callback for each of them.
	 * Callback receives 1 parameter (Region object).
	 *
	 * @param {regionCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}


		for ( var region of this.knownRegions.values() ) {
			callback( region );
		}
	}
}

module.exports = new RegionDatabase();
