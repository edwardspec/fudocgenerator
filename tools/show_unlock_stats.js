/**
 * Show the number of items of each category that are unlocked by research nodes.
 */

'use strict';

const { ItemDatabase, ResearchTreeDatabase } = require( '../lib' );

const itemCodes = new Set();

ResearchTreeDatabase.forEach( ( node ) => {
	if ( node.tree === 'No' ) {
		return;
	}

	for ( const itemCode of node.unlocks ) {
		itemCodes.add( itemCode );
	}
} );

const categoryCount = {}; // { 'category1': number1, 'category2': number2 }
for ( const itemCode of itemCodes ) {
	const item = ItemDatabase.find( itemCode );
	if ( !item ) {
		continue;
	}

	const category = item.category;
	categoryCount[category] = ( categoryCount[category] || 0 ) + 1;
}

let totalCount = 0;
for ( const [ category, count ] of Object.entries( categoryCount ).sort( ( a, b ) => a[1] - b[1] ) ) {
	console.log( category + ': ' + count );
	totalCount += count;
}

console.log( '----\nTotal: ', totalCount );
