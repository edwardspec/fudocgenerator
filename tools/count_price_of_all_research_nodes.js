/**
 * Count the sum of Research currency and other items that are needed to unlock everything.
 * Takes into account that items are NOT consumed, only currencies.
 */

'use strict';

const { ItemDatabase, ResearchTreeDatabase, RecipeSide } = require( '../lib' );

const isConsumed = {
	// List of resources that are consumed when unlocking the node.
	fuscienceresource: true,
	fumadnessresource: true,
	fugeneticmaterial: true,
	essence: true,
	money: true
};

let itemCount = {}; // { itemCode => count, ... }

ResearchTreeDatabase.forEach( ( node ) => {
	node.price.getAllComponents().forEach( ( component ) => {
		let count = component.quantity.count,
			itemCode = component.code;

		if ( count && component.isItem ) {
			if ( !itemCount[itemCode] ) {
				itemCount[itemCode] = 0;
			}

			if ( isConsumed[itemCode] ) {
				itemCount[itemCode] += count;
			} else {
				itemCount[itemCode] = Math.max( count, itemCount[itemCode] );
			}
		}
	} );
} );

const itemCountSorted = Object.entries( itemCount ).sort( ( a, b ) => {
	// Sort by quantity: from more to less.
	const countDiff = b[1] - a[1];
	if ( countDiff !== 0 ) {
		return countDiff;
	}

	// Count is the same, sort alphabetically.
	const name1 = ItemDatabase.getDisplayName( a[0] ) || '',
		name2 = ItemDatabase.getDisplayName( b[0] ) || '';
	return name1.localeCompare( name2 );
} );

// Print all required items.
let totalCost = new RecipeSide();
for ( let [ itemCode, count ] of itemCountSorted ) {
	totalCost.addItem( itemCode, { count: count } );
}

ItemDatabase.load();
console.log( 'Necessary amount of Research and items to unlock ALL nodes:\n' + totalCost.toWikitext() );
