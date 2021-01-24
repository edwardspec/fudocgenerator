'use strict';

const { AssetDatabase, PageNameRegistry, RecipeSide, TreasurePool, util } = require( '.' );

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
				PageNameRegistry.add( pool );
			}
		} );

		util.log( '[info] Loaded treasure pools (' + this.knownPools.size + ').' );
		this.loaded = true;
	}


	/**
	 * Find the TreasurePool by its name.
	 *
	 * @param {string} poolName
	 * @return {TreasurePool|null}
	 */
	find( poolName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownPools.get( poolName );
	}

	/**
	 * Get the array of items that can drop from the pool.
	 *
	 * @param {string} poolName
	 * @return {RecipeSide}
	 */
	getPossibleOutputs( poolName ) {
		var pool = this.find( poolName );
		return pool ? pool.getPossibleOutputs() : RecipeSide.newEmpty();
	}

	/**
	 * Callback expected by TreasurePoolDatabase.forEach().
	 *
	 * @callback poolCallback
	 * @param {TreasurePool} pool
	 */

	/**
	 * Iterate over all treasure pools. Run the callback for each of them.
	 * Callback receives 1 parameter (TreasurePool object).
	 *
	 * @param {poolCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var pool of this.knownPools.values() ) {
			callback( pool );
		}
	}
}

module.exports = new TreasurePoolDatabase();
