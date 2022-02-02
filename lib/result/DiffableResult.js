'use strict';

const { Recipe, util } = require( '..' ),
	fs = require( 'fs' ),
	v8 = require( 'v8' ),
	nodeDiff = require( 'diff' );

/**
 * If value of the database field is a multiline text, and the quoted "before/after" values of this
 * field have more lines than this number,
 * then diff() will only print the lines that are different, not the entire value.
 */
const MAX_LINES_WITHOUT_TRUNCATING_VALUE = 4;

/**
 * List of all results produced by generate.js (Cargo rows, precreated articles, etc.) in format
 * that allows to easily compare them with the results of previous runs.
 */
class DiffableResult {
	constructor() {
		// { table1: { rowIdentifier1: { fieldName1: fieldValue1, ... }, ... }, ... }
		this.tables = new Map();

		// Table to keep track of how many rows share each non-unique rowIdentifier.
		// Ideally all identifiers should be unique, but it's not always possible
		// for BiomeContents recipes, etc.
		// Format: { rowIdentifier1: { count: 2 }, rowIdentifier2: { count: 5 }, ... }
		this.collisionsCounter = new Map();
	}

	/**
	 * Add row of Cargo database into this DiffableResult.
	 *
	 * @param {CargoRow} cargoRow
	 * @param {string} rowIdentifier Arbitrary string that is unique to this row, except when several
	 * rows have "prop" field with different value, in which case they can share same rowIdentifier.
	 * @param {Object} entity Original entity (such as Item or Recipe object).
	 */
	addRow( cargoRow, rowIdentifier, entity ) {
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

		var rows = this.tables.get( table );
		if ( !rows ) {
			rows = new Map();
			this.tables.set( table, rows );
		}

		let hasCollision = rows.has( rowIdentifier );
		if ( hasCollision && table === 'recipe' ) {
			// BiomeContents don't have a way to generate a unique ID,
			// so we resolve these collisions by appending consecutive numbers (starting with 2) to their ID.
			if ( entity.type !== Recipe.Type.BiomeContents ) {
				util.log( '[error] DiffableResult: unexpected ID collision in non-BiomeContents recipe: ' +
					'first recipe: ' + JSON.stringify( [...rows.get( rowIdentifier )] ) +
					'; second recipe: ' + JSON.stringify( [...fields] ) );
			}

			let counter = this.collisionsCounter.get( rowIdentifier );
			if ( !counter ) {
				counter = { count: 1 };
				this.collisionsCounter.set( rowIdentifier, counter );
			}
			rowIdentifier += '::' + ( ++counter.count );

			// Double-check if we successfully resolved the collision.
			hasCollision = rows.has( rowIdentifier );
		}

		if ( hasCollision ) {
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

		for ( const key of [...combinedKeys].sort() ) {
			let oldValue = oldData.get( key ),
				newValue = newData.get( key );

			if ( oldValue === newValue ) {
				continue;
			}

			let whatChanged = '';
			if ( oldValue ) {
				whatChanged += '- ' + key + ' = ' + oldValue + '\n';
			}
			if ( newValue ) {
				whatChanged += '+ ' + key + ' = ' + newValue + '\n';
			}

			if ( whatChanged.split( '\n' ).length - 1 > MAX_LINES_WITHOUT_TRUNCATING_VALUE ) {
				// Too many lines in the value (e.g. codex text),
				// we should diff individual lines instead of printing the entire multi-line values.
				whatChanged = key + ' ~ modified:\n\t' + nodeDiff.structuredPatch(
					'', '', oldValue || '', newValue || '', '', ''
				).hunks.map( ( hunk ) => {
					return hunk.lines.filter( ( line ) => line[0] === '+' || line[0] === '-' );
				} ).flat().join( '\n\t' ) + '\n';
			}

			diffText += whatChanged;
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
