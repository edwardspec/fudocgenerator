'use strict';

const { RecipeSide, EntityWithPageName, util } = require( '..' ),
	{ capitalCase } = require( 'change-case' );

/**
 * Represents one "treasure pool" (list of possible drops) in the TreasurePoolDatabase.
 */
class TreasurePool {
	/**
	 * @param {string} poolName Unique identifier of this pool.
	 * @param {Object} poolData Structure that describes this pool.
	 */
	constructor( poolName, poolData ) {
		this.name = poolName;
		this.contents = new RecipeSide();

		// Machine-readable name is CamelCase, separate it by spaces and capitalize each word.
		this.displayName = 'Pool: ' + capitalCase( poolName );

		// The pool has a lot of information on possible distributions of chances,
		// but we only need: 1) a list of item IDs that can be dropped by this TreasurePool,
		// 2) for each item - "average amount of this item per drop".
		// For example, if there is a 25% chance to drop count=12 of some item, then we remember "4".
		// This information allows the player to assess "how many of these items I might find".

		( poolData.fill || [] ).forEach( ( poolElement ) => {
			// Items in "fill" array are guaranteed drops that don't depend on "poolRounds".
			this.addCountToItem( poolElement, 1 );
		} );

		// Items in "pool" array will be randomized several times, depending on "poolRounds" setting.
		// For example, "poolRounds" : [ [0.2, 1], [0.8, 2] ] means
		// "20% change to get the items from the pool once, and 80% to get them twice".
		var poolRounds = poolData.poolRounds;
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

		var poolElements = poolData.pool || [],
			sumOfWeights = 0;

		poolElements.forEach( ( poolElement ) => {
			// Items in "pool" array have "weight", which is the chance of them dropping.
			sumOfWeights += ( poolElement.weight || 1 );
		} );

		var weightMultiplier = averageNumberOfRounds / ( sumOfWeights || 1 );
		poolElements.forEach( ( poolElement ) => {
			this.addCountToItem( poolElement, poolElement.weight * weightMultiplier );
		} );
	}

	/**
	 * Increase the average number of "poolElement" dropping from this pool.
	 *
	 * @param {Object} poolElement Structure that refers to 1 item within the pool.
	 * @param {float} weight The count of dropped items will be multiplied by this number.
	 */
	addCountToItem( poolElement, weight ) {
		var item = poolElement.item,
			subpoolName = poolElement.pool;

		if ( item ) {
			var quantityAttributes = {};
			var itemCode, count;

			if ( Array.isArray( item ) ) {
				[ itemCode, count ] = item;
			} else if ( typeof ( item ) === 'string' ) {
				itemCode = item;
				count = 1;
			} else {
				itemCode = item.name;
				count = item.count || 1;
				quantityAttributes.parameters = item.parameters || {};
			}

			quantityAttributes.averageCount = count * weight;
			this.contents.addItem( itemCode, quantityAttributes );
		} else if ( subpoolName ) {
			// This is { pool: "Some other pool" }.
			// We don't want to unwrap it (it can result in hundreds of ingredients with <0.1% chances),
			// but we should add it as pseudo-item.
			this.contents.addPool( subpoolName, weight );
		} else {
			util.log( '[error] Unknown format of TreasurePool: ' + this.name );
		}
	}

	/**
	 * Get the array of items that can drop from this pool.
	 *
	 * @return {RecipeSide}
	 */
	getPossibleOutputs() {
		return this.contents;
	}

	/**
	 * Get text of the MediaWiki article about this TreasurePool.
	 *
	 * @return {string}
	 */
	toArticleText() {
		return '{{All recipes for pool|' + this.name + '}}';
	}
}

util.addMixin( TreasurePool, EntityWithPageName );
module.exports = TreasurePool;
