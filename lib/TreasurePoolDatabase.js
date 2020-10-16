/**
 * Discovers all treasure pools (information on which monsters/plants can drop which items).
 */

const ItemDatabase = require( './ItemDatabase' ),
	AssetDatabase = require( './AssetDatabase' ),
	util = require( './util' ),
	config = require( '../config' );

class TreasurePoolDatabase {
	constructor() {
		this.loaded = false;

		// Array of known treasure pools,
		// e.g. { poolName1: [ itemCode1, itemCode2, ... ], ... }
		this.knownPools = {};
	}

	/**
	 * Scan the ItemDatabase and find all crafting stations.
	 */
	load() {
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.type !== 'treasurepools' ) {
				return;
			}

			for ( var [ poolName, pool ] of Object.entries( asset.data ) ) {
				var harvestResults = pool[0][1];

				// The pool has a lot of information on possible distributions of chances,
				// but we only need: 1) a list of item IDs that can be dropped by this TreasurePool,
				// 2) for each item - "average amount of this item per drop".
				// For example, if there is a 25% chance to drop count=12 of some item, then we remember "4".
				// This information allows the player to assess "how many of these items I might find".

				var itemCodeToAverageCount = {};
				( harvestResults.fill || [] ).forEach( ( poolElement ) => {
					// Items in "fill" array are guaranteed drops that don't depend on "poolRounds".
					var item = poolElement.item;
					if ( item ) {
						var [ itemCode, count ] = Array.isArray( item ) ? item : [ item, 1 ];
						if ( !itemCodeToAverageCount[itemCode] ) {
							itemCodeToAverageCount[itemCode] = 0;
						}

						itemCodeToAverageCount[itemCode] += count;
					}
				} );

				// Items in "pool" array will be randomized several times, depending on "poolRounds" setting.
				// For example, "poolRounds" : [ [0.2, 1], [0.8, 2] ] means
				// "20% change to get the items from the pool once, and 80% to get them twice".
				var poolRounds = poolRounds;
				if ( !poolRounds ) {
					poolRounds = [ [ 1, 1 ] ];
				} else if ( !Array.isArray( poolRounds ) ) {
					poolRounds = [ poolRounds ];
				}

				var averageNumberOfRounds = 0;
				poolRounds.forEach( ( chance, numberOfRounds ) => {
					averageNumberOfRounds += chance * numberOfRounds;
				} );

				( harvestResults.pool || [] ).forEach( ( poolElement ) => {
					// Items in "pool" array have "weight", which is the chance of them dropping.
					var item = poolElement.item;
					if ( item ) {
						var [ itemCode, count ] = Array.isArray( item ) ? item : [ item, 1 ];
						if ( !itemCodeToAverageCount[itemCode] ) {
							itemCodeToAverageCount[itemCode] = 0;
						}

						itemCodeToAverageCount[itemCode] += count * poolElement.weight * averageNumberOfRounds;
					}
				} );

				// Unique list.
				var possibleItems = Object.keys( itemCodeToAverageCount );

				this.knownPools[poolName] = possibleItems;
			}
		} );

		util.log( '[info] Loaded treasure pools (' + Object.keys( this.knownPools ).length + ').' );

		this.loaded = true;
	}

	/**
	 * Get the array of items codes (e.g. [ 'ironore', 'copperore' ] that can drop from this pool.
	 * @return {object}
	 */
	getPossibleItems( poolName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownPools[poolName] || [];
	}
}

module.exports = new TreasurePoolDatabase();
