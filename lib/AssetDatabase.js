/**
 * Loads all json files (like *.object) from both vanilla and the mod, applying necessary patches.
 */

'use strict';
var config = require( '../config.json' ),
	util = require( './util' ),
	path = require( 'path' ),
	glob = require( 'fast-glob' ),
	cliProgress = require( 'cli-progress' ),
	process = require( 'process' );

/**
 * Files matching this glob will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 */
const filenameGlob = '**/*.{item,liqitem,matitem,consumable,currency,object,thrownitem,activeitem,augment,chest,head,legs,back,*tool,flashlight,recipe}';

class AssetDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known assets:
		// { filename: { data: SomeDataStructure, vanilla: true/false, absolutePath: string, fileExtension: string }, ... },
		// where "filename" is relative path (its root is either vanilla directory or mod directory).
		this.knownAssets = {};
	}

	/**
	 * Scan the sources of both vanilla and the mod and populate AssetDatabase.
	 */
	load() {
		this.discoverFilesInDirectory( config.pathToVanilla );
		this.discoverFilesInDirectory( config.pathToMod );

		this.parseDiscoveredFiles();
		this.applyPatches();

		util.log( '[info] AssetDatabase: found ' + Object.keys( this.knownAssets ).length + ' assets.' );
		this.loaded = true;
	}

	/**
	 * Recursively search the directory for configuration files, add them to "knownAssets".
	 * This doesn't parse the files (call parseDiscoveredFiles() later to do so),
	 * because doing it here would deny us Progress Bar (we don't know the total number of files yet).
	 */
	discoverFilesInDirectory( directory ) {
		var savedDirectory = process.cwd();
		process.chdir( directory );

		var isVanilla = ( directory === config.pathToVanilla ),
			pathPrefix = directory + '/',
			globPattern = pathPrefix + filenameGlob;

		if ( !isVanilla ) {
			globPattern += '{,.patch}';
		}

		glob.sync( globPattern ).forEach( ( filename ) => {
			var relativeFilename = filename.substring( pathPrefix.length );
			this.knownAssets[relativeFilename] = {
				absolutePath: filename,
				vanilla: isVanilla,
				fileExtension: path.extname( filename )
			};
		} );

		process.chdir( savedDirectory );
	}

	/**
	 * Parse all JSON files that were previously discovered in discoverFilesInDirectory().
	 */
	parseDiscoveredFiles() {
		var progressBar = new cliProgress.Bar( {
			stopOnComplete: true,
			barsize: 20,
			format: '[{bar}] {percentage}% | {value}/{total} | {filename}'
		} );
		progressBar.start( Object.keys( this.knownAssets ).length, 0, { filename: '' } );

		for ( var [ filename, asset ] of Object.entries( this.knownAssets ) ) {
			progressBar.increment( { filename: filename } );

			var loadedData;
			try {
				loadedData = util.loadModFile( asset.absolutePath );
			} catch ( error ) {
				// Ignore incorrect files.
				util.log( "[warning] Failed to load JS file: " + asset.absolutePath + ": " +
					error.message + "\n" +  error.stack.split( "\n" ).slice( 1, 3 ).join( "\n" ) );

				delete this.knownAssets[filename];
				return;
			}

			this.knownAssets[filename].data = loadedData;
		}
	}

	/**
	 * Merge all assets that are named "a/b/something.ext.patch" into the asset "a/b/something.ext".
	 */
	applyPatches() {
		for ( var [ filename, asset ] of Object.entries( this.knownAssets ) ) {
			if ( asset.fileExtension !== '.patch' ) {
				// Not a patch.
				continue;
			}

			// TODO: not yet implemented.

			delete this.knownAssets[filename];
		}
	}

	/**
	 * Iterate over the entire database, calling the callback for each asset.
	 * Callback gets the following parameters:
	 * 1) relative filename,
	 * 2) information about asset, including loaded data.
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ filename, asset ] of Object.entries( this.knownAssets ) ) {
			callback( filename, asset );
		}
	}

}

module.exports = new AssetDatabase();
