/**
 * Discovers all known planet types (Garden, Forest, etc.).
 */

'use strict';

const { AssetDatabase, Planet, util } = require( '..' );

class PlanetDatabase {
	constructor() {
		this.loaded = false;

		// Array of known planet types,
		// e.g. { "garden": Planet1, "forest": Planet2, ... }
		this.knownPlanets = new Map();
	}

	/**
	 * Scan terrestrial_worlds.config and find all planets, layers, etc.
	 */
	load() {
		var planetsConf = AssetDatabase.getData( '/terrestrial_worlds.config' );
		var defaultLayers = planetsConf.planetDefaults.layers,
			requiredLayers = Object.keys( defaultLayers );

		for ( var [ planetCode, planetInfo ] of Object.entries( planetsConf.planetTypes ) ) {
			for ( var layerName of requiredLayers ) {
				// If any layers are missing, apply the defaults (e.g. "asteroids" for "space" layer).
				if ( !planetInfo.layers[layerName] ) {
					planetInfo.layers[layerName] = defaultLayers[layerName];
				}
			}

			var planet = new Planet( planetCode, planetInfo );
			if ( !planet.displayName ) {
				// Some pseudo-planet like Ruin.
				util.log( '[notice] Ignoring planet type [' + planetCode + ']: no human-readable name.' );
				continue;
			}

			this.knownPlanets.set( planetCode, planet );
		}
		util.log( '[info] PlanetDatabase: found ' + this.knownPlanets.size + ' planets.' );

		this.loaded = true;
	}

	/**
	 * Callback expected by PlanetDatabase.forEach().
	 *
	 * @callback planetCallback
	 * @param {Planet} planet
	 */

	/**
	 * Iterate over all planet types. Run the callback for each of them.
	 * Callback receives 1 parameter (Planet object).
	 *
	 * @param {planetCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var planet of this.knownPlanets.values() ) {
			callback( planet );
		}
	}
}

module.exports = new PlanetDatabase();
