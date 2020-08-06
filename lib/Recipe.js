'use strict';

const util = require( './util' );

/**
 * Represents one Recipe: rule like "A and B are converted into C and D at crafting Station E".
 * This can be used for anything: crafting, mixing, extraction, smelting, cooking, etc.
 */
class Recipe {
	/**
	 * @param {string} station Name of crafting Station (e.g. "Powder Sifter").
	 * @param {object} inputs Map of input materials, e.g. { "ironore": 3, "copperbar": 2 }.
	 * @param {object} outputs Map of output materials.
	 */
	constructor( station, inputs, outputs ) {
		this.station = station;
		this.inputs = inputs;
		this.outputs = outputs;
	}

	/**
	 * Return true if this recipe is correct, false otherwise.
	 * Used in sanity checks to prevent incorrect Recipe objects from being in the database.
	 * @return {boolean}
	 */
	isValid() {
		if ( typeof( this.station ) !== 'string' ) {
			return false;
		}

		if ( !util.isStringToIntegerMap( this.inputs ) || !util.isStringToIntegerMap( this.outputs ) ) {
			return false;
		}

		// Seems valid.
		return true;
	}
}

module.exports = Recipe;
