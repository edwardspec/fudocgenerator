/**
 * Discovers all known planet types (Garden, Forest, etc.).
 */

'use strict';

const { AssetDatabase, Planet, util } = require( '.' );

class PlanetDatabase {
	constructor() {
		this.loaded = false;

		// Array of known planet types,
		// e.g. { "garden": Planet1, "forest": Planet2, ... }
		this.knownPlanets = {};


		// Array of known "regions", as defined in [terrestrial_worlds.config].
		// Each region is biome + some additional options not from biome (e.g. cave liquid, ocean liquid).
		// Format: { "bogoceanfloor": { ... }, "crystalmoon": { ... }, ... }
		this.knownRegions = {};
	}

	/**
	 * Scan terrestrial_worlds.config and find all planets, layers, etc.
	 */
	load() {
		var planetsConf = AssetDatabase.getData( '/terrestrial_worlds.config' );

		for ( var [ planetCode, planetInfo ] of Object.entries( planetsConf.planetTypes ) ) {
			if ( [ 'ffunknown', 'shadow', 'superdense' ].includes( planetCode ) ) {
				// For now, we skip "randomized planets" with a large number of primary biomes.
				// Their handling will be determined later (depending on how we decide to document them).
				// There is a valid option of simply having a human-written article about Unknown, etc.,
				// which would only say that the biomes are randomized (without an actual list of them).
				continue;
			}

			var planet = new Planet( planetCode, planetInfo );
			if ( !planet.displayName ) {
				// Some pseudo-planet like Ruin.
				util.log( '[notice] Ignoring planet type [' + planetCode + ']: no human-readable name.' );
				continue;
			}

			this.knownPlanets[planetCode] = planet;
		}

		for ( var [ regionCode, regionInfo ] of Object.entries( planetsConf.regionTypes ) ) {
			this.knownRegions[regionCode] = regionInfo;
		}



		util.log( '[info] PlanetDatabase: found ' + Object.keys( this.knownPlanets ).length + ' planets, ' +
			Object.keys( this.knownRegions ).length + ' regions.' );

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
