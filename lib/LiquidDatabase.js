'use strict';

const { AssetDatabase, util } = require( '.' );

/**
 * Discovers all known liquids.
 */
class LiquidDatabase {
	constructor() {
		this.loaded = false;

		// Array of known liquids,
		// e.g. { 59: { "liquidId": 59, name: "", ... }, ... }
		this.knownLiquids = new Map();

		// Array of known liquids by their name,
		// e.g. { "fuquicksand": { ... }, ... }
		this.knownLiquidsByName = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all liquids.
	 */
	load() {
		AssetDatabase.forEach( 'liquid', ( filename, asset ) => {
			var liquid = asset.data;

			this.knownLiquids.set( liquid.liquidId, liquid );
			this.knownLiquidsByName.set( liquid.name, liquid );
		} );

		util.log( '[info] LiquidDatabase: found ' + this.knownLiquids.size + ' liquids.' );
		this.loaded = true;
	}

	/**
	 * Find the liquid by its ID.
	 *
	 * @param {int} liquidId
	 * @return {Object|null} Arbitrary information about this liquid.
	 */
	find( liquidId ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownLiquids.get( liquidId );
	}

	/**
	 * Find the liquid by its name.
	 *
	 * @param {string} liquidName
	 * @return {Object|null} Arbitrary information about this liquid.
	 */
	findByName( liquidName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownLiquidsByName.get( liquidName );
	}
}

module.exports = new LiquidDatabase();
