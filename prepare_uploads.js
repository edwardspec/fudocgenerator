/**
 * Gather the list of "images to upload to the wiki" for use with Pywikibot's upload.py.
 *
 * @author Edward Chernenko
 *
 * Usage: node prepare_uploads.js
 */

const { ItemDatabase, RecipeDatabase, ResultsWriter, config, util } = require( './lib' ),
	fs = require( 'fs' ),
	nodePath = require( 'path' );

/*-------------------------------------------------------------------------------------------- */

/**
 * Discover the full path (e.g. /usr/src/FrackinUniverse/items/generic/crafting/algaegreen.png)
 * of an image that is referenced in "inventoryIcon", "dualImage", etc. keys of JSON asset files.
 * @param {string} relativePath Value of "inventoryIcon" key, or "dualImage" key, etc.
 * @param {LoadedAsset|null} If not null, relativePath that doesn't start with "/" is considered
 * to be relative to this asset's directory.
 * @return {string|false} Full path to existing image (if found) or false (if not found).
 */
function locateImage( relativePath, relativeToAsset = null ) {
	if ( !relativePath || typeof ( relativePath ) !== 'string' ) {
		// No image or unsupported format.
		return false;
	}

	var [ path, frame ] = relativePath.split( ':' );
	if ( frame ) {
		// We don't support frames yet ("something.png:4").
		// TODO: use ImageMagick (convert tool) to unpack sprites and extract ":4" subimage from them.
		return false;
	}

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
			return possiblePath;
		}
	}

	// Not found (in neither vanilla nor mod).
	util.log( '[warning] Asset ' + ( relativeToAsset ? relativeToAsset.filename + ' ' : '' )  +
		'refers to nonexistent image: ' + path );
	return false;
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
	var pathToIcon = locateImage( item.inventoryIcon, item.asset );
	if ( pathToIcon ) {
		ResultsWriter.writeToUploadThisList( itemCode, pathToIcon );
	}
}

ResultsWriter.finalize();
