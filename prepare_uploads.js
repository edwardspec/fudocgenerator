/**
 * Gather the list of "images to upload to the wiki" for use with Pywikibot's upload.py.
 *
 * @author Edward Chernenko
 *
 * Usage: node prepare_uploads.js
 */

const { ItemDatabase, RecipeDatabase, ResearchTreeDatabase,
	WikiStatusCache, config, util } = require( './lib' ),
	fs = require( 'fs' ),
	childProcess = require( 'child_process' ),
	nodePath = require( 'path' );

/*-----------------------------------------------------------------------------------------------*/

// A symlink will be created in this directory for each image that needs to be uploaded.
// This directory can then be provided to "pwb.py upload", and it will upload everything there.
const outputPath = config.outputDir + '/pywikibot/filesToUpload';
fs.rmSync( outputPath, { recursive: true, force: true } );
fs.mkdirSync( outputPath + '/all', { recursive: true } );
fs.mkdirSync( outputPath + '/onlyNew', { recursive: true } );

/*-----------------------------------------------------------------------------------------------*/

// Cache used by unpackSprite().
// Format: { "filenameOfSprite1": result1, ... }.
var unpackedSprites = {};

/**
 * Use ImageMagick (convert tool) to cut the sprite (images glued into one) into individual images.
 * @param {string} absolutePathToSprite
 * @return {Object} Format: { "codeOfFrame1": filename1, "codeOfFrame2": filename2, ... }
 */
function unpackSprite( absolutePathToSprite ) {
	if ( !unpackedSprites[absolutePathToSprite] ) {
		unpackedSprites[absolutePathToSprite] = unpackSpriteUncached( absolutePathToSprite );
	}

	return unpackedSprites[absolutePathToSprite];
}

/**
 * Uncached version of unpackSprite().
 * @param {string} absolutePathToSprite
 * @return {Object} Format: { "codeOfFrame1": filename1, "codeOfFrame2": filename2, ... }
 */
function unpackSpriteUncached( absolutePathToSprite ) {
	if ( !absolutePathToSprite[0] ) {
		throw new Error( 'unpackSprite() expects an absolute path.' );
	}

	// Load the .frames file, which contains information about size and count of individual images.
	var framesConfPath = absolutePathToSprite.replace( /\.[^.]+$/, '.frames' );
	var framesConf;
	try {
		framesConf = util.loadModFile( framesConfPath );
	} catch ( error ) {
		// This is not a sprite.
		// TODO: consider treating the entire image as 1 frame called "idle" (default frame),
		// because there are items (e.g. lunariwhip.activeitem) that use "idle" frame of non-sprite.
		// For example:
		// return { 'idle': absolutePathToSprite };

		util.log( '[warn] .frames file not loaded: ' + framesConfPath + ': ' + error.message );
		return {};
	}

	if ( !framesConf.frameGrid ) {
		// Not yet implemented. Currently we only support "frameGrid" sprites.
		// TODO: add support for "frameList" sprites.
		return {};
	}

	// Create the directory for output files.
	var cachePath = util.tmpdir + '/sprite' + absolutePathToSprite;
	fs.mkdirSync( cachePath, { recursive: true } );

	var grid = framesConf.frameGrid,
		[ width, height ] = grid.dimensions

	var result = childProcess.spawnSync(
		config.imageMagickConvertCommand,
		[
			'-crop',
			width + 'x' + height + '@',
			'+repage',
			'+adjoin',
			absolutePathToSprite, // Input filename
			cachePath + '/icon%d.png' // Output filename pattern
		],
		{ encoding: 'utf8' }
	);
	if ( result.status !== 0 ) {
		console.log( result.stderr );
		console.log( '[error] Failed to unpack the sprite: ' + absolutePathToSprite );
		return {};
	}

	var pathsToFrames = {};
	for ( var [ index, frameName ] of Object.entries( ( grid.names || [] ).flat() ) ) {
		var path = cachePath + '/icon' + index + '.png';

		// Frame can be referred to by:
		// 1) name (e.g. "openRight.2"), 2) index (e.g. 42), 3) alias (see below).
		pathsToFrames[frameName] = path;
		pathsToFrames[index] = path;
	}

	// Apply aliases, if any. For example, the following entry: { "default.off": "off" }
	// means that frame "off" (which we already found) should also be findable as "default.off".
	for ( var [ alias, origFrameName ] of Object.entries( grid.aliases || {} ) ) {
		pathsToFrames[alias] = pathsToFrames[origFrameName];
	}

	return pathsToFrames;
}

/**
 * Discover the full path (e.g. /usr/src/FrackinUniverse/items/generic/crafting/algaegreen.png)
 * of an image that is referenced in "inventoryIcon", "dualImage", etc. keys of JSON asset files.
 * @param {string|undefined} relativePath Value of "inventoryIcon" key, or "dualImage" key, etc.
 * @param {LoadedAsset|null} If not null, relativePath that doesn't start with "/" is considered
 * to be relative to this asset's directory.
 * @return {string|false} Full path to existing image (if found) or false (if not found).
 */
function locateImage( relativePath, relativeToAsset ) {
	if ( !relativePath || typeof ( relativePath ) !== 'string' ) {
		// No image or unsupported format.
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
	var pathCandidates = [
		config.pathToMod + '/' + path,
		config.pathToVanilla + '/' + path,
	];
	for ( var possiblePath of pathCandidates ) {
		if ( fs.existsSync( possiblePath ) ) {
			// Found the image!
			if ( frame ) {
				possiblePath = unpackSprite( possiblePath )[frame] || false;
			}

			return possiblePath;
		}
	}

	// Not found (in neither vanilla nor mod).
	util.log( '[warning] Asset ' + ( relativeToAsset ? relativeToAsset.filename + ' ' : '' )  +
		'refers to nonexistent image: ' + path );
	return false;
}

/**
 * @param {string} targetTitle Name of File: page in the wiki, e.g. "Item_icon_ironore.png".
 * @param {string|undefined} relativePath Value of "inventoryIcon" key, or "dualImage" key, etc.
 * @param {LoadedAsset|null} Asset that contains that "inventoryIcon", "dualImage", etc.
 */
function prepareUpload( targetTitle, relativePath, relativeToAsset = null ) {
	// Normalize the title (space and underscore are the same, so let's avoid spaces in filenames).
	// Also  ":" is not a valid symbol for MediaWiki images names, so replace it with "."
	// (this is necessary for pseudo-items like "prototyper:3").
	targetTitle = targetTitle.replace( ' ', '_' ).replace( ':', '.' );

	var absolutePath = locateImage( relativePath, relativeToAsset );
	if ( absolutePath ) {
		fs.symlinkSync( absolutePath, outputPath + '/all/' + targetTitle );
		if ( !WikiStatusCache.pageExists( 'File:' + targetTitle ) ) {
			fs.symlinkSync( absolutePath, outputPath + '/onlyNew/' + targetTitle );
		}
	}
}

// Iterate over every item that has at least 1 Recipe.
for ( var itemCode of RecipeDatabase.listMentionedItemCodes() ) {
	var item = ItemDatabase.find( itemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		util.warnAboutUnknownItem( itemCode );
		continue;
	}

	// Add discovered icon of this item (small PNG image) into "upload these icons" list.
	prepareUpload( 'Item_icon_' + itemCode + '.png', item.inventoryIcon, item.asset );
}

// Upload icons of research nodes.
ResearchTreeDatabase.forEach( ( node ) => {
	prepareUpload( 'Node_icon_' + node.id + '.png', node.icon );
} );
