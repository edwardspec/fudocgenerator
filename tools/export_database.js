/**
 * Export some entities in AssetDatabase (liquids, materials, etc.)
 * as JSON string suitable for: RestoredDatabase = new Map( JSON.parse( RESULT ) )
 * ... where only several fields of entities are saved, and other fields are omitted.
 *
 * Usage:
 * node export_database.js liquid name,liquidId,itemDrop,interactions
 * node export_database.js material materialId,materialName,itemDrop,liquidInteractions
 * node export_database.js item materialId --vanilla --plain --uniq
 * node export_database.js item itemCode,shortdescription,inventoryIcon --plain
 */

'use strict';

const { argv, AssetDatabase } = require( '../lib' ),
	process = require( 'process' );

if ( argv._.length !== 2 || argv.help ) {
	const usage = 'Usage: node export_database.js AssetType Field1,Field2,Field3\n\nOptions:' +
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

let resultLines = [];

AssetDatabase.forEach( assetType, ( filename, asset ) => {
	// Export only the requested fields, nothing else.
	const entity = {};
	const plainValues = [];
	let fieldsFound = 0;

	const data = asset.data;

	for ( const field of fields ) {
		let value;
		if ( field === 'itemCode' ) {
			// Special handling: objects are considered items, so objects and non-objects can use the same ID field.
			value = data.itemName || data.objectName;
		} else {
			value = asset.data[field];
		}

		if ( value ) {
			fieldsFound++;
			entity[field] = value;
		} else {
			value = '';
		}

		plainValues.push( value );
	}

	if ( fieldsFound === 0 ) {
		// This entity doesn't have any of the requested fields.
		return;
	}

	let line;
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
