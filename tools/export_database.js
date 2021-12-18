/**
 * Export some entities in AssetDatabase (liquids, materials, etc.)
 * as JSON string suitable for: RestoredDatabase = new Map( JSON.parse( RESULT ) )
 * ... where only several fields of entities are saved, and other fields are omitted.
 *
 * Usage:
 * node export_database.js liquid name,liquidId,itemDrop,interactions
 * node export_database.js material materialId,materialName,itemDrop,liquidInteractions
 * node export_database.js item materialId --vanilla --plain --uniq
 */

'use strict';

const { AssetDatabase } = require( '../lib' ),
	process = require( 'process' ),
	argv = require( 'minimist' )( process.argv.slice( 2 ) );

if ( argv._.length !== 2 || argv.help ) {
	var usage = 'Usage: node export_database.js DatabaseName MapName Field1,Field2,Field3\n\nOptions:' +
		'\n\t--vanilla   Load only vanilla assets (without any patches)' +
		'\n\t--plain     Print comma-separated values instead of JSON' +
		'\n\t--uniq      Suppress duplicate lines in result.' +
		'\n';

	process.stderr.write( usage );
	process.exit( 1 );
}

const [ assetType, fieldsArg ] = argv._,
	fields = fieldsArg.split( ',' );

AssetDatabase.load( { vanillaOnly: argv.vanilla } );

var resultLines = [];

AssetDatabase.forEach( assetType, ( filename, asset ) => {
	// Export only the requested fields, nothing else.
	var entity = {};
	var plainValues = [];

	for ( let field of fields ) {
		let value = asset.data[field];
		if ( !value ) {
			continue;
		}

		plainValues.push( value );
		entity[field] = value;
	}

	if ( plainValues.length === 0 ) {
		// This entity doesn't have any of the requested fields.
		return;
	}

	var line;
	if ( argv.plain ) {
		line = plainValues.join( ',' );
	} else {
		line = JSON.stringify( [ filename, entity ] );
	}

	resultLines.push( line );
} );

if ( argv.uniq ) {
	// Remove duplicates.
	resultLines = [...new Set( resultLines )];
}

resultLines = resultLines.sort();

if ( argv.plain ) {
	console.log( resultLines.join( '\n' ) );
} else {
	console.log( '[\n' + resultLines.sort().join( ',\n' ) + '\n]' );
}
