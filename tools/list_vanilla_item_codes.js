/**
 * List item codes of all vanilla (unmodded) items.
 */

'use strict';

var { config, AssetDatabase, ItemDatabase } = require( '../lib' );

// Don't skip any items.
config.ignoredItems = [];

// Load only vanilla assets.
AssetDatabase.load( { vanillaOnly: true } );

var itemCodesUnsorted = [];
ItemDatabase.forEach( ( itemCode ) => {
	// Include everything except pseudo-items (e.g. stages of multi-stage crafting stations)
	if ( !itemCode.includes( ':' ) ) {
		itemCodesUnsorted.push( itemCode );
	}
} );

console.log( itemCodesUnsorted.sort().join( '\n' ) );
