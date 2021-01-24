/**
 * List all mentions of nonexistent items in TreasurePools that are mentioned in recipes.
 */

'use strict';

var { TreasurePoolDatabase, ItemDatabase, RecipeDatabase } = require( '../lib' );

// { itemCode1: [ poolName1, poolName2, ... ] }
var missingItemsToPools = {};

for ( var poolName of RecipeDatabase.listMentionedTreasurePools() ) {
	var pool = TreasurePoolDatabase.find( poolName );
	if ( !pool ) {
		console.log( '[error] Unknown TreasurePool in the recipe: ' + poolName );
		continue;
	}

	pool.getPossibleOutputs().getItemCodes().forEach( ( itemCode ) => {
		if ( !ItemDatabase.find( itemCode ) ) {
			// Unknown item.
			if ( !missingItemsToPools[itemCode] ) {
				missingItemsToPools[itemCode] = [];
			}

			missingItemsToPools[itemCode].push( pool.name );
		}
	} );
}

console.log( missingItemsToPools );
