/**
 * List item codes of all vanilla (unmodded) items.
 */

'use strict';

var { ItemDatabase } = require( '../lib' );

var itemCodesUnsorted = [];
ItemDatabase.forEach( ( itemCode, item ) => {
	if ( itemCode.includes( ':' ) ) {
		// Pseudo-item (e.g. a stage of multi-stage crafting stations)
		return;
	}

	if ( item.asset.vanilla || item.asset.overwrittenVanilla ) {
		itemCodesUnsorted.push( itemCode );
	}
} );

console.log( itemCodesUnsorted.sort().join( '\n' ) );
