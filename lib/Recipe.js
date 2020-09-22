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

		if ( !util.isValidInputOrOutput( this.inputs ) || !util.isValidInputOrOutput( this.outputs ) ) {
			util.log( "[warning] Invalid recipe found: " + JSON.stringify( this ) );
			return false;
		}

		// Seems valid.
		return true;
	}

	/**
	 * Get wikitext representation of this recipe.
	 * @return {string}
	 */
	toWikitext() {
		var inputsWikitext = util.ingredientsListToWikitext( this.inputs, this.station ),
			outputsWikitext = util.ingredientsListToWikitext( this.outputs, this.station );

		if ( !inputsWikitext || !outputsWikitext ) {
			// Recipe refers to unknown item, etc.
			// See ingredientsListToWikitext() for details.
			return '';
		}

		return '{{Recipe|inputs=\n' + inputsWikitext + '|outputs=\n' + outputsWikitext + '}}\n';
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Recipe into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var result = '{{#cargo_store:_table = recipe';
		result += '\n|station=' + this.station;
		result += '\n|inputs=' + Object.keys( this.inputs ).join( ',' );
		result += '\n|outputs=' + Object.keys( this.outputs ).join( ',' );
		result += '\n|wikitext=' + this.toWikitext().trim()
		result += '\n}}\n';

		return result;
	}
}

module.exports = Recipe;
