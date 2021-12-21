'use strict';

/**
 * Represents one {{#cargo_store:}} directive (which writes 1 row into the Cargo database).
 */
class CargoRow {
	/**
	 * @param {string} cargoTable Name of Cargo table, e.g. "recipe" or "research_node".
	 * @param {Object} fields Key-value map: { 'fieldName1': 'fieldValue', ... }
	 * @param {Object} extraOptions If extraOptions.compact is true, toWikitext() omits some newlines.
	 *
	 * WARNING: characters like "|" or "}" inside "fields" are NOT escaped by CargoRow class.
	 * If some field can have such characters, they must be escaped by the caller.
	 */
	constructor( cargoTable, fields, extraOptions = {} ) {
		this.table = cargoTable;
		this.options = extraOptions;

		// Make field values into strings (concatenate arrays, etc.), remove all empty fields.
		this.fields = new Map();
		for ( let [ fieldName, value ] of Object.entries( fields ) ) {
			if ( Array.isArray( value ) ) {
				// Our Cargo tables expect an array to be stored as a string of comma-separated values.
				value = value.join( ',' );
			}

			if ( value === '' || value === undefined || value === null ) {
				// Skip empty fields.
				continue;
			}

			if ( typeof ( value ) !== 'string' ) {
				// Cast numbers to string.
				value = String( value );
			}

			this.fields.set( fieldName, value );
		}
	}

	/**
	 * Get wikitext representation of this {{#cargo_store:}} row.
	 *
	 * @return {string}
	 */
	toWikitext() {
		var wikitext = '{{#cargo_store:_table = ' + this.table + '\n';

		for ( var [ fieldName, value ] of this.fields ) {
			wikitext += '|' + fieldName + '=' + value;
			if ( !this.options.compact ) {
				wikitext += '\n';
			}
		}

		return wikitext + '}} ';
	}
}

module.exports = CargoRow;
