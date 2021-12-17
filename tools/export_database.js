/**
 * Export part of the database object (such as LiquidDatabase, MaterialDatabase, etc.)
 * as JSON string suitable for: RestoredDatabase = new Map( JSON.parse( RESULT ) )
 * ... where only several fields of entities are saved, and other fields are omitted.
 *
 * Usage:
 * node export_database.js LiquidDatabase knownLiquids name,liquidId,itemDrop,interactions
 * node export_database.js MaterialDatabase knownMaterials materialId,materialName,itemDrop,liquidInteractions
 */

'use strict';

const process = require( 'process' ),
	argv = process.argv;

if ( argv.length !== 5 ) {
	process.stderr.write( 'Usage: node export_database.js DatabaseName MapName Field1,Field2,Field3\n' );
	process.exit( 1 );
}

const databaseClass = argv[2],
	mapName = argv[3],
	fields = process.argv[4].split( ',' );

if ( databaseClass === 'AssetDatabase' || databaseClass === 'ItemDatabase' ) {
	process.stderr.write( 'Asset/Item databases are not supported.\n' );
	process.exit( 1 );
}

const database = require( '../lib' )[databaseClass];
if ( !database ) {
	process.stderr.write( 'Unknown database: ' + databaseClass + '\n' );
	process.exit( 1 );
}

const mapToExport = database[mapName];
if ( !mapToExport ) {
	process.stderr.write( 'Unknown map: ' + databaseClass + '.' + mapName + '\n' );
	process.exit( 1 );
}

// Explicitly load(), because we are not using forEach (it wouldn't tell us the primary field for the key).
database.load();

var serializedEntities = [];

for ( var [ key, entity ] of mapToExport ) {
	// Export only the requested fields, nothing else.
	var shortenedEntity = {};
	for ( var field of fields ) {
		shortenedEntity[field] = entity[field];
	}

	serializedEntities.push( JSON.stringify( [ key, shortenedEntity ] ) );
}

console.log( '[\n\t' + serializedEntities.sort().join( ',\n\t' ) + '\n]' );
