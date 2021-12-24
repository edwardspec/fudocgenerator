'use strict';

const { AssetDatabase, StatusEffect, util } = require( '..' );

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
		let skippedCount = 0;

		AssetDatabase.forEach( 'statuseffect', ( filename, asset ) => {
			const effect = new StatusEffect( asset.data );
			if ( !effect.label && !effect.icon ) {
				// Skip status effects with neither human-readable label and icon.
				// We don't have enough useful information for them to take space in Cargo database.
				skippedCount++;
				return;
			}

			this.knownEffects.set( effect.name, effect );
		} );

		util.log( '[info] StatusEffectDatabase: excluded ' + skippedCount +
			' status effects without human-readable label.' );
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

		for ( const effect of this.knownEffects.values() ) {
			callback( effect );
		}
	}
}

module.exports = new StatusEffectDatabase();
