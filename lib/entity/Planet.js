'use strict';

const { CargoRow, Query } = require( '..' );

/**
 * Represents one planet type in the PlanetDatabase.
 */
class Planet {
	/**
	 * @param {string} code Machine-readable ID of this planet type, e.g. "garden".
	 * @param {Object} rawData Structure from terrestial_worlds.config that describes this planet.
	 */
	constructor( code, rawData ) {
		Object.assign( this, rawData );

		this.planetCode = code;
		this.displayName = Query.getPlanetName( code );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'planet-' + this.planetCode;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Planet into the Cargo database.
	 *
	 * @return {string}
	 */
	toCargoDatabase() {
		var fields = {
			id: this.planetCode,
			name: this.displayName,
			minTier: this.threatRange[0],
			maxTier: this.threatRange[1],

			// TODO: to calculate best/worst dayLightColor, we will need to iterate over possible surface biomes.
			minDayLight: undefined,
			maxDayLight: undefined
		};
		if ( this.gravityRange ) {
			// These fields are optional, because only some of the planet types are restricted in which gravity
			// they can have. Other planets determine their gravity from the size of the individual planet.
			[ fields.minGravity, fields.maxGravity ] = this.gravityRange;
		}

		var rows = [];
		rows.push( new CargoRow( 'planet', fields ) );

		// Also include all layers.
		for ( var [ layerName, layerInfo ] of Object.entries( this.layers ) ) {
			var fieldsForLayer = {
				planet: this.planetCode,
				layer: layerName,
				primaryRegion: layerInfo.primaryRegion,
				secondaryRegions: layerInfo.secondaryRegions
			};
			if ( layerInfo.dungeons ) {
				fieldsForLayer.dungeons = layerInfo.dungeons.map( ( weightAndId ) => weightAndId[1] );
				fieldsForLayer.dungeonNames = fieldsForLayer.dungeons.map( ( dungeonId ) => {
					return Query.getDungeonName( dungeonId ) || dungeonId;
				} ).sort();
			}

			rows.push( new CargoRow( 'layer', fieldsForLayer ) );
		}

		return rows;
	}
}

module.exports = Planet;
