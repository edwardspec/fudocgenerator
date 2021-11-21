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
		values = values.sort( ( v1, v2 ) => v1[0] - v2[0] );

		var levels = values.map( ( pair, index ) => {
			var [ param, value ] = pair,
				derivative = 0;

			var nextPair = values[index + 1];
			if ( nextPair ) {
				var [ nextParam, nextValue ] = nextPair;
				var dx = nextParam - param;
				if ( dx !== 0 ) {
					derivative = ( nextValue - value ) / dx;
				}
			}

			return [ param, {
				value: value,
				derivative: derivative
			} ];
		} );

		this.functionName = functionName;
		this.values = new Map( levels );
	}

	/**
	 * Calculate a function like "by how much is damage of tier N weapon increased" for known N.
	 *
	 * @param {float} param
	 * @return {float}
	 */
	calculate( param ) {
		var exactMatch = this.values.get( param );
		if ( exactMatch ) {
			return exactMatch.value;
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
		for ( var [ param, levelInfo ] of this.values ) {
			rows.push( new CargoRow( 'function', {
				id: this.functionName,
				param: param,
				value: levelInfo.value,
				derivative: levelInfo.derivative
			} ) );
		}

		return rows;
	}
}

module.exports = LinearClampFunction;
