'use strict';

const { AssetDatabase, RecipeSide, TreasurePool, util } = require( '.' );

/**
 * Discovers all treasure pools (information on which monsters/plants can drop which items).
 */
class TreasurePoolDatabase {
	constructor() {
		this.loaded = false;

		// Array of known treasure pools,
		// e.g. { poolName1: RecipeSide1, ... }
		this.knownPools = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all treasure pools.
	 */
	load() {
		AssetDatabase.forEach( 'treasurepools', ( filename, asset ) => {
			for ( var [ poolName, poolDataSets ] of Object.entries( asset.data ) ) {
				var pool = new TreasurePool( poolName, poolDataSets[0][1] );
				this.knownPools.set( poolName, pool );
			}
		} );

		util.log( '[info] Loaded treasure pools (' + this.knownPools.size + ').' );
		this.loaded = true;
	}


	/**
	 * Get the array of items that can drop from the pool.
	 *
	 * @param {string} poolName
	 * @return {RecipeSide}
	 */
	getPossibleOutputs( poolName ) {
		if ( !this.loaded ) {
			this.load();
		}

		var pool = this.knownPools.get( poolName );
		return pool ? pool.getPossibleOutputs() : RecipeSide.newEmpty();
	}
}

module.exports = new TreasurePoolDatabase();
