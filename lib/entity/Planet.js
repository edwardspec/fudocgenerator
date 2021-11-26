'use strict';

const { CargoRow, StarDatabase, Query } = require( '..' );

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
		[ this.minTier, this.maxTier ] = this.threatRange;
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
			stars: StarDatabase.findStarsWithPlanet( this.planetCode ),
			minTier: this.minTier,
			maxTier: this.maxTier
		};
		if ( this.gravityRange ) {
			// These fields are optional, because only some of the planet types are restricted in which gravity
			// they can have. Other planets determine their gravity from the size of the individual planet.
			[ fields.minGravity, fields.maxGravity ] = this.gravityRange;
		}

		// Calculate best/worst dayLightColor levels (for knowing how viable is Solar Panel on this planet).
		var colorLevels = this.getDayLightColors().map( ( light ) => light.getLevel() ).sort();

		fields.minDayLight = colorLevels[0];
		fields.maxDayLight = colorLevels[colorLevels.length - 1];

		// Calculate detailed list of chances to have each light level (e.g. "0.6 (75%), 0.2 (25%)").
		var lightColorUseCount = {}; // { level1: numberOfOccurences1, ... }
		for ( var level of colorLevels ) {
			lightColorUseCount[level] = ( lightColorUseCount[level] || 0 ) + 1;
		}
		fields.dayLightDistribution = Object.entries( lightColorUseCount )
			.sort( ( a, b ) => b[1] - a[1] )
			.map( ( [ lightColor, uses ] ) => {
				var percent = Math.ceil( 100 * uses / colorLevels.length );
				return lightColor + ' (' + percent + '%)';
			} ).join( ', ' );

		var rows = [];
		rows.push( new CargoRow( 'planet', fields ) );

		// Also include all layers.
		for ( var [ layerName, layerInfo ] of Object.entries( this.layers ) ) {
			var fieldsForLayer = {
				planet: this.planetCode,
				layer: layerName,
				primaryRegion: this.getRegionCodes( layerInfo.primaryRegion || [] ),
				secondaryRegions: this.getRegionCodes( layerInfo.secondaryRegions || [] )
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

	/**
	 * Given an array of region codes (e.g. [ "swamp", "volcanic" ]),
	 * return an array of region codes that includes their subregions too (if any)
	 * and has been tier-adjusted (for regions that have 2+ biomes and/or depend on tier).
	 * Example 1: vanilla region "volcanic" can have "geode" subregion, so the string "geode"
	 * will also be in the returned array.
	 * Example 2: vanilla region "core" has 1 possible biome for tier 1 planets and 3 biomes
	 * for tier 2+ planets, so the returned array will have pseudo-region codes that are possible
	 * for the tier of this Planet, and those pseudo-regions will only have 1 biome each.
	 *
	 * @param {string[]} regionCodes
	 * @return {string[]}
	 */
	getRegionCodes( regionCodes ) {
		var tierAdjustedCodes = new Set();
		for ( var regionCode of regionCodes ) {
			var region = Query.findRegion( regionCode );
			for ( var code of region.getCodesForTier( this.minTier, this.maxTier ) ) {
				tierAdjustedCodes.add( code );
			}
		}

		return [...tierAdjustedCodes];
	}

	/**
	 * Get all possible variants of dayLightColor on this Planet.
	 *
	 * @return {LightColor[]}
	 */
	getDayLightColors() {
		var surfacePrimaryRegions = this.layers.surface.primaryRegion || [];

		var possibleColors = [];
		for ( var regionCode of surfacePrimaryRegions ) {
			var region = Query.findRegion( regionCode );
			possibleColors.push( region.getDayLightColors() );
		}

		return possibleColors.flat();
	}
}

module.exports = Planet;
