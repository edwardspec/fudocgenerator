/**
 * Find all references to nonexistent items in learnBlueprintsOnPickup[] array of existing items.
 */

'use strict';

const { ItemDatabase } = require( '../lib' );

ItemDatabase.forEach( ( itemCode, data ) => {
	var blueprints = data.learnBlueprintsOnPickup;
	( blueprints || [] ).forEach( ( unlockedItemCode ) => {
		if ( !ItemDatabase.find( unlockedItemCode ) ) {
			console.log( "Item " + itemCode + " unlocks " + unlockedItemCode + ", but such item doesn't exist." );
		}
	} );
} );
