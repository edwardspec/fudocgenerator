/**
 * List item codes of all vanilla (unmodded) items.
 */

'use strict';

var { ItemDatabase } = require( '../lib' );

var itemCodesUnsorted = [];
ItemDatabase.forEach( ( itemCode, item ) => {
	if ( item.asset.vanilla ) {
		itemCodesUnsorted.push( itemCode );
	}
} );

console.log( itemCodesUnsorted.sort().join( '\n' ) );
