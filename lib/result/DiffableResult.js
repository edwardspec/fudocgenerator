'use strict';

const { util } = require( '..' ),
	fs = require( 'fs' ),
	v8 = require( 'v8' );

/**
 * List of all results produced by generate.js (Cargo rows, precreated articles, etc.) in format
 * that allows to easily compare them with the results of previous runs.
 */
class DiffableResult {
	constructor() {
		// { table1: { rowIdentifier1: { fieldName1: fieldValue1, ... }, ... }, ... }
		this.tables = new Map();
	}

	/**
	 * Add row of Cargo database into this DiffableResult.
	 *
	 * @param {CargoRow} cargoRow
	 * @param {string} rowIdentifier Arbitrary string that is unique to this row, except when several
	 * rows have "prop" field with different value, in which case they can share same rowIdentifier.
	 */
	addRow( cargoRow, rowIdentifier ) {
		const { table, fields } = cargoRow;

		var extraIdentifier;
		switch ( table ) {
			case 'function':
				extraIdentifier = fields.get( 'param' );
				break;
			case 'item_metadata':
				extraIdentifier = fields.get( 'prop' );
				break;
			case 'layer':
				extraIdentifier = fields.get( 'layer' );
				break;
			case 'region':
				extraIdentifier = fields.get( 'id' );
				break;
			case 'research_node':
				extraIdentifier = fields.get( 'tree' );
		}
		if ( extraIdentifier ) {
			rowIdentifier += '::' + extraIdentifier;
		}

		if ( table === 'recipe' ) {
			// FIXME: normal Recipe.partitionKey() is very much non-unique,
			// this needs to be resolved somehow, e.g. by using filename of .recipe file.
			// Even if we do:
			// rowIdentifier = cargoRow.toWikitext();
			// ... it would still fail on some in-game duplicate recipes, e.g. for vanilla Flare.
			return;
		}

		var rows = this.tables.get( table );
		if ( !rows ) {
			rows = new Map();
			this.tables.set( table, rows );
		}

		if ( rows.has( rowIdentifier ) ) {
			throw new Error( 'DiffableResult: row identifier is not unique: ' +
				table + ': ' + rowIdentifier + '\n' + JSON.stringify( fields, null, '\t' ) );
		}

		rows.set( rowIdentifier, fields );
	}

	/**
	 * Save this DiffableResult into file.
	 *
	 * @param {string} filename
	 */
	saveToFile( filename ) {
		var startTime = Date.now();

		fs.writeFileSync( filename, v8.serialize( this.tables ) );

		util.log( '[debug] DiffableResult: saved in ' + ( Date.now() - startTime ) / 1000 + ' seconds.' );
	}

	/**
	 * Load this DiffableResult from the file that was previously created by saveToFile().
	 *
	 * @param {string} filename
	 */
	loadFromFile( filename ) {
		var startTime = Date.now();

		this.tables = v8.deserialize( fs.readFileSync( filename ) );

		util.log( '[debug] DiffableResult: loaded in ' + ( Date.now() - startTime ) / 1000 + ' seconds.' );
	}

	/**
	 * Get human-readable list of differences between this DiffableResult and another DiffableResult.
	 *
	 * @param {DiffableResult} anotherResult
	 * @return {string}
	 */
	diff( anotherResult ) {
		var newData = this.toFlatMap(),
			oldData = anotherResult.toFlatMap(),
			diffText = '';

		var combinedKeys = new Set( [...newData.keys()].concat( [...oldData.keys()] ) );

		for ( var key of [...combinedKeys].sort() ) {
			var oldValue = oldData.get( key ),
				newValue = newData.get( key );

			if ( oldValue === newValue ) {
				continue;
			}

			var operation = newValue ? ( oldValue ? 'modify' : 'add' ) : 'delete';

			diffText += operation + '\t' + key + '\t' + ( oldValue || '(empty)' ) + '\t' + ( newValue || '(empty)' ) + '\n';
		}

		return diffText;
	}

	/**
	 * Internal: serialize this.table into easily comparable { string => string } Map.
	 *
	 * @return {Map}
	 */
	toFlatMap() {
		var flatMap = new Map();

		for ( var [ tableName, rows ] of this.tables ) {
			for ( var [ rowIdentifier, row ] of rows ) {
				for ( var [ fieldName, value ] of row ) {
					var key = tableName + '::' + rowIdentifier + '::' + fieldName;
					flatMap.set( key, value );
				}
			}
		}

		return flatMap;
	}
}

module.exports = DiffableResult;
