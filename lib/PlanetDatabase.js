/**
 * Discovers all known planets.
 */

'use strict';

const { AssetDatabase, Planet, util } = require( '.' );

class PlanetDatabase {
	constructor() {
		this.loaded = false;

		// Array of known planet types,
		// e.g. { "garden": Planet1, "forest": Planet2, ... }
		this.knownPlanets = {};
	}

	/**
	 * Scan terrestrial_worlds.config and find all planets, layers, etc.
	 */
	load() {
		var planetTypes = AssetDatabase.getData( '/terrestrial_worlds.config' ).planetTypes;
		for ( var [ planetCode, info ] of Object.entries( planetTypes ) ) {
			var planet = new Planet( planetCode, info );
			if ( !planet.displayName ) {
				// Some pseudo-planet like Ruin.
				util.log( '[notice] Ignoring planet type [' + planetCode + ']: no human-readable name.' );
				continue;
			}

			this.knownPlanets[planetCode] = planet;
		}

		util.log( '[info] PlanetDatabase: found ' + Object.keys( this.knownPlanets ).length + ' planets.' );

		this.loaded = true;
	}

	/**
	 * Iterate over all planet types. Run the callback for each of them.
	 * Callback receives 1 parameter (Planet object).
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		Object.values( this.knownPlanets ).forEach( callback );
	}
}

module.exports = new PlanetDatabase();
