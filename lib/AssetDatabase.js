'use strict';
const { LoadedAsset, config, util } = require( '.' ),
	cliProgress = require( 'cli-progress' ),
	childProcess = require( 'child_process' ),
	fs = require( 'fs' ),
	picomatch = require( 'picomatch' ),
	fsWalkSync = require( '@nodelib/fs.walk' ).walkSync;

const cacheFilename = util.tmpdir + '/assetdb.cache.json',
	prevCommitFilename = util.tmpdir + '/assetdb.cachedcommit.txt';

/**
 * Loads all json files (like *.object) from both vanilla and the mod, applying necessary patches.
 */
class AssetDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known assets:
		// { filename: { data: SomeDataStructure, vanilla: true/false, absolutePath: string, type: string }, ... },
		// where "filename" is relative path (its root is either vanilla directory or mod directory).
		this.knownAssets = new Map();

		// Map of known patches
		this.knownPatches = new Map();

		// Lists of assets of each known assetType. Used to improve performance of AssetDatabase.forEach().
		// Format: { "item": [ [ filename1, asset1 ], ... ], "monster": [ [ ... ], ... ] }
		this.knownAssetsByType = {};
	}

	/**
	 * Scan the sources of both vanilla and the mod and populate AssetDatabase.
	 *
	 * @param {Object} options if options.vanillaOnly is true, only vanilla assets will be loaded.
	 */
	load( options = {} ) {
		var canUseCache = !options.vanillaOnly;
		if ( !canUseCache || !this.loadFromCache() ) {
			util.log( '[notice] AssetDatabase: no cache available. Will find/load all existing asset files.' );
			this.loadWithoutCache( options );
		}

		if ( canUseCache && this.mustUpdateCache ) {
			// This is skipped if loadFromCache() succeeded and no files were modified.
			this.updateCache();
		}

		// Populate this.knownAssetsByType, which will be used in forEach().
		for ( var type of Object.values( config.extensionToAssetType ).concat( [ 'unknown' ] ) ) {
			this.knownAssetsByType[type] = [];
		}

		for ( var [ filename, asset ] of this.knownAssets ) {
			this.knownAssetsByType[asset.type].push( [ filename, asset ] );
		}

		util.log( '[info] AssetDatabase: found ' + this.knownAssets.size + ' assets.' );
		this.loaded = true;
	}

	/**
	 * Attempt to load AssetDatabase by scanning files in config.pathToMod and config.pathToVanilla.
	 * Unlike loadFromCache(), this works even without a Git repository.
	 *
	 * @param {Object} options if options.vanillaOnly is true, only vanilla assets will be loaded.
	 */
	loadWithoutCache( options ) {
		// Measure performance (for logging).
		var timeStart = Date.now();

		if ( !options.vanillaOnly ) {
			this.discoverFilesInDirectory( config.pathToMod );
		}
		this.discoverFilesInDirectory( config.pathToVanilla );

		this.parseDiscoveredFiles();
		this.mustUpdateCache = true;

		util.log( '[info] AssetDatabase: loaded without cache in ' +
			( Date.now() - timeStart ) / 1000 + 's.' );
	}

	/**
	 * Attempt to load AssetDatabase from cache. Only works if config.pathToMod has Git repository.
	 *
	 * @return {boolean} True if successfully loaded, false if AssetDatabase must be loaded from scratch.
	 */
	loadFromCache() {
		// Measure performance (for logging).
		var timeStart = Date.now();

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

		for ( var assetInfo of cachedAssets ) {
			// assetInfo became a simple Object after JSON.parse(). Must be of LoadedAsset class.
			this.knownAssets.set( assetInfo.filename, new LoadedAsset( this, assetInfo ) );
		}

		// Update the cache.
		// Note that vanilla assets are never updated (new releases of base game are exceptionally rare).
		// If vanilla got modified, user should just delete the cache file manually.
		var changedAssetsCount = modifiedFiles.length;
		for ( var filename of modifiedFiles ) {
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
				util.log( '[debug] AssetDatabase: removed deleted asset from cache: ' + filename );
			} else {
				if ( this.knownAssets.has( filename ) ) {
					// Existing asset was modified. Reload it.
					this.knownAssets.get( filename ).loadNow();
					util.log( '[debug] AssetDatabase: reloaded modified asset: ' + filename );
				} else {
					// New asset was added.
					var lazyAsset = this.addAssetByFilename( filename, config.pathToMod, false );
					if ( lazyAsset ) {
						lazyAsset.loadNow();
						util.log( '[debug] AssetDatabase: added new asset to cache: ' + filename );
					} else {
						// This file was added to Git, but is not a JSON asset (e.g. a "png" image).
						changedAssetsCount--;
					}
				}
			}
		}

		util.log( '[info] AssetDatabase: loaded from cache in ' +
			( Date.now() - timeStart ) / 1000 + 's. Modified assets reloaded: ' + changedAssetsCount + '.' );

		this.mustUpdateCache = ( changedAssetsCount > 0 );
		return true;
	}

	/**
	 * Save the current state of AssetDatabase to cache.
	 */
	updateCache() {
		// Measure performance (for logging).
		var timeStart = Date.now();

		var currentCommit = this.getCurrentCommit();
		if ( !currentCommit ) {
			util.log( '[notice] AssetDatabase: skipped updateCache(): cache is useless without Git repo in the mod directory.' );
			return;
		}

		fs.mkdirSync( util.tmpdir, { recursive: true } );
		fs.rmSync( prevCommitFilename, { force: true } );
		fs.writeFileSync( cacheFilename, JSON.stringify( Array.from( this.knownAssets.values() ) ) );
		fs.writeFileSync( prevCommitFilename, currentCommit );

		util.log( '[info] AssetDatabase: saved the updated cache to disk in ' +
			( Date.now() - timeStart ) / 1000 + 's.' );
	}

	/**
	 * Returns current Git commit in config.pathToMod. Fails if this path is not a Git repository.
	 *
	 * @return {string|false}
	 */
	getCurrentCommit() {
		var result = childProcess.spawnSync( 'git', [ 'rev-parse', 'HEAD' ], {
			cwd: config.pathToMod,
			encoding: 'utf8'
		} );
		if ( result.status !== 0 ) {
			return false;
		}

		return result.stdout.trim();
	}

	/**
	 * Determine "HEAD commit in Git at the moment when the cache of AssetDatabase was last updated".
	 *
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
	 *
	 * @param {string} prevCommit
	 * @return {string[]|false} False if failed to determine. Array of filenames if successful.
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
			console.log( '[warn] No Git repository in ' + config.pathToMod + ': AssetDatabase can\'t use the cache to load faster.' );
			return false;
		}

		return result.stdout.trim().split( '\n' );
	}

	/**
	 * Get the list of all files in Git repository. Used for to speed up discoverFilesInDirectory().
	 *
	 * @param {string} directory
	 * @return {string[]|false} False if failed to determine. Array of filenames if successful.
	 */
	listAllFilesInGit( directory ) {
		var result = childProcess.spawnSync( 'git', [ 'ls-files' ], {
			cwd: directory,
			encoding: 'utf8',
			maxBuffer: 50 * 1024 * 1024 // 50Mb. Default is 1Mb. (too low for the list of all filenames).
		} );
		if ( result.status !== 0 ) {
			return false;
		}

		return result.stdout.trim().split( '\n' );
	}

	/**
	 * Manually add 1 asset to this.knownAssets.
	 * Used in discoverFilesInDirectory (for all files) and loadFromCache (for new files added to Git).
	 *
	 * @param {string} filename Relative filename, e.g. "weather/healingstorm.weather".
	 * @param {string} directory Either config.pathToMod or config.pathToVanilla.
	 * @param {boolean} isVanilla
	 * @return {LoadedAsset}
	 */
	addAssetByFilename( filename, directory, isVanilla ) {
		// Apply include/exclude patterns to possibly skip this asset. (e.g. assets that we don't use)
		if ( !this.shouldAdd( filename ) ) {
			return;
		}

		if ( isVanilla && this.knownAssets.has( filename ) ) {
			// If both mod and vanilla have an asset with the same name,
			// that means "the mod has completely replaced this asset,
			// and the vanilla asset must be ignored".
			this.knownAssets.get( filename ).overwrittenVanilla = true;
			return;
		}

		var fileExtension = filename.split( '.' ).pop().toLowerCase(),
			type = config.extensionToAssetType[fileExtension] || 'unknown';
		if ( type === 'unknown' && !config.loadUnknownAssets ) {
			// Unknown filename extension: we don't need to load these files as JSON assets.
			return;
		}

		var assetInfo = {
			filename: filename,
			absolutePath: directory + '/' + filename,
			vanilla: isVanilla,
			type: type
		};

		if ( type === 'music' ) {
			assetInfo.notJson = true;
		}

		var lazyAsset = new LoadedAsset( this, assetInfo );
		if ( type === 'patch' ) {
			this.knownPatches.set( filename.replace( /.patch$/, '' ), lazyAsset );
		} else {
			this.knownAssets.set( filename, lazyAsset );
		}

		return lazyAsset;
	}

	/**
	 * Check "does the asset with this filename need to be loaded?".
	 *
	 * @param {string} filename
	 * @return {boolean}
	 */
	shouldAdd( filename ) {
		if ( !this.matcher ) {
			var patterns = [ '**' ];
			var opts = {
				ignore: Object.values( config.ignoreAssetPatterns ).flat(),
				nocase: true
			};

			this.matcher = picomatch( patterns, opts );
		}

		return this.matcher( filename );
	}

	/**
	 * Recursively search the directory for configuration files, add them to "knownAssets".
	 * This doesn't parse the files (calling asset.loadNow() later lazy-loads the file),
	 * because doing it here would deny us Progress Bar (we don't know the total number of files yet).
	 *
	 * @param {string} directory
	 */
	discoverFilesInDirectory( directory ) {
		var isVanilla = ( directory === config.pathToVanilla );

		// Attempt to very quickly find all files via "git ls-files".
		// If that fails (e.g. there is no Git repository), we will perform full directory scan.
		var files = this.listAllFilesInGit( directory );
		if ( !files ) {
			util.log( '[notice] AssetDatabase: no Git repository in ' + directory + ', using full directory scan (slower).' );

			var opts = {
				// All other ignores are handled in shouldAdd()
				deepFilter: ( entry ) => !entry.path.match( /\.git|node_modules/ )
			};
			files = fsWalkSync( directory, opts )
				.filter( ( entry ) => !entry.dirent.isDirectory() )
				.map( ( entry ) => entry.path.slice( directory.length + 1 ) )
				.sort();
		}

		for ( var filename of files ) {
			this.addAssetByFilename( filename, directory, isVanilla );
		}
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
			if ( ++step % 2500 === 0 ) {
				progressBar.update( step, { filename: filename } );
			}

			if ( !asset.loadNow() ) {
				// Failed to load.
				this.knownAssets.delete( filename );
			}
		}
		progressBar.update( step );
	}

	/**
	 * Iterate over the entire database, calling the callback for each asset.
	 *
	 * @param {string} assetType E.g. "monster", "item" or "biome".
	 * @param {Function} callback
	 * Callback gets the following parameters:
	 * 1) relative filename,
	 * 2) information about asset, including loaded data.
	 */
	forEach( assetType, callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		this.knownAssetsByType[assetType].forEach( ( params ) => callback.apply( null, params ) );
	}

	/**
	 * Get the parsed asset by path.
	 *
	 * @param {string} path Relative path to asset (e.g. "/interface/windowconfig/craftingmech.config").
	 * @return {LoadedAsset|undefined}
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
	 *
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

	/**
	 * Load an additional asset that wasn't loaded during AssetDatabase.load().
	 * Ignores all "should we load this file?" checks.
	 * This can be used to lazy-load some of the .frames files (which are only needed in ImageFinder)
	 * without having to load all .frames files (there are 7000+ of them) on every run of generate.js.
	 * Returns the same as get(): either LoadedAsset (if found) or undefined (if not found).
	 *
	 * @param {string} path Relative path to asset (e.g. "/interface/windowconfig/craftingmech.config").
	 * @return {LoadedAsset|undefined}
	 */
	loadExtra( path ) {
		var existingAsset = this.get( path );
		if ( existingAsset ) {
			// Already loaded.
			return existingAsset;
		}

		// Remove the leading slash, if any.
		path = path.replace( /^\//, '' );

		var isVanilla, directory, absolutePath;
		var found = false;
		for ( isVanilla of [ false, true ] ) {
			directory = isVanilla ? config.pathToVanilla : config.pathToMod;
			absolutePath = directory + '/' + path;
			if ( fs.existsSync( absolutePath ) ) {
				found = true;
				break;
			}
		}
		if ( !found ) {
			// Not found (neither in mod nor in vanilla).
			return;
		}

		var assetInfo = {
			filename: path,
			absolutePath: absolutePath,
			vanilla: isVanilla,
			type: 'extra'
		};
		var lazyAsset = new LoadedAsset( this, assetInfo );
		if ( !lazyAsset.loadNow() ) {
			// Failed to load.
			return;
		}

		this.knownAssets.set( path, lazyAsset );
		return lazyAsset;
	}
}

module.exports = new AssetDatabase();
