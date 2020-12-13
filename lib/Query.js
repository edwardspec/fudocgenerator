'use strict';

const { AssetDatabase } = require( '.' );

// Maps workTime of bee species (0, 1 or 2) to human-readable label (e.g. "night").
const beeWorkTimes = [ 'day', 'night', 'both' ];

/**
 * Utility class for making queries like "get planet name by planet ID".
 *
 * Note: all queries are allowed to throw Error if used prematurely
 * (e.g. when trying to access ItemDatabase.find() from constructor of Item class).
 */
class Query {
	constructor() {
	}

	/**
	 * Convert planet code (e.g. "arboreal2") into human-readable name (e.g. "Volcanic Primeval").
	 * @param {string} planetCode
	 * @return {string|undefined}
	 */
	getPlanetName( planetCode ) {
		if ( !this.planetTypeNames ) {
			this.planetTypeNames = AssetDatabase.getData( 'interface/cockpit/cockpit.config' ).planetTypeNames;
		}

		return this.planetTypeNames[planetCode];
	}

	/**
	 * Obtain the information about mech fuel by its item ID. Returns false for non-fuels.
	 * @param {string} itemCode
	 * @return {Object|false}
	 */
	getMechFuelInfo( itemCode ) {
		if ( !this.mechFuels ) {
			this.mechFuels = AssetDatabase.getData( 'interface/mechfuel/mechfuel.config' ).fuels;
		}

		return this.mechFuels[itemCode] || false;
	}

	/**
	 * Find the ID of farm beast diet (e.g. "omnivore" or "lunar") that includes itemCode as possible food.
	 * @param {string} itemCode
	 * @return {string|undefined}
	 */
	whichAnimalsEat( itemCode ) {
		if ( !this.itemToAnimalDiet ) {
			this.itemToAnimalDiet = {};

			var farmConf = AssetDatabase.getData( 'scripts/actions/monsters/farmable.config' ).foodlists;
			for ( var [ diet, listOfFoodItems ] of Object.entries( farmConf ) ) {
				for ( var possibleFoodCode of listOfFoodItems ) {
					this.itemToAnimalDiet[possibleFoodCode] = diet;
				}
			}
		}

		return this.itemToAnimalDiet[itemCode];
	}

	/**
	 * Get all information about bees.
	 */
	getBeeData() {
		if ( !this.beeInfo ) {
			this.beeInfo = AssetDatabase.getData( 'bees/beeData.config' );
		}

		return this.beeInfo;
	}

	/**
	 * Find the rivals of selected species of bees.
	 * @param {string} species Name of bees, e.g. "bumblebee".
	 * @return {string[]} Array of rivaling species (e.g. [ "honey", "cybernetic" ]).
	 */
	getBeeRivals( species ) {
		var rivals = new Set();
		for ( var [ first, second ] of Object.entries( this.getBeeData().rivals ) ) {
			if ( first == species ) {
				rivals.add( second );
			} else if ( second == species ) {
				rivals.add( first );
			}
		}

		return [...rivals];
	}

	/**
	 * Find the work time ("day", "night" or "both") for all subspecies of selected species of bees.
	 * @param {string} species Name of bees, e.g. "bumblebee".
	 * @return {object} Format: { "subspeciesName1": "day", "subspeciesName2": "night" }
	 */
	getBeeWorkTimes( species ) {
		var result = {};
		this.getBeeData().stats[species].forEach( ( subspecies ) => {
			result[subspecies.name] = beeWorkTimes[subspecies.workTime];
		} );
		return result;
	}
}

module.exports = new Query();
