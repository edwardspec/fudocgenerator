/**
 * Discovers all known star types (Gentle, Temperate, Frozen, etc.).
 */

'use strict';

const { AssetDatabase, util } = require( '..' );

class StarDatabase {
	constructor() {
		this.loaded = false;

		// Map: planet ID => array of star names that can have this planet,
		// e.g. { "forest": [ "Gentle", "Temperate" ] }
		this.planetToStars = new Map();
	}

	/**
	 * Scan terrestrial_worlds.config and find all planets, layers, etc.
	 */
	load() {
		var celestialConf = AssetDatabase.getData( 'celestial.config' );

		// Map: star codes => human-readable star names,
		// e.g. { "whitestar": "Gentle Star" }
		var starNames = AssetDatabase.getData( 'interface/cockpit/cockpit.config' ).starTypeNames;

		// Map: name of known planetary body type => array of planet IDs,
		// e.g. { "Tier2": [ "forest", "desert" ], ... }
		var knownBodyTypes = new Map();
		for ( var [ bodyType, bodyConf ] of Object.entries( celestialConf.planetaryTypes ) ) {
			knownBodyTypes.set( bodyType, bodyConf.baseParameters.terrestrialType || [] );
		}

		// Same as knownBodyTypes, but for satellites.
		var knownMoonTypes = new Map();
		for ( var [ moonType, moonConf ] of Object.entries( celestialConf.satelliteTypes ) ) {
			knownMoonTypes.set( moonType, moonConf.baseParameters.terrestrialType || [] );
		}

		// Find "possible planets around this star" for each type of star.
		for ( var system of Object.values( celestialConf.systemTypes ) ) {
			var starCode = system.baseParameters.typeName;
			var possiblePlanets = new Set();

			for ( var orbit of system.orbitRegions ) {
				for ( var bodyOption of orbit.planetaryTypes ) {
					for ( const planetCode of knownBodyTypes.get( bodyOption.item ) ) {
						possiblePlanets.add( planetCode );
					}
				}

				for ( var moonOption of orbit.satelliteTypes ) {
					for ( const planetCode of knownMoonTypes.get( moonOption.item ) ) {
						possiblePlanets.add( planetCode );
					}
				}
			}

			for ( const planetCode of possiblePlanets ) {
				var starsWithThisPlanet = this.planetToStars.get( planetCode );
				if ( !starsWithThisPlanet ) {
					starsWithThisPlanet = [];
					this.planetToStars.set( planetCode, starsWithThisPlanet );
				}

				starsWithThisPlanet.push( starNames[starCode] );
			}
		}

		// Two different stars are called "Blue Star".
		// We should remove such duplicates from planetToStars (to not show "Blue Star" twice).
		for ( const [ planetCode, nonUniqueStarNames ] of this.planetToStars ) {
			this.planetToStars.set( planetCode, [...new Set( nonUniqueStarNames )] );
		}

		util.log( '[info] StarDatabase: assigned stars to ' + this.planetToStars.size + ' different planet types.' );
		this.loaded = true;
	}

	/**
	 * Given the ID of a planet (e.g. "forest"), return array of star names that can have this planet.
	 *
	 * @param {string} planetCode
	 * @return {string[]}
	 */
	findStarsWithPlanet( planetCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.planetToStars.get( planetCode ) || [];
	}
}

module.exports = new StarDatabase();
