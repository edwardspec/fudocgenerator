'use strict';

const fs = require( 'fs' );

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
		// Not yet implemented.
		var serialized = '';
		fs.writeFileSync( filename, serialized );
	}

	/**
	 * Load this DiffableResult from the file that was previously created by saveToFile().
	 *
	 * @param {string} filename
	 */
	loadFromFile( filename ) {
		var serialized = fs.readFileSync( filename ).toString();
		// Not yet implemented.
	}

	/**
	 * Get human-readable list of differences between this DiffableResult and another DiffableResult.
	 *
	 * @param {DiffableResult} anotherResult
	 * @return {string}
	 */
	diff( anotherResult ) {
		// Not yet implemented.
		return '';
	}
}

module.exports = DiffableResult;
