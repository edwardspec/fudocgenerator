'use strict';

const { AssetDatabase, util } = require( '..' );

/**
 * Discovers all known weapon abilities.
 */
class WeaponAbilityDatabase {
	constructor() {
		this.loaded = false;

		// Array of known abilities,
		// e.g. { "flashlight": { ... }, ... }
		this.knownAbilities = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all abilities.
	 */
	load() {
		AssetDatabase.forEach( 'ability', ( filename, asset ) => {
			var ability = asset.data.ability;
			this.knownAbilities.set( ability.type, ability );
		} );

		util.log( '[info] WeaponAbilityDatabase: found ' + this.knownAbilities.size + ' abilities.' );

		this.loaded = true;
	}

	/**
	 * Find the ability by its name.
	 *
	 * @param {string} abilityType E.g. "flashlight".
	 * @return {Object|undefined} Arbitrary information about this ability.
	 */
	find( abilityType ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownAbilities.get( abilityType );
	}
}

module.exports = new WeaponAbilityDatabase();
