/**
 * Discovers all treasure pools (information on which monsters/plants can drop which items).
 */

const { ItemDatabase, AssetDatabase, util } = require( '.' ),
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
		AssetDatabase.forEach( 'treasurepools', ( filename, asset ) => {
			for ( var [ poolName, pool ] of Object.entries( asset.data ) ) {
				var harvestResults = pool[0][1];
				this.knownPools[poolName] = {};

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
	 * @param {string} poolName
	 * @param {Object} poolElement Structure that refers to 1 item within the pool.
	 * @param {float} weight The count of dropped items will be multiplied by this number.
	 */
	addCountToItem( poolName, poolElement, weight ) {
		var item = poolElement.item;
		if ( !item ) {
			return;
		}

		var [ itemCode, count ] = Array.isArray( item ) ? item : [ item, 1 ];
		if ( !this.knownPools[poolName][itemCode] ) {
			this.knownPools[poolName][itemCode] = 0;
		}

		this.knownPools[poolName][itemCode] += count * weight;
	}

	/**
	 * Get the array of items that can drop from this pool.
	 * @param {string} poolName
	 * @param {string|null} excludeItemCode If specified, this item will be excluded from the result.
	 * @return {object} Valid value for "outputs" expected by Recipe class.
	 */
	getPossibleOutputs( poolName, excludeItemCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		var recipeOutputs = {};
		for ( var [ itemCode, averageCount ] of Object.entries( this.knownPools[poolName] || {} ) ) {
			if ( itemCode !== excludeItemCode ) {
				recipeOutputs[itemCode] = { averageCount: averageCount };
			}
		}

		return recipeOutputs;
	}
}

module.exports = new TreasurePoolDatabase();
