/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	process = require( 'process' ),
	glob = require( 'fast-glob' ),
	cliProgress = require( 'cli-progress' ),
	util = require( './util' );

/**
 * Files matching this glob will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 * Note: *.object not included to load faster (RecipeDatabase doesn't have crafting recipes yet),
 * but may be needed later, since some things (like Item Transference Device) use *.object file.
 *
 */
const filenameGlob = '**/*.{item,liqitem,matitem,consumable,currency,object,thrownitem}';


class ItemDatabase {
	constructor() {
		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};
	}

	/**
	 * Scan the sources of the mod and populate ItemDatabase.
	 * NOTE: this is an asynchronous operation, and it returns a Promise.
	 * @return {Promise}
	 */
	load() {
		this.loadFilesInDirectory( config.pathToMod );
		this.loadFilesInDirectory( config.pathToVanilla );
	}

	/**
	 * Recursively search the directory for configuration files like *.liqitem.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	loadFilesInDirectory( directory ) {
		var files = glob.sync( directory + '/' + filenameGlob ),
			progressBar = new cliProgress.SingleBar( { stopOnComplete: true } );

		progressBar.start( files.length, 0 );

		files.forEach( ( filename ) => {
			progressBar.increment();

			var loadedData;
			try {
				loadedData = util.loadModFile( filename );
			} catch ( error ) {
				// Ignore incorrect files.
				util.log( "[warning] Failed to load JS file: " + filename + ": " +
					error.message + "\n" +  error.stack.split( "\n" ).slice( 1, 3 ).join( "\n" ) );
				return;
			}

			var itemName = loadedData.itemName || loadedData.objectName;
			if ( !itemName ) {
				// Ignore incorrect items without the name.
				util.log( '[warning] ItemDatabase: Ignoring file without itemName/objectName: ' + filename );
				return;
			}

			this.knownItems[itemName] = loadedData;
		} );
	}

	/**
	 * Find the item called "itemCode" in the database.
	 * @return {object|null} Arbitrary information about this item (depends on the type of item).
	 */
	find( itemCode ) {
		if ( Object.keys( this.knownItems ).length === 0 ) {
			throw new Error( 'ItemDatabase: no items found: load() either hasn\'t been called or failed.' );
		}

		return this.knownItems[itemCode];
	}

	/**
	 * Debugging method: print the entire database to STDOUT (for troubleshooting).
	 */
	dump() {
		console.log( JSON.stringify( this.knownItems, null, '  ' ) );
	}
}

module.exports = new ItemDatabase();
