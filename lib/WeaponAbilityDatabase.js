/**
 * Discovers all known weapon abilities.
 */

'use strict';

const { AssetDatabase, util } = require( '.' );

class WeaponAbilityDatabase {
	constructor() {
		this.loaded = false;

		// Array of known abilities,
		// e.g. { "flashlight": { ... }, ... }
		this.knownAbilities = {};
	}

	/**
	 * Scan the AssetDatabase and find all abilities.
	 */
	load() {
		AssetDatabase.forEach( 'ability', ( filename, asset ) => {
			var ability = asset.data.ability;
			this.knownAbilities[ability.type] = ability;
		} );

		util.log( '[info] WeaponAbilityDatabase: found ' + Object.keys( this.knownAbilities ).length + ' abilities.' );

		this.loaded = true;
	}

	/**
	 * Find the ability by its name.
	 * @param {string} abilityType E.g. "flashlight".
	 * @return {Object|undefined} Arbitrary information about this ability.
	 */
	find( abilityType ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownAbilities[abilityType];
	}
}

module.exports = new WeaponAbilityDatabase();
