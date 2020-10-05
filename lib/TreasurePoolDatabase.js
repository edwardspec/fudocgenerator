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
				var possibleItems = ( harvestResults.fill || [] )
					.concat( harvestResults.pool || [] )
					.map( ( poolElement ) => poolElement.item )
					.map( ( item ) => Array.isArray( item ) ? item[0] : item );

				// Unique list.
				possibleItems = Array.from( new Set( possibleItems ) );

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
