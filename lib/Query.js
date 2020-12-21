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
	}

	/**
	 * Convert planet code (e.g. "arboreal2") into human-readable name (e.g. "Volcanic Primeval").
	 *
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
	 *
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
	 *
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
	 * Find the item by its ID.
	 *
	 * @param {string} itemCode
	 * @return {Item}
	 */
	findItem( itemCode ) {
		// This can't be required on top of Query.js, because Query is loaded before ItemDatabase.
		if ( !this.itemDb ) {
			this.itemDb = require( '.' ).ItemDatabase;
			if ( !this.itemDb.loaded ) {
				throw new Error( 'Query.findItem() can\'t be called before ItemDatabase.load().' );
			}
		}

		return this.itemDb.find( itemCode );
	}

	/**
	 * True if the item with this ID exists, false otherwise.
	 *
	 * @param {string} itemCode
	 * @return {boolean}
	 */
	doesItemExist( itemCode ) {
		return !!this.findItem( itemCode );
	}

	/**
	 * Find the monster by its ID.
	 *
	 * @param {string} monsterCode
	 * @return {Object}
	 */
	findMonster( monsterCode ) {
		// This can't be required on top of Query.js, because Query is loaded before ItemDatabase.
		if ( !this.monsterDb ) {
			this.monsterDb = require( '.' ).MonsterDatabase;
			if ( !this.monsterDb.loaded ) {
				throw new Error( 'Query.findMonster() can\'t be called before MonsterDatabase.load().' );
			}
		}

		return this.monsterDb.find( monsterCode );
	}
}

module.exports = new Query();
