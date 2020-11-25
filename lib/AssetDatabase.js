/**
 * Loads all json files (like *.object) from both vanilla and the mod, applying necessary patches.
 */

'use strict';
const { LoadedAsset, config, util } = require( '.' ),
	glob = require( 'fast-glob' ),
	cliProgress = require( 'cli-progress' ),
	lodash = require( 'lodash' ),
	childProcess = require( 'child_process' ),
	fs = require( 'fs' );

const cacheFilename = util.tmpdir + '/assetdb.cache.json',
	prevCommitFilename = util.tmpdir + '/assetdb.cachedcommit.txt';

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
		if ( !this.loadFromCache() ) {
			util.log( '[notice] AssetDatabase: no cache available. Will find/load all existing asset files.' );
			this.loadWithoutCache();
		}

		if ( this.mustUpdateCache ) {
			// This is skipped if loadFromCache() succeeded and no files were modified.
			this.updateCache();
		}

		util.log( '[info] AssetDatabase: found ' + this.knownAssets.size + ' assets.' );
		this.loaded = true;
	}

	/**
	 * Attempt to load AssetDatabase by scanning files in config.pathToMod and config.pathToVanilla.
	 * Unlike loadFromCache(), this works even without a Git repository.
	 */
	loadWithoutCache() {
		this.discoverFilesInDirectory( config.pathToMod );
		this.discoverFilesInDirectory( config.pathToVanilla );

		this.parseDiscoveredFiles();
		this.mustUpdateCache = true;
	}

	/**
	 * Attempt to load AssetDatabase from cache. Only works if config.pathToMod has Git repository.
	 * @return Boolean True if successfully loaded, false if AssetDatabase must be loaded from scratch.
	 */
	loadFromCache() {
		var prevCommit = this.getCachedCommit();
		if ( !prevCommit ) {
			// Cache doesn't exist.
			return false;
		}

		var modifiedFiles = this.getFilesModifiedInGit( prevCommit );
		if ( modifiedFiles === false ) {
			return false;
		}

		// Because we know "which files were modified since the last updateCache()",
		// it's safe to use the cache (we know which parts of it must be updated).
		var cachedAssets;
		try {
			cachedAssets = JSON.parse( fs.readFileSync( cacheFilename ) );
		} catch ( error ) {
			console.log( '[error] AssetDatabase: failed to load from cache: ' + error.message );
			return false;
		}

		for ( var [ key, assetInfo ] of Object.values( cachedAssets ) ) {
			// assetInfo became a simple Object after JSON.parse(). Must be of LoadedAsset class.
			this.knownAssets.set( key, new LoadedAsset( this, assetInfo ) );
		}

		// Update the cache.
		// Note that vanilla assets are never updated (new releases of base game are exceptionally rare).
		// If vanilla got modified, user should just delete the cache file manually.
		for ( var filename of modifiedFiles ) {
			util.log( '[debug] AssetDatabase: updating the cache of modified asset: ' + filename );

			var targetOfPatch = filename.replace( /\.patch$/, '' );
			var isPatch = ( filename !== targetOfPatch );

			// We don't have this.knownPatches in the cache (it's empty when we load from cache),
			// but if some asset got modified, then we need to load its patch as well.
			var patchFilename = isPatch ? filename : ( filename + '.patch' );
			if ( fs.existsSync( config.pathToMod + '/' + patchFilename ) ) {
				this.addAssetByFilename( patchFilename, config.pathToMod, false );
			}

			if ( isPatch ) {
				// When the patch itself gets modified, all we need to do is reload the "target" asset.
				// Furthermore, if target asset doesn't exist, we don't need to do anything.
				var targetAsset = this.knownAssets.get( targetOfPatch );
				if ( targetAsset ) {
					util.log( '[debug] AssetDatabase: reloaded asset (its patch got modified): ' + targetOfPatch );
					targetAsset.loadNow();
				}
				continue;
			}

			// Not a patch.
			if ( !fs.existsSync( config.pathToMod + '/' + filename ) ) {
				// Asset was deleted.
				this.knownAssets.delete( filename );
			} else {
				if ( this.knownAssets.has( filename ) ) {
					// Existing asset was modified. Reload it.
					this.knownAssets.get( filename ).loadNow();
				} else {
					// New asset was added.
					// FIXME: don't add images and other files that would be excluded by discoverFilesInDirectory().
					var lazyAsset = this.addAssetByFilename( filename, config.pathToMod, false );
					if ( lazyAsset ) {
						lazyAsset.loadNow();
					}
				}
			}
		}

		this.mustUpdateCache = ( modifiedFiles.length > 0 );
		return true;
	}

	/**
	 * Save the current state of AssetDatabase to cache.
	 */
	updateCache() {
		fs.mkdirSync( util.tmpdir, { recursive: true } );
		fs.rmSync( prevCommitFilename, { force: true } );
		fs.writeFileSync( cacheFilename, JSON.stringify( Array.from( this.knownAssets.entries() ) ) );
		fs.writeFileSync( prevCommitFilename, this.getCurrentCommit() );

		util.log( '[info] AssetDatabase: updated the cache.' );
	}

	/**
	 * Returns current Git commit in config.pathToMod. Fails if this path is not a Git repository.
	 * @return {string}
	 */
	getCurrentCommit() {
		return childProcess.execSync( 'git rev-parse HEAD', {
			cwd: config.pathToMod,
			encoding: 'utf8'
		} ).trim();
	}

	/**
	 * Determine "HEAD commit in Git at the moment when the cache of AssetDatabase was last updated".
	 * @return {string|null}
	 */
	getCachedCommit() {
		if ( !fs.existsSync( prevCommitFilename ) ) {
			return null;
		}

		return fs.readFileSync( prevCommitFilename ).toString();
	}

	/**
	 * Return array of filenames that were modified in the mod since "prevCommit".
	 * This uses Git repository in config.pathToMod. Cache won't work if such repository doesn't exist.
	 * @return {Array|false} False if failed to determine. Array of filenames if successful.
	 */
	getFilesModifiedInGit( prevCommit ) {
		var result = childProcess.spawnSync(
			'git', [ 'diff', '--name-only', '--no-renames', prevCommit ],
			{
				cwd: config.pathToMod,
				encoding: 'utf8'
			}
		);
		if ( result.status !== 0 ) {
			console.log( result.stderr );
			console.log( '[warn] No Git repository in ' + config.pathToMod + ': AssetDatabase can\'t use the cache to load faster.' );
			return false;
		}

		var list = result.stdout.trim();
		return list ? list.split( '\n' ) : [];
	}

	/**
	 * Manually add 1 asset to this.knownAssets.
	 * Used in discoverFilesInDirectory (for all files) and loadFromCache (for new files added to Git).
	 * @param {string} filename Relative filename, e.g. "weather/healingstorm.weather".
	 * @param {string} directory Either config.pathToMod or config.pathToVanilla.
	 * @param {Boolean} isVanilla
	 * @return LoadedAsset
	 */
	addAssetByFilename( filename, directory, isVanilla ) {
		if ( isVanilla && this.knownAssets.has( filename ) && !this.knownAssets.get( filename ).vanilla ) {
			// If both mod and vanilla have an asset with the same name,
			// that means "the mod has completely replaced this asset,
			// and the vanilla asset must be ignored".
			return;
		}

		var fileExtension = filename.split( '.' ).pop().toLowerCase(),
			type = config.extensionToAssetType[fileExtension];
		if ( !type ) {
			// Unknown filename extension: we don't need to load these files as JSON assets.
			return;
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

		return lazyAsset;
	}

	/**
	 * Recursively search the directory for configuration files, add them to "knownAssets".
	 * This doesn't parse the files (calling asset.loadNow() later lazy-loads the file),
	 * because doing it here would deny us Progress Bar (we don't know the total number of files yet).
	 ( @param {string}
	 */
	discoverFilesInDirectory( directory ) {
		var isVanilla = ( directory === config.pathToVanilla );

		var globPattern = '*.{' + Object.keys( config.extensionToAssetType ).join( ',' ) + '}';
		var globOptions = {
			cwd: directory,
			ignore: [
				// We don't currently use projectile files or namegen data,
				// and these assets are quite large, so let's skip them.
				'projectiles/**/*.config{,.patch}',
				'species/*namegen.config{,.patch}',
				// Example assets for copy-pasting, they are not loaded by the game.
				'a_modders/*.config',
				'**/wild*seed.object{,.patch}',
				'tests',
				'.git'
			],
			baseNameMatch: true
		};

		glob.sync( globPattern, globOptions ).forEach( ( filename ) => {
			this.addAssetByFilename( filename, directory, isVanilla );
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

			if ( !asset.loadNow() ) {
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
