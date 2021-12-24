/**
 * Make a cache of { itemCode: { shortdescription: "string", icon: "string" } } for all items
 * for the purpose of using it from Lua.
 *
 * Usage:
 * node make_items_cache.js
 * node make_items_cache.js --vanilla
 */

'use strict';

const { argv, AssetDatabase } = require( '../lib' ),
	process = require( 'process' ),
	nodePath = require( 'path' );

if ( argv.help ) {
	const usage = 'Usage: node make_items_cache.js\n\nOptions:' +
		'\n\t--vanilla   Load only vanilla assets (without any patches)' +
		'\n';

	process.stderr.write( usage );
	process.exit( 1 );
}

AssetDatabase.load( { vanillaOnly: argv.vanilla } );

const result = {};

AssetDatabase.forEach( 'item', ( filename, asset ) => {
	const data = asset.data,
		itemCode = data.itemName || data.objectName;

	if ( !itemCode ) {
		return;
	}

	let icon = data.inventoryIcon;
	if ( Array.isArray( icon ) ) {
		icon = icon[0].image;
	}

	if ( icon && icon[0] !== '/' ) {
		icon = nodePath.dirname( filename ) + '/' + icon;
	}

	result[itemCode] = {
		name: data.shortdescription,
		icon: icon
	};
} );

console.log( JSON.stringify( result, null, '\t' ) );
