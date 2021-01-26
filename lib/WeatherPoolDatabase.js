'use strict';

const { AssetDatabase, WeatherPool, util } = require( '.' );

/**
 * Discovers all known weather pools.
 */
class WeatherPoolDatabase {
	constructor() {
		this.loaded = false;

		// Array of known weather pools, as defined in [weather.config].
		// e.g. { poolName1: WeatherPool1, ... }
		this.knownPools = new Map();
	}

	/**
	 * Scan weather.config and find all weather pools.
	 */
	load() {
		var weatherConf = AssetDatabase.getData( '/weather.config' );

		for ( var [ poolCode, poolInfo ] of Object.entries( weatherConf ) ) {
			if ( !Array.isArray( poolInfo ) ) {
				// This is a parameter like "weatherCooldownTime" (they are in the same array as pools).
				continue;
			}

			this.knownPools.set( poolCode, new WeatherPool( poolCode, poolInfo ) );
		}

		util.log( '[info] WeatherPoolDatabase: found ' + this.knownPools.size + ' weather pools.' );
		this.loaded = true;
	}

	/**
	 * Callback expected by WeatherPoolDatabase.forEach().
	 *
	 * @callback weatherPoolCallback
	 * @param {WeatherPool} pool
	 */

	/**
	 * Iterate over all weather pools. Run the callback for each of them.
	 * Callback receives 1 parameter (WeatherPool object).
	 *
	 * @param {weatherPoolCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}


		for ( var weatherPool of this.knownPools.values() ) {
			callback( weatherPool );
		}
	}
}

module.exports = new WeatherPoolDatabase();
