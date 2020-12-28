'use strict';

const { AssetDatabase, config, util } = require( '.' ),
	fs = require( 'fs' ),
	childProcess = require( 'child_process' ),
	nodePath = require( 'path' );

/**
 * Methods to locate images (like inventory icons) that are mentioned in JSON assets,
 * extracting them from sprites if necessary.
 */
class ImageFinder {
	constructor() {
		// Cache used by unpackSprite().
		// Format: { "filenameOfSprite1": result1, ... }.
		this.unpackedSprites = new Map();
	}

	/**
	 * Use ImageMagick (convert tool) to cut the sprite (images glued into one) into individual images.
	 *
	 * @param {string} absolutePathToSprite
	 * @return {Object} Format: { "codeOfFrame1": filename1, "codeOfFrame2": filename2, ... }
	 */
	unpackSprite( absolutePathToSprite ) {
		var result = this.unpackedSprites.get( absolutePathToSprite );
		if ( !result ) {
			result = this.unpackSpriteUncached( absolutePathToSprite );
			this.unpackedSprites.set( absolutePathToSprite, result );
		}

		return result;
	}

	/**
	 * Uncached version of unpackSprite().
	 *
	 * @param {string} absolutePathToSprite
	 * @return {Object} Format: { "codeOfFrame1": filename1, "codeOfFrame2": filename2, ... }
	 */
	unpackSpriteUncached( absolutePathToSprite ) {
		if ( !absolutePathToSprite[0] ) {
			throw new Error( 'unpackSprite() expects an absolute path.' );
		}

		// Load the .frames file, which contains information about size and count of individual images.
		var framesConf = this.loadFramesConf( absolutePathToSprite );
		if ( !framesConf ) {
			util.log( '[error] Missing .frames file for ' + absolutePathToSprite );
			return {};
		}

		// Create the directory for output files.
		var cachePath = util.tmpdir + '/sprite' + absolutePathToSprite,
			canUseCache = false;

		if ( fs.existsSync( cachePath ) ) {
			// If the cache directory was modified after the sprite, then we don't need to run "convert" again.
			if ( fs.statSync( cachePath ).mtimeMs > fs.statSync( absolutePathToSprite ).mtimeMs ) {
				canUseCache = true;
			}
		} else {
			fs.mkdirSync( cachePath, { recursive: true } );
		}

		var grid = framesConf.frameGrid,
			list = framesConf.frameList,
			pathsToFrames = {},
			convertArguments = [];

		if ( grid ) {
			var [ width, height ] = grid.size;
			convertArguments = [
				'-crop',
				width + 'x' + height,
				'+repage',
				'+adjoin',
				absolutePathToSprite, // Input filename
				cachePath + '/icon%d.png' // Output filename pattern
			];

			for ( var [ index, frameName ] of Object.entries( ( grid.names || [] ).flat() ) ) {
				var path = cachePath + '/icon' + index + '.png';

				// Frame can be referred to by:
				// 1) name (e.g. "openRight.2"), 2) index (e.g. 42), 3) alias (see below).
				pathsToFrames[frameName] = path;
				pathsToFrames[index] = path;
			}
		} else if ( list ) {
			convertArguments = [
				absolutePathToSprite, // Input filename
				'-write'
			];
			var entries = Object.entries( list );
			for ( var index = 1; index <= entries.length; index++ ) {
				var [ frameName, geometry ] = entries[index - 1];
				var [ x1, y1, x2, y2 ] = geometry.map( ( val ) => parseInt( val ) ),
					width = x2 - x1,
					height = y2 - y1,
					path = cachePath + '/icon' + index + '.png'; // Output filename

				convertArguments = convertArguments.concat( [
					'mpr:orig',
					'-crop',
					width + 'x' + height + '+' + x1 + '+' + y1
				] );
				if ( index !== entries.length ) {
					convertArguments.push( '-write' );
				}
				convertArguments.push( path );
				if ( index !== entries.length ) {
					convertArguments.push( '+delete' );
				}

				pathsToFrames[frameName] = path;
				pathsToFrames[index] = path;
			}
		} else {
			util.log( '[warning] Invalid .frames file: contains neither frameGrid not frameList.' );
			return {};
		}

		if ( !canUseCache && !this.runConvert( convertArguments ) ) {
			// Third-party conversion tool has reported failure.
			return {};
		}

		// Apply aliases, if any. For example, the following entry: { "default.off": "off" }
		// means that frame "off" (which we already found) should also be findable as "default.off".
		for ( var [ alias, origFrameName ] of Object.entries( framesConf.aliases || {} ) ) {
			pathsToFrames[alias] = pathsToFrames[origFrameName];
		}

		return pathsToFrames;
	}

