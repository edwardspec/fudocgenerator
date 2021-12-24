'use strict';

const { AssetDatabase, PageNameRegistry, RecipeSide, TreasurePool, util } = require( '..' );

/**
 * Discovers all treasure pools (information on which monsters/plants can drop which items).
 */
class TreasurePoolDatabase {
	constructor() {
		this.loaded = false;

		// Array of known treasure pools,
		// e.g. { poolName1: TreasurePool1, poolName2: TreasurePool2, ... }
		this.knownPools = new Map();

		// Array of tier-specific variants of treasure pools, e.g.
		// { "uniqueWeapon": [ "uniqueWeapon:2", "uniqueWeapon:3" ], ... }
		this.extraPoolNames = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all treasure pools.
	 */
	load() {
		AssetDatabase.forEach( 'treasurepools', ( filename, asset ) => {
			for ( var [ poolName, poolDataSets ] of Object.entries( asset.data ) ) {
				// Some treasure pools have several tier-specific variants, and we need to find all of them.
				poolDataSets.forEach( ( dataSet, index ) => {
					const [ minTier, rawData ] = dataSet;
					let tieredPoolName = poolName;

					if ( index >= 1 ) {
						tieredPoolName += ':' + ( index + 1 );

						// Remember the fact that "tieredPoolName" is variant of "poolName".
						let extraNames = this.extraPoolNames.get( poolName );
						if ( !extraNames ) {
							extraNames = [];
							this.extraPoolNames.set( poolName, extraNames );
						}

						extraNames.push( tieredPoolName );
					}

					const pool = new TreasurePool( poolName, rawData );
					this.knownPools.set( tieredPoolName, pool );

					// All tier-specific variants of the same TreasurePool share the same article in the wiki.
					if ( index === 0 ) {
						PageNameRegistry.add( pool );
					}

					pool.minTier = minTier;
				} );
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
		const pool = this.find( poolName );
		return pool ? pool.getPossibleOutputs() : RecipeSide.newEmpty();
	}

	/**
	 * Get array of pool names that are tier-specific variants of this pool.
	 *
	 * @param {string} poolName
	 * @return {string[]}
	 */
	getTierSpecificPoolNames( poolName ) {
		return this.extraPoolNames.get( poolName ) || [];
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

		for ( const pool of this.knownPools.values() ) {
			callback( pool );
		}
	}
}

module.exports = new TreasurePoolDatabase();
