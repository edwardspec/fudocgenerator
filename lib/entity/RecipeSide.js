'use strict';

const config = require( '../../config.json' );

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeSide {
	/**
	 * @param {object} rawList Map of input materials,
	 * e.g. { "ironore": { count: 3 }, "copperbar": { count: 2 } }.
	 */
	constructor( rawList ) {
		// Copy all key/value pairs into this RecipeSide object.
		Object.assign( this, rawList );
	}


	/**
	* Returns true if this RecipeSide has correct format. (This is used in sanity checks)
	* Valid values are: {} (unknown/any quantity), { count: Integer }, { chance: Float }.
	*/
	isValid() {
		for ( var [ key, value ] of Object.entries( this ) ) {
			if ( typeof( key ) !== 'string' || key === 'undefined' ) {
				return false;
			}

			if ( value.count && value.count != parseInt( value.count ) ) {
				// Not a valid integer.
				return false;
			}

			if ( value.chance && value.chance != parseFloat( value.chance ) ) {
				// Not a valid number.
				return false;
			}

			// TODO: check value.rarity too (for Centrifuge recipes).
		}

		return true;
	};
}

module.exports = RecipeSide;
