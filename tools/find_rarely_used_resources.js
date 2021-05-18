/**
 * Find crafting materials that are rarely used as inputs in RecipeDatabase.
 */

'use strict';

const { ItemDatabase, RecipeDatabase } = require( '../lib' );

var itemCodeToUses = new Map();

RecipeDatabase.forEach( ( recipe ) => {
	recipe.inputs.getItemCodes().forEach( ( itemCode ) => {
		var count = itemCodeToUses.get( itemCode ) || 0;
		itemCodeToUses.set( itemCode, count + 1 );
	} );
} );

[...itemCodeToUses.entries()].sort( ( a, b ) => a[1] - b[1] ).forEach( ( itemAndCount ) => {
	var [ itemCode, uses ] = itemAndCount;
	var item = ItemDatabase.find( itemCode );
	if ( !item ) {
		// Ignore items not from FU+vanilla (in extraction recipes, etc.),
		// as well as ignored items (such as wild seeds).
		return;
	}

	if ( item.category !== 'craftingMaterial' ) {
		// Only interested in crafting materials, not edible plants, etc.
		return;
	}

	if ( itemCode.startsWith( 'bee_' ) ) {
		// Ignore bees (they are marked as "craftingMaterial" in the sources).
		return;
	}

	console.log( itemCode, uses );
} );
