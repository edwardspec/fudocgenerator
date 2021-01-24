/**
 * List all mentions of nonexistent items in TreasurePools.
 */

'use strict';

var { TreasurePoolDatabase, ItemDatabase } = require( '../lib' );

// { itemCode1: [ poolName1, poolName2, ... ] }
var missingItemsToPools = {};

TreasurePoolDatabase.forEach( ( pool ) => {
	pool.getPossibleOutputs().getItemCodes().forEach( ( itemCode ) => {
		if ( !ItemDatabase.find( itemCode ) ) {
			// Unknown item.
			if ( !missingItemsToPools[itemCode] ) {
				missingItemsToPools[itemCode] = [];
			}

			missingItemsToPools[itemCode].push( pool.name );
		}
	} );
} );

console.log( missingItemsToPools );
