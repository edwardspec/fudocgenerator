'use strict';

const { AssetDatabase, RecipeSide, util } = require( '.' );

/**
 * Discovers all treasure pools (information on which monsters/plants can drop which items).
 */
class TreasurePoolDatabase {
	constructor() {
		this.loaded = false;

		// Array of known treasure pools,
		// e.g. { poolName1: RecipeSide1, ... }
		this.knownPools = {};
	}

	/**
	 * Scan the AssetDatabase and find all treasure pools.
	 */
	load() {
		AssetDatabase.forEach( 'treasurepools', ( filename, asset ) => {
			for ( var [ poolName, pool ] of Object.entries( asset.data ) ) {
				var harvestResults = pool[0][1];
				this.knownPools[poolName] = new RecipeSide();

				// The pool has a lot of information on possible distributions of chances,
				// but we only need: 1) a list of item IDs that can be dropped by this TreasurePool,
				// 2) for each item - "average amount of this item per drop".
				// For example, if there is a 25% chance to drop count=12 of some item, then we remember "4".
				// This information allows the player to assess "how many of these items I might find".

				( harvestResults.fill || [] ).forEach( ( poolElement ) => {
					// Items in "fill" array are guaranteed drops that don't depend on "poolRounds".
					this.addCountToItem( poolName, poolElement, 1 );
				} );

				// Items in "pool" array will be randomized several times, depending on "poolRounds" setting.
				// For example, "poolRounds" : [ [0.2, 1], [0.8, 2] ] means
				// "20% change to get the items from the pool once, and 80% to get them twice".
				var poolRounds = harvestResults.poolRounds;
				if ( !poolRounds ) {
					poolRounds = [ [ 1, 1 ] ];
				} else if ( !Array.isArray( poolRounds ) ) {
					poolRounds = [ poolRounds ];
				}

				var averageNumberOfRounds = 0;
				poolRounds.forEach( ( poolRoundsOption ) => {
					if ( !Array.isArray( poolRoundsOption ) ) {
						// Some pools have a fixed number of rounds.
						poolRoundsOption = [ 1, poolRoundsOption ];
					}

					var [ chance, numberOfRounds ] = poolRoundsOption;
					averageNumberOfRounds += chance * numberOfRounds;
				} );

				var poolElements = harvestResults.pool || [],
					sumOfWeights = 0;

				poolElements.forEach( ( poolElement ) => {
					// Items in "pool" array have "weight", which is the chance of them dropping.
					sumOfWeights += ( poolElement.weight || 1 );
				} );

				var weightMultiplier = averageNumberOfRounds / ( sumOfWeights || 1 );
				poolElements.forEach( ( poolElement ) => {
					this.addCountToItem( poolName, poolElement, poolElement.weight * weightMultiplier );
				} );
			}
		} );

		util.log( '[info] Loaded treasure pools (' + Object.keys( this.knownPools ).length + ').' );

		this.loaded = true;
	}

	/**
	 * Increase the average number of "poolElement" dropping from the pool.
	 *
	 * @param {string} poolName
	 * @param {Object} poolElement Structure that refers to 1 item within the pool.
	 * @param {float} weight The count of dropped items will be multiplied by this number.
	 */
	addCountToItem( poolName, poolElement, weight ) {
		var pool = this.knownPools[poolName],
			item = poolElement.item,
			subpoolName = poolElement.pool;

		if ( item ) {
			var [ itemCode, count ] = Array.isArray( item ) ? item : [ item, 1 ];
			pool.addItem( itemCode, { averageCount: count * weight } );
		} else if ( subpoolName ) {
			// This is { pool: "Some other pool" }.
			// We don't want to unwrap it (it can result in hundreds of ingredients with <0.1% chances),
			// but we should add it as pseudo-item.
			pool.addPool( subpoolName, weight );
		} else {
			util.log( '[error] Unknown format of TreasurePool: ' + poolName );
		}
	}

	/**
	 * Get the array of items that can drop from this pool.
	 *
	 * @param {string} poolName
	 * @return {RecipeSide}
	 */
	getPossibleOutputs( poolName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownPools[poolName] || RecipeSide.newEmpty();
	}
}

module.exports = new TreasurePoolDatabase();
