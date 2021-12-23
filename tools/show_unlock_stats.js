/**
 * Show the number of items of each category that are unlocked by research nodes.
 */

'use strict';

const { ItemDatabase, ResearchTreeDatabase } = require( '../lib' );

let itemCodes = new Set();

ResearchTreeDatabase.forEach( ( node ) => {
	if ( node.tree === 'No' ) {
		return;
	}

	for ( let itemCode of node.unlocks ) {
		itemCodes.add( itemCode );
	}
} );

let categoryCount = {}; // { 'category1': number1, 'category2': number2 }
for ( let itemCode of itemCodes ) {
	let item = ItemDatabase.find( itemCode );
	if ( !item ) {
		continue;
	}

	let category = item.category;
	categoryCount[category] = ( categoryCount[category] || 0 ) + 1;
}

let totalCount = 0;
for ( let [ category, count ] of Object.entries( categoryCount ).sort( ( a, b ) => a[1] - b[1] ) ) {
	console.log( category + ': ' + count );
	totalCount += count;
}

console.log( '----\nTotal: ', totalCount );
