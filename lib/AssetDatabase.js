/**
 * Loads all json files (like *.object) from both vanilla and the mod, applying necessary patches.
 */

'use strict';
const { LoadedAsset, config, util } = require( '.' ),
	path = require( 'path' ),
	glob = require( 'fast-glob' ),
	cliProgress = require( 'cli-progress' ),
	lodash = require( 'lodash' );

/**
 * Files matching this glob will be loaded.
 * Note that .material and .liquid are not needed: we need .matitem and .liqitem instead.
 */
const filenameGlob = '{*.{config,item,liqitem,matitem,consumable,currency,object,thrownitem,activeitem,weaponability,augment,chest,head,legs,back,*tool,flashlight,beamaxe,recipe,treasurepools,monstertype,liquid,material,biome,species},crewmembergeologist.npctype}';

class AssetDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known assets:
		// { filename: { data: SomeDataStructure, vanilla: true/false, absolutePath: string, type: string }, ... },
		// where "filename" is relative path (its root is either vanilla directory or mod directory).
		this.knownAssets = new Map();

		// Map of known patches
		this.knownPatches = new Map();
	}

	/**
	 * Scan the sources of both vanilla and the mod and populate AssetDatabase.
	 */
	load() {
		this.discoverFilesInDirectory( config.pathToMod );
		this.discoverFilesInDirectory( config.pathToVanilla );

		this.parseDiscoveredFiles();

		util.log( '[info] AssetDatabase: found ' + this.knownAssets.size + ' assets.' );
		this.loaded = true;
	}

	/**
	 * Recursively search the directory for configuration files, add them to "knownAssets".
	 * This doesn't parse the files (accessing asset.data later lazy-loads the file),
	 * because doing it here would deny us Progress Bar (we don't know the total number of files yet).
	 */
	discoverFilesInDirectory( directory ) {
		var isVanilla = ( directory === config.pathToVanilla ),
			globPattern = filenameGlob;

		if ( !isVanilla ) {
			globPattern += '{,.patch}';
		}

		var globOptions = {
			cwd: directory,
			ignore: [
				// We don't currently use projectile files or namegen data,
				// and these assets are quite large, so let's skip them.
				'projectiles/**/*.config{,.patch}',
				'species/*namegen.config{,.patch}',
				// Example assets for copy-pasting, they are not loaded by the game.
				'a_modders/*.config',
				'**/wild*seed.object{,.patch}'
			],
			baseNameMatch: true
		};

		glob.sync( globPattern, globOptions ).forEach( ( filename ) => {
			if ( this.knownAssets.has( filename ) && isVanilla && !this.knownAssets.get( filename ).vanilla ) {
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
				case 'biome':
					type = 'biome';
					break;
				case 'liquid':
					type = 'liquid';
					break;
				case 'material':
					type = 'material';
					break;
				case 'species':
					type = 'species';
					break;
				case 'npctype':
					type = 'npc';
					break;
				case 'weaponability':
					type = 'ability';
					break;
				default:
					type = 'item';
			}

			var assetInfo = {
				filename: filename,
				absolutePath: directory + '/' + filename,
				vanilla: isVanilla,
				type: type
			};

			var lazyAsset = new LoadedAsset( this, assetInfo );
			if ( type == 'patch' ) {
				this.knownPatches.set( filename.replace( /.patch$/, '' ), lazyAsset );
			} else {
				this.knownAssets.set( filename, lazyAsset );
			}

		} );
	}

	/**
	 * Parse all JSON files that were previously discovered in discoverFilesInDirectory().
	 * This triggers immediate loading of all LoadedAsset objects in this.knownAssets.
	 */
	parseDiscoveredFiles() {
		var progressBar = new cliProgress.Bar( {
			stopOnComplete: true,
			barsize: 20,
			format: '[{bar}] {percentage}% | {value}/{total} | {filename}'
		} );
		progressBar.start( this.knownAssets.size, 0, { filename: '' } );

		var step = 0;
		for ( var [ filename, asset ] of this.knownAssets ) {
			if ( ++ step % 2500 == 0 ) {
				progressBar.update( step, { filename: filename } );
			}

			if ( !asset.data ) {
				// Failed to load.
				this.knownAssets.delete( filename );
			}
		}
		progressBar.update( this.knownAssets.size );
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

			if ( op === 'replace' || op === 'add' ) {
				lodash.set( data, objectPath, value );
			} else if ( op === 'remove' ) {
				// Carefully delete the element from Array/Object.
				// Note: while lodash.unset() would be enough for objects, using it to delete keys from arrays
				// would create holes in the array, resulting in incorrect application of further patches.
				var index = objectPath.pop();
				var list = lodash.get( data, objectPath );

				if ( Array.isArray( list ) ) {
					// Removing numeric index from array.
					list.splice( index, 1 );
					lodash.set( list, objectPath );
				} else {
					// Unsetting property of object.
					objectPath.push( index );
					lodash.unset( data, objectPath );
				}
			} else if ( op === 'test' ) {
				var fieldExists = lodash.has( data, objectPath );
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
	 * @param {string} assetType E.g. "monster", "item" or "biome".
	 * @param {function} callback
	 * Callback gets the following parameters:
	 * 1) relative filename,
	 * 2) information about asset, including loaded data.
	 */
	forEach( assetType, callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ filename, asset ] of this.knownAssets ) {
			if ( asset.type === assetType ) {
				callback( filename, asset );
			}
		}
	}

	/**
	 * Get the parsed asset by path.
	 * @param {string} path Relative path to asset (e.g. "/interface/windowconfig/craftingmech.config").
	 * @return {Object|undefined}
	 */
	get( path ) {
		if ( !this.loaded ) {
			this.load();
		}

		// Remove the leading slash, if any.
		path = path.replace( /^\//, '' );
		return this.knownAssets.get( path );
	}

	/**
	 * Returns the loaded data of asset. Throws an exception if the asset doesn't exist.
	 * @param {string} path
	 * @return {Object}
	 */
	getData( path ) {
		var asset = this.get( path );
		if ( !asset ) {
			throw new Error( 'Required asset not found: ' + path );
		}

		return asset.data;
	}
}

module.exports = new AssetDatabase();
