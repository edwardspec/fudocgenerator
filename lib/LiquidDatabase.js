/**
 * Discovers all known liquids.
 */

'use strict';

const { AssetDatabase, util } = require( '.' );

class LiquidDatabase {
	constructor() {
		this.loaded = false;

		// Array of known liquids,
		// e.g. { 59: { "liquidId": 59, name: "", ... }, ... }
		this.knownLiquids = {};
	}

	/**
	 * Scan the AssetDatabase and find all liquids.
	 */
	load() {
		AssetDatabase.forEach( 'liquid', ( filename, asset ) => {
			var liquid = asset.data;
			this.knownLiquids[liquid.liquidId] = liquid;
		} );

		util.log( '[info] LiquidDatabase: found ' + Object.keys( this.knownLiquids ).length + ' liquids.' );

		this.loaded = true;
	}

	/**
	 * Find the liquid by its ID.
	 *
	 * @param {int} liquidId
	 * @return {Object | null} Arbitrary information about this liquid.
	 */
	find( liquidId ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownLiquids[liquidId];
	}
}

module.exports = new LiquidDatabase();
