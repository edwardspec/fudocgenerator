'use strict';

const { CargoRow } = require( '..' );

/**
 * Represents one function in the FunctionsDatabase.
 */
class LinearClampFunction {
	/**
	 * @param {string} functionName
	 * @param {float[][]} values
	 */
	constructor( functionName, values ) {
		this.functionName = functionName;
		this.values = new Map( values.sort( ( v1, v2 ) => v1[0] - v2[0] ) );
	}

	/**
	 * Calculate a function like "by how much is damage of tier N weapon increased" for known N.
	 *
	 * @param {float} param
	 * @return {float}
	 */
	calculate( param ) {
		var exactMatchValue = this.values.get( param );
		if ( exactMatchValue ) {
			return exactMatchValue;
		}

		// While fractional tiers, etc. are easy to implement,
		// they are currently not used by any non-RNG items,
		// so why write the code that is not going to be used?
		throw new Error( 'calculate(): non-exact matches are not yet implemented: ' +
			this.functionName + '(' + param + ')' );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'functions-' + this.functionName;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Region into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		var rows = [];
		for ( var [ param, value ] of this.values ) {
			rows.push( new CargoRow( 'function', {
				id: this.functionName,
				param: param,
				value: value
			} ) );
		}

		return rows;
	}
}

module.exports = LinearClampFunction;
