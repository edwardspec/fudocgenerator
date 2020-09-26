/**
 * Loads all json files (like *.object) from both vanilla and the mod, applying necessary patches.
 */

'use strict';
var config = require( '../config.json' ),
	util = require( './util' ),
	path = require( 'path' ),
	glob = require( 'fast-glob' ),
	cliProgress = require( 'cli-progress' ),
	process = require( 'process' ),
	lodash = require( 'lodash' );

/**
 * Files matching this glob will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 */
const filenameGlob = '**/*.{config,item,liqitem,matitem,consumable,currency,object,thrownitem,activeitem,augment,chest,head,legs,back,*tool,flashlight,recipe,treasurepools}';

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
		this.discoverFilesInDirectory( config.pathToMod );
		this.discoverFilesInDirectory( config.pathToVanilla );

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

			if ( this.knownAssets[relativeFilename] && isVanilla && !this.knownAssets[relativeFilename].vanilla ) {
				// If both mod and vanilla have an asset with the same name,
				// that means "the mod has completely replaced this asset,
				// and the vanilla asset must be ignored".
				return;
			}

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
				continue;
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

			// Patch itself is not an asset, so we remove it from knownAssets.
			var patch = this.knownAssets[filename].data;
			delete this.knownAssets[filename];

			// File that we are patching has the same name, but without the ".patch" extension.
			var targetFilename = filename.replace( /\.patch$/, '' );
			if ( !this.knownAssets[targetFilename] ) {
				util.log( "[warning] Ignoring the patch " + filename + ": target file doesn't exist." );
				continue;
			}

			// We need to apply instructions from "patch" to "data".
			this.applyPatchInstructions( patch, this.knownAssets[targetFilename].data );
		}
	}

	applyPatchInstructions( patch, data ) {
		if ( Array.isArray( patch[0] ) ) {
			// This patch is an Array of patches, not a single patch (which is Array of instructions).
			// Handle this recursively.
			patch.forEach( ( subpatch ) => this.applyPatchInstructions( subpatch, data ) );
			return;
		}

		// This is set to true if we find "test" operation that tells us to ignore the rest of this patch.
		var patchSkipped = false;

		// Single patch (array of instructions).
		patch.forEach( ( instruction ) => {
			if ( patchSkipped ) {
				// This instruction must be ignored, because preceding "test" instruction says so.
				return;
			}

			var op = instruction.op,
				value = instruction.value;

			if ( op === 'copy' || op === 'move' ) {
				// These operations are not supported.
				// They are also not used in the mod.
				return;
			}

			var objectPath = instruction.path.substring( 1 ).split( '/' ),
				fieldExists = false;

			if ( objectPath[objectPath.length - 1] === '-' ) {
				// Pseudo-value "-" means "after the last element of array" and is used with "add" operation.
				// Here "value" is the new element that we are adding.
				objectPath.pop();
				value = ( lodash.get( data, objectPath ) || [] ).concat( [ value ] );
			} else {
				// Normal path without trailing "/-".
				fieldExists = lodash.has( data, objectPath );
			}

			if ( op === 'replace' || ( op === 'add' && !fieldExists ) ) {
				lodash.set( data, objectPath, value );
			} else if ( op === 'remove' ) {
				lodash.unset( data, objectPath );
			} else if ( op === 'test' ) {
				if ( fieldExists && instruction.inverse ) {
					// This patch shouldn't be applied if the field exists.
					patchSkipped = true;
				} else if ( !fieldExists && !instruction.inverse ) {
					// This patch shouldn't be applied, because the field doesn't exist.
					patchSkipped = true;
				}
			}
		} );
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

	/**
	 * Get the parsed asset by path.
	 * @param string path Relative path to asset (e.g. "/interface/windowconfig/craftingmech.config").
	 * @return Object|undefined
	 */
	get( path ) {
		// Remove the leading slash, if any.
		path = path.replace( /^\//, '' );
		return this.knownAssets[path];
	}
}

module.exports = new AssetDatabase();
