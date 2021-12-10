'use strict';

const { AssetDatabase, LinearClampFunction, util } = require( '.' );

/**
 * Runs some calculations from *.function assets, e.g. weaponDamageLevelMultiplier(tier).
 * WARNING: we have very limited support for it and only implement things that we actually use.
 */
class FunctionDatabase {
	constructor() {
		this.loaded = false;

		// Array of known functions,
		// e.g. { "weaponDamageLevelMultiplier": LinearClampFunction1, ... }
		this.knownFunctions = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all functions that we know how to interpret.
	 */
	load() {
		AssetDatabase.forEach( 'functions', ( filename, asset ) => {
			for ( var [ functionName, formula ] of Object.entries( asset.data ) ) {
				var [ algorithm, funcType, ...values ] = formula;
				if ( algorithm === 'linear' && funcType === 'clamp' ) {
					var func = new LinearClampFunction( functionName, values );
					this.knownFunctions.set( functionName, func );
				}

				// Types other than linear/clamp are not supported.
				// (the only other type is linear/warp, and we don't need those functions yet).
			}
		} );

		util.log( '[info] FunctionDatabase: found ' + this.knownFunctions.size + ' functions.' );
		this.loaded = true;
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

		var func = this.knownFunctions.get( functionName );
		if ( !func ) {
			throw new Error( 'FunctionDatabase: trying to calculate() unknown function: ' + functionName );
		}

		return func.calculate( param );
	}

	/**
	 * Callback expected by FunctionDatabase.forEach().
	 *
	 * @callback functionCallback
	 * @param {LinearClampFunction} func
	 */

	/**
	 * Iterate over all tenant types. Run the callback for each of them.
	 * Callback receives 1 parameter (LinearClampFunction object).
	 *
	 * @param {functionCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var func of this.knownFunctions.values() ) {
			callback( func );
		}
	}
}

module.exports = new FunctionDatabase();
