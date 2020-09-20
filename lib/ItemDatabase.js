/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var util = require( './util' ),
	AssetDatabase = require( './AssetDatabase' );

class ItemDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};
	}

	/**
	 * Find all items in the AssetDatabase.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	load() {
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.fileExtension === '.recipe' ) {
				// Not an item.
				return;
			}

			var loadedData = asset.data;
			if ( loadedData.hasObjectItem === false ) {
				// There are objects like "Potato Seed" with 2 variants (wildpotatoseed and potatoseed).
				// Those marked with hasObjectItem=false can't be obtained by player and must be excluded.
				return;
			}

			var itemName = loadedData.itemName || loadedData.objectName;
			if ( !itemName ) {
				// Ignore incorrect items without the codename (like 'fu_carbon').
				util.log( '[warning] ItemDatabase: Ignoring file without itemName/objectName: ' + filename );
				return;
			}

			if ( !loadedData.shortdescription ) {
				// Ignore incorrect items without human-readable display name (like 'Liquid Erchius Fuel').
				util.log( '[warning] ItemDatabase: Ignoring file without shortdescription: ' + filename );
				return;
			}

			// Remove the color codes from the description (e.g. "^#e43774;" or "^reset;" ).
			loadedData.displayName = util.cleanDescription( loadedData.shortdescription );

			this.knownItems[itemName] = loadedData;
		} );

		util.log( '[info] ItemDatabase: found ' + Object.keys( this.knownItems ).length + ' items.' );
		this.loaded = true;
	}

	/**
	 * Find the item called "itemCode" in the database.
	 * @return {object|null} Arbitrary information about this item (depends on the type of item).
	 */
	find( itemCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownItems[itemCode];
	}

	/**
	 * Iterate over the entire database, calling the callback for each item.
	 * Callback gets the following parameters: 1) item code, 2) loaded data.
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ itemCode, loadedData ] of Object.entries( this.knownItems ) ) {
			callback( itemCode, loadedData );
		}
	}

	/**
	 * Find the human-readable name of item "itemCode" in the database (if any).
	 * If not found, then false is returned.
	 * @param {string|false} itemCode
	 * @return
	 */
	getDisplayName( itemCode ) {
		var item = this.find( itemCode );
		return item ? item.displayName : false;
	}

	/**
	 * Debugging method: print the entire database to STDOUT (for troubleshooting).
	 */
	dump() {
		console.log( JSON.stringify( this.knownItems, null, '  ' ) );
	}
}

module.exports = new ItemDatabase();
