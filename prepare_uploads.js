/**
 * Gather the list of "images to upload to the wiki" for use with Pywikibot's upload.py.
 *
 * @author Edward Chernenko
 *
 * Usage: node prepare_uploads.js
 */

'use strict';

const { ImageFinder, ItemDatabase, RecipeDatabase, ResearchTreeDatabase,
		WikiStatusCache, config, util } = require( './lib' ),
	fs = require( 'fs' );

/* ----------------------------------------------------------------------------------------------- */

// A symlink will be created in this directory for each image that needs to be uploaded.
// This directory can then be provided to "pwb.py upload", and it will upload everything there.
const outputPath = config.outputDir + '/pywikibot/filesToUpload';
fs.rmSync( outputPath, { recursive: true, force: true } );
fs.mkdirSync( outputPath + '/all', { recursive: true } );
fs.mkdirSync( outputPath + '/onlyNew', { recursive: true } );

/* ----------------------------------------------------------------------------------------------- */


/**
 * @param {string} targetTitle Name of File: page in the wiki, e.g. "Item_icon_ironore.png".
 * @param {string|undefined} relativePath Value of "inventoryIcon" key, or "dualImage" key, etc.
 * @param {LoadedAsset|null} relativeToAsset Asset that contains that "inventoryIcon", "dualImage", etc.
 */
function prepareUpload( targetTitle, relativePath, relativeToAsset = null ) {
	// Normalize the title (space and underscore are the same, so let's avoid spaces in filenames).
	// Also  ":" is not a valid symbol for MediaWiki images names, so replace it with "."
	// (this is necessary for pseudo-items like "prototyper:3").
	targetTitle = targetTitle.replace( ' ', '_' ).replace( ':', '.' );

	var absolutePath = ImageFinder.locateImage( relativePath, relativeToAsset );
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
