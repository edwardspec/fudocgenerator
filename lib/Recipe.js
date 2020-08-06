'use strict';

/**
 * Returns true if someObject is a key-value map with string keys and integer values.
 * Used in sanity checks.
 */
function isStringToIntegerMap( someObject ) {
	if ( typeof ( someObject ) !== 'object' ) {
		return false;
	}

	for ( var key in someObject ) {
		if ( typeof( key ) !== 'string' ) {
			return false;
		}

		var value = someObject[key];
		if ( value != parseInt( value ) ) {
			return false;
		}
	}

	return true;
}

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

		if ( !isStringToIntegerMap( this.inputs ) || !isStringToIntegerMap( this.outputs ) ) {
			return false;
		}

		// Seems valid.
		return true;
	}
}

module.exports = Recipe;