	/**
	 * Run "convert" (utility from ImageMagick) with some arguments.
	 *
	 * @param {string[]} commandLineArguments
	 * @return {boolean} True if successful, false otherwise.
	 */
	runConvert( commandLineArguments ) {
		var result = childProcess.spawnSync(
			config.imageMagickConvertCommand,
			commandLineArguments,
			{ encoding: 'utf8' }
		);
		if ( result.status !== 0 ) {
			console.log( '[error] Failed to run ImageMagick convert (' +
				commandLineArguments.join( ' ' ) + ')' );
			return false;
		}

		// Successful.
		return true;
	}

	/**
	 * Get contents of .frames file (which describes how to cut a sprite image) or false if not found.
	 *
	 * @param {string} absolutePathToSprite
	 * @return {Object|false}
	 */
	loadFramesConf( absolutePathToSprite ) {
		// TODO: refactor this (we know the relative path in one of the callers, shouldn't recalculate it).
		var relativePath = absolutePathToSprite
			.replace( config.pathToVanilla, '' )
			.replace( config.pathToMod, '' )
			.replace( /^\//, '' );

		var relativeDir = nodePath.dirname( relativePath ),
			basename = nodePath.basename( relativePath ).replace( /\.[^.]+$/, '.frames' );

		// If image is called "something.png", then its .frames file should be called "something.frames".
		// Fallback (if not found): file called "default.frames" in the same directory as the image.
		// If not found in current directory, keep looking in parent directories (often used for armors,
		// which have only one "chest.frames" in parent directory instead of many "chest.frames" files).
		var filenameCandidates = [];
		var stepsUp = relativeDir.split( '/' ).length,
			parentDir = '';
		for ( var i = 0; i < stepsUp; i++ ) {
			parentDir = '../' + parentDir;
			filenameCandidates.push( parentDir + basename );
			filenameCandidates.push( parentDir + 'default.frames' );
		}

		// Choose the first file that exists.
		for ( var possibleFilename of filenameCandidates ) {
			var asset = AssetDatabase.loadExtra( nodePath.join( relativePath, possibleFilename ) );
			if ( asset ) {
				// Found the .frames asset!
				return asset.data;
			}
		}

		return false;
	}

	/**
	 * Discover the full path (e.g. /usr/src/FrackinUniverse/items/generic/crafting/algaegreen.png)
	 * of an image that is referenced in "inventoryIcon", "dualImage", etc. keys of JSON asset files.
	 *
	 * @param {string|Object[]} relativePath Value of "inventoryIcon" key, or "dualImage" key, etc.
	 * @param {LoadedAsset|null} relativeToAsset If not null, relativePath that doesn't start with "/"
	 * is considered to be relative to this asset's directory.
	 * @return {string|false} Full path to existing image (if found) or false (if not found).
	 */
	locateImage( relativePath, relativeToAsset ) {
		if ( Array.isArray( relativePath ) ) {
			// E.g. [ { image: 'gluesprayer.png' } ]
			relativePath = relativePath[0].image;
		}
		if ( typeof ( relativePath ) !== 'string' ) {
			// Unsupported format.
			return false;
		}

		var [ path, frame ] = relativePath.split( ':' );
		if ( path[0] !== '/' ) {
			// This path is relative to the asset (e.g. "object" file that has "inventoryIcon" key),
			// not to the topmost directory of vanilla/mod.
			if ( !relativeToAsset ) {
				// Asset not specified, so we can't resolve the relative path.
				return false;
			}

			path = nodePath.dirname( relativeToAsset.filename ) + '/' + path;
		}

		// We look for this image in both mod and vanilla. Image from the mod always has priority.
		var possiblePath = util.findInModOrVanilla( path );
		if ( !possiblePath ) {
			// Not found (neither in vanilla nor in the mod).
			util.log( '[warning] Asset ' + ( relativeToAsset ? relativeToAsset.filename + ' ' : '' ) +
				'refers to nonexistent image: ' + path );
			return false;
		}

		// Found the image!
		if ( frame ) {
			possiblePath = this.unpackSprite( possiblePath )[frame] || false;
		}

		return possiblePath;
	}
}

module.exports = new ImageFinder();
