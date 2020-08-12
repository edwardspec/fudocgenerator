/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var config = require( '../config.json' ),
	util = require( './util' );

/**
 * Files matching this glob will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 */
const filenameGlob = '**/*.{item,liqitem,matitem,consumable,currency,object,thrownitem,activeitem}';

class ItemDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};
	}

	/**
	 * Scan the sources of the mod and populate ItemDatabase.
	 */
	load() {
		console.log( 'ItemDatabase: loading the items from mod and vanilla...' );
		this.loadFilesInDirectory( config.pathToMod );
		this.loadFilesInDirectory( config.pathToVanilla );

		util.log( '[info] ItemDatabase: found ' + Object.keys( this.knownItems ).length + ' items.' );
		this.loaded = true;
	}

	/**
	 * Recursively search the directory for configuration files like *.liqitem.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	loadFilesInDirectory( directory ) {
		util.loadModFilesGlob( directory + '/' + filenameGlob, ( loadedData, filename ) => {
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
