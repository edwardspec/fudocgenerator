'use strict';

const { AssetDatabase, util } = require( '.' );

/**
 * Runs some calculations from *.function assets, e.g. weaponDamageLevelMultiplier(tier).
 * WARNING: we have very limited support for it and only implement things that we actually use.
 */
class FunctionsDatabase {
	constructor() {
		this.loaded = false;

		// Array of known functions,
		// e.g. { "weaponDamageLevelMultiplier": MapObject1, ... }
		this.knownFunctions = {};
	}

	/**
	 * Scan the AssetDatabase and find all functions that we know how to interpret.
	 */
	load() {
		AssetDatabase.forEach( 'functions', ( filename, asset ) => {
			for ( var [ functionName, formula ] of Object.entries( asset.data ) ) {
				var [ algorithm, funcType, ...values ] = formula;
				if ( algorithm === 'linear' && funcType === 'clamp' ) {
					this.loadLinearClamp( functionName, values );
				} else {
					// Types other than linear/clamp are not supported.
					// (the only other type is linear/warp, and we don't need those functions yet).
					continue;
				}
			}
		} );

		util.log( '[info] FunctionsDatabase: found ' + Object.keys( this.knownFunctions ).length + ' functions.' );
		this.loaded = true;
	}

	/**
	 * Load one 'linear/clamp' function.
	 * Majority of functions (and all functions that we are currently using) are of this type.
	 *
	 * @param {string} functionName
	 * @param {float[][]} values
	 */
	loadLinearClamp( functionName, values ) {
		values = values.sort( ( v1, v2 ) => v1[0] - v2[0] );
		this.knownFunctions[functionName] = new Map( values );
	}

	/**
	 * Calculate a function like "by how much is damage of tier N weapon increased" for known N.
	 *
	 * @param {string} functionName
	 * @param {float} param
	 * @return {float}
	 */
	calculate( functionName, param ) {
		if ( !this.loaded ) {
			this.load();
		}

		var map = this.knownFunctions[functionName];
		if ( !map ) {
			throw new Error( 'FunctionDatabase: trying to calculate() unknown function: ' + functionName );
		}

		var exactMatchValue = map.get( param );
		if ( exactMatchValue ) {
			return exactMatchValue;
		}

		// While fractional tiers, etc. are easy to implement,
		// they are currently not used by any non-RNG items,
		// so why write the code that is not going to be used?
		throw new Error( 'calculate(): non-exact matches are not yet implemented: ' +
			functionName + '(' + param + ')' );
	}
}

module.exports = new FunctionsDatabase();
