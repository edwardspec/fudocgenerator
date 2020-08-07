/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	path = require( 'path' ),
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
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};
	}

	/**
	 * Scan the sources of the mod and populate ItemDatabase.
	 * NOTE: this is an asynchronous operation, and it returns a Promise.
	 * @return {Promise}
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
		var files = glob.sync( directory + '/' + filenameGlob ),
			progressBar = new cliProgress.Bar( {
				stopOnComplete: true,
				barsize: 20,
				format: '[{bar}] {percentage}% | {value}/{total} | {filename}'
			} );

		progressBar.start( files.length, 0, { filename: '' } );

		files.forEach( ( filename ) => {
			progressBar.increment( { filename: path.relative( directory, filename ) } );

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
		if ( !this.loaded ) {
			this.load();
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
