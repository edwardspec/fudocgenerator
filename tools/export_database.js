/**
 * Export some entities in AssetDatabase (liquids, materials, etc.)
 * as JSON string suitable for: RestoredDatabase = new Map( JSON.parse( RESULT ) )
 * ... where only several fields of entities are saved, and other fields are omitted.
 *
 * Usage:
 * node export_database.js liquid name,liquidId,itemDrop,interactions
 * node export_database.js material materialId,materialName,itemDrop,liquidInteractions
 */

'use strict';

const { AssetDatabase } = require( '../lib' ),
	process = require( 'process' ),
	argv = require( 'minimist' )( process.argv.slice( 2 ) );

if ( argv._.length !== 2 ) {
	var usage = 'Usage: node export_database.js DatabaseName MapName Field1,Field2,Field3\n\n' +
		'Options:\n\t--vanilla\t\tLoad only vanilla assets (without any patches)\n';

	process.stderr.write( usage );
	process.exit( 1 );
}

const [ assetType, fieldsArg ] = argv._,
	fields = fieldsArg.split( ',' );

AssetDatabase.load( { vanillaOnly: argv.vanilla } );

var serializedEntities = [];

AssetDatabase.forEach( assetType, ( filename, asset ) => {
	// Export only the requested fields, nothing else.
	var entity = {};
	for ( var field of fields ) {
		entity[field] = asset.data[field];
	}

	serializedEntities.push( JSON.stringify( [ filename, entity ] ) );
} );

console.log( '[\n' + serializedEntities.sort().join( ',\n' ) + '\n]' );
