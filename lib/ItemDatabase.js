/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var config = require( '../config.json' ),
	fs = require( 'fs' ),
	process = require( 'process' ),
	util = require( './util' );

/**
 * Files with these extensions will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 */
const itemFileExtensions = [
	'item',
	'liqitem',
	'matitem',
	'consumable',
	// TODO: Commented for faster loading: RecipeDatabase doesn't have crafting recipes (yet?).
	// May be needed later, since some things (like Item Transference Device) use *.object file.
	// 'object'
];

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
		process.stdout.write( "Loading ItemDatabase:\n" );
		this.loadFilesRecursive( config.pathToMod );
		process.stdout.write( "\n" );

		// TODO: what to do with Vanilla items? (items like "goldore" that are not from the mod,
		// but may be a component in certain recipes).
	}

	/**
	 * Recursively search the directory for configuration files like *.material.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	loadFilesRecursive( directory ) {
		fs.readdirSync( directory, { withFileTypes: true } ).forEach( ( dirent ) => {
			var filename = directory + '/' + dirent.name;

			if ( dirent.isDirectory() ) {
				// Must go further.
				this.loadFilesRecursive( filename );
			} else if ( dirent.isFile() ) {
				var extension = filename.split( '.' ).pop();
				if ( itemFileExtensions.indexOf( extension ) !== -1 ) {
					// This is a relevant file that needs to be loaded.
					var loadedData;
					try {
						loadedData = util.loadModFile( filename );
					} catch ( error ) {
						// TODO: write such errors into the logfile.
						// console.log( "Failed to load " + filename, error );
						// Ignore incorrect files.
						return;
					}

					// Print progress on the same line of the terminal (overwriting the previous line).
					// TODO: use a proper progress bar instead.
					process.stdout.write( '\r' + ' '.repeat( process.stdout.columns ) + '\r' );

					var itemName = loadedData.itemName;
					if ( !itemName ) {
						// Ignore incorrect items without the name.
						return;
					}

					this.knownItems[itemName] = loadedData;

					process.stdout.write( '\r' + ' '.repeat( process.stdout.columns ) + '\r' );
					process.stdout.write( filename );
				}
			}
		} );
	}

	/**
	 * Find the item called "itemCode" in the database.
	 * @return {object|null} Arbitrary information about this item (depends on the type of item).
	 */
	find( itemCode ) {
		if ( Object.keys( this.knownItems ).length === 0 ) {
			throw new Error( 'ItemDatabase is empty: load() either hasn\'t been called or failed.' );
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
