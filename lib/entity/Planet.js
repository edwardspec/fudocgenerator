'use strict';

const { Query } = require( '..' );

/**
 * Represents one planet type in the PlanetDatabase.
 */
class Planet {
	/**
	 * @param {string} code Machine-readable ID of this planet type, e.g. "garden".
	 * @param {object} rawData Structure from terrestial_worlds.config that describes this planet.
	 */
	constructor( code, rawData ) {
		Object.assign( this, rawData );

		this.id = code;
		this.displayName = Query.getPlanetName( code );
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Planet into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var wikitext = '{{#cargo_store:_table = planet\n';

		wikitext += '|id=' + this.id + '\n';
		wikitext += '|name=' + this.displayName + '\n';
		wikitext += '|minTier=' + this.threatRange[0] + '\n';
		wikitext += '|maxTier=' + this.threatRange[1] + '\n';

		if ( this.gravityRange ) {
			// These fields are optional, because only some of the planet types are restricted in which gravity
			// they can have. Other planets determine their gravity from the size of the individual planet.
			wikitext += '|minGravity=' + this.gravityRange[0] + '\n';
			wikitext += '|maxGravity=' + this.gravityRange[1] + '\n';
		}

		// TODO: to calculate best/worst dayLightColor, we will need to iterate over possible surface biomes.
		//wikitext += '|minDayLight=' + TODO + '\n';
		//wikitext += '|maxDayLight=' + TODO + '\n';

		wikitext += '}} ';

		return wikitext;
	}
}

module.exports = Planet;
