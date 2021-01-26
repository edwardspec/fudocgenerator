'use strict';

const { AssetDatabase, StatusEffect, util } = require( '.' );

/**
 * Discovers all known status effects.
 */
class StatusEffectDatabase {
	constructor() {
		this.loaded = false;

		// Array of known status effects,
		// e.g. { "biomepoisongas": StatusEffect1, ... }
		this.knownEffects = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all status effects.
	 */
	load() {
		AssetDatabase.forEach( 'statuseffect', ( filename, asset ) => {
			var effect = new StatusEffect( asset.data );
			this.knownEffects.set( effect.name, effect );
		} );

		util.log( '[info] StatusEffectDatabase: found ' + this.knownEffects.size + ' status effects.' );
		this.loaded = true;
	}

	/**
	 * Find the status effect by its name.
	 *
	 * @param {string} name
	 * @return {StatusEffect|null}
	 */
	find( name ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownEffects.get( name );
	}


	/**
	 * Callback expected by StatusEffectDatabase.forEach().
	 *
	 * @callback effectCallback
	 * @param {Region} region
	 */

	/**
	 * Iterate over all status effects. Run the callback for each of them.
	 * Callback receives 1 parameter (StatusEffect object).
	 *
	 * @param {effectCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var effect of this.knownEffects.values() ) {
			callback( effect );
		}
	}
}

module.exports = new StatusEffectDatabase();
