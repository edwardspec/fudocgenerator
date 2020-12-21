'use strict';

/**
 * Represents one {{#cargo_store:}} directive (which writes 1 row into the Cargo database).
 */
class CargoRow {
	/**
	 * @param {string} cargoTable Name of Cargo table, e.g. "recipe" or "research_node".
	 * @param {Array} fields Key-value map: { 'fieldName1': 'fieldValue', ... }
	 * @param {Array} extraOptions If extraOptions.compact is true, toWikitext() omits some newlines.
	 *
	 * WARNING: characters like "|" or "}" inside "fields" are NOT escaped by CargoRow class.
	 * If some field can have such characters, they must be escaped by the caller.
	 */
	constructor( cargoTable, fields, extraOptions = {} ) {
		this.table = cargoTable;
		this.fields = fields;
		this.options = extraOptions;
	}

	/**
	 * Get wikitext representation of this {{#cargo_store:}} row.
	 *
	 * @return {string}
	 */
	toWikitext() {
		var wikitext = '{{#cargo_store:_table = ' + this.table + '\n';

		for ( var [ fieldName, value ] of Object.entries( this.fields ) ) {
			if ( Array.isArray( value ) ) {
				// Our Cargo tables expect an array to be stored as a string of comma-separated values.
				value = value.join( ',' );
			}

			if ( value === '' || value === undefined || value === null ) {
				// Skip empty fields.
				continue;
			}

			wikitext += '|' + fieldName + '=' + value + ( this.options.compact ? '' : '\n' );
		}

		return wikitext + '}} ';
	}
}

module.exports = CargoRow;
