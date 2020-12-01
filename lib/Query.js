'use strict';

const { AssetDatabase } = require( '.' );

/**
 * Utility class for making queries like "get planet name by planet ID".
 *
 * Note: all queries are allowed to throw Error if used prematurely
 * (e.g. when trying to access ItemDatabase.find() from constructor of Item class).
 */
class Query {
	constructor() {
		// Cache used by getMultiplier(), e.g.
		// { "standardArmorLevelProtectionMultiplier": { 0: 2, 1: 12, 2: 32, ... }, ... }.
		this.cachedMultipliers = {};
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
	 * Calculate a multiplier like "by how much is damage of tier N weapon increased" for known N.
	 * @param {string} multiplierName One of the keys in "levelingmultipliers.functions" asset.
	 * @param {float} tier Level of the item.
	 * @return {float}
	 */
	getMultiplier( multiplierName, tier ) {
		if ( !this.cachedMultipliers[multiplierName] ) {
			this.cachedMultipliers[multiplierName] = {};
		}

		if ( !this.cachedMultipliers[multiplierName][tier] ) {
			this.cachedMultipliers[multiplierName][tier] = this.getMultiplierUncached( multiplierName, tier );
		}

		return this.cachedMultipliers[multiplierName][tier];

	}

	/**
	 * Uncached version of getMultiplier().
	 * @param {string} multiplierName One of the keys in "levelingmultipliers.functions" asset.
	 * @param {float} tier Level of the item.
	 * @return {float}
	 */
	getMultiplierUncached( multiplierName, tier ) {
		if ( !this.levelingMultipliers ) {
			this.levelingMultipliers = AssetDatabase.getData( 'leveling/levelingmultipliers.functions' );

			// TODO: just precalculate the entirety of this.cachedMultipliers here instead of lazy-loading it.
		}

		var formula = this.levelingMultipliers[multiplierName];
		if ( !formula ) {
			throw new Error( 'Unknown leveling multiplier: ' + multiplierName );
		}

		var [ algorithm, funcType, ...values ] = formula;
		if ( algorithm !== 'linear' || funcType !== 'clamp' ) {
			// All multipliers that we currently use have linear/clamp, so no need to implement others for now.
			throw new Error( 'Multipliers other than linear/clamp are not yet supported: ' + multiplierName );
		}

		// E.g. [ [0, 2], [1, 12], [2, 22], ... ]
		var values = values.sort( ( v1, v2 ) => v1[0] - v2[0] ),
			valMap = new Map( values );

		tier = Math.max( values[0][0], Math.min( values[values.length - 1][0], tier ) );
		var exactMatchValue = valMap.get( tier );
		if ( exactMatchValue ) {
			return exactMatchValue;
		}

		// While fractional tiers are easy to implement, they are currently not used by any non-RNG items,
		// so why write the code that is not going to be used?
		throw new Error( 'getMultiplier(): non-integer tiers (' + tier + ') are not yet implemented.' );
	}
}

module.exports = new Query();
