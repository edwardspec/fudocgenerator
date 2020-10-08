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
const filenameGlob = '**/*.{config,item,liqitem,matitem,consumable,currency,object,thrownitem,activeitem,augment,chest,head,legs,back,*tool,flashlight,recipe,treasurepools,monstertype}';

class AssetDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known assets:
		// { filename: { data: SomeDataStructure, vanilla: true/false, absolutePath: string, type: string }, ... },
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

			var fileExtension = path.extname( filename ).replace( /^\./, '' ),
				type = 'unknown';

			switch ( fileExtension ) {
				case 'patch':
					type = 'patch';
					break;
				case 'recipe':
					type = 'recipe';
					break;
				case 'config':
					type = 'config';
					break;
				case 'treasurepools':
					type = 'treasurepools';
					break;
				case 'monstertype':
					type = 'monster';
					break;
				default:
					type = 'item';
			}

			this.knownAssets[relativeFilename] = {
				absolutePath: filename,
				vanilla: isVanilla,
				type: type
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
			if ( asset.type !== 'patch' ) {
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

			// Just in case (not really used): remember the fact that this asset was patched.
			this.knownAssets[targetFilename].patched = true;
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

			var objectPath = instruction.path.substring( 1 ).split( '/' );

			if ( op === 'add' ) {
				// Handle add operations to: 1) "/some-array/-" (add to the end of array)
				// 2) "/some-array/123" (add the new element BEFORE what is currently element #123).
				var possiblyIndex = objectPath.pop();

				if ( possiblyIndex !== '-' && parseInt( possiblyIndex ) != possiblyIndex ) {
					// Not an index. We don't consider this an "add to array" operation,
					// instead this is "add new key-value" operation.
					objectPath.push( possiblyIndex );
				} else {
					var currentArray = ( lodash.get( data, objectPath ) || [] );

					if ( possiblyIndex === '-' ) {
						// Pseudo-value "-" means "add after the last element of array".
						// Here "value" is the new element that we are adding.
						value = currentArray.concat( [ value ] );
					} else {
						// Add "value" to currentArray BEFORE currentArray[possiblyIndex]
						var before = currentArray.slice( 0, possiblyIndex ),
							after = currentArray.slice( possiblyIndex );

						value = before.concat( [ value ] ).concat( after );
					}

					op = 'replace';
				}
			}

			var fieldExists = lodash.has( data, objectPath );

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
