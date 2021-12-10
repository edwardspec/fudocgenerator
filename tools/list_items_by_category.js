/**
 * Find all items with certain category, list them in format suitable for Collections.
 */

'use strict';

const { ItemDatabase } = require( '../lib' ),
	process = require( 'process' );

var category = process.argv[2];
if ( !category ) {
	throw new Error( 'Usage:\n\tnode list_items_by_category.js CATEGORY\n' );
}

var itemCodes = [];
ItemDatabase.forEach( ( itemCode, item ) => {
	if ( item.category === category ) {
		itemCodes.push( itemCode );
	}
} );

var resultingCollection = {};
itemCodes.sort().forEach( ( itemCode, idx ) => {
	resultingCollection[itemCode] = {
		order: idx + 1,
		item: itemCode
	};
} );

console.log( JSON.stringify( resultingCollection, null, '\t' ) );
