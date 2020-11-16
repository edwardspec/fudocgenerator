'use strict';

const { util } = require( '.' );

/**
 * Represents one Recipe: rule like "A and B are converted into C and D at crafting Station E".
 * This can be used for anything: crafting, mixing, extraction, smelting, cooking, etc.
 */
class Recipe {
	/**
	 * @param {string} station Name of crafting Station (e.g. "Powder Sifter").
	 * @param {RecipeSide} inputs Input materials.
	 * @param {RecipeSide} outputs output materials.
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

		if ( !this.inputs.isValid() || !this.outputs.isValid() ) {
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
		var inputsWikitext = this.inputs.toWikitext( this.station ),
			outputsWikitext = this.outputs.toWikitext( this.station );

		if ( !inputsWikitext || !outputsWikitext ) {
			// Recipe refers to unknown item, etc.
			return '';
		}

		return '{{Recipe|inputs=\n' + inputsWikitext + '|outputs=\n' + outputsWikitext + '}}\n';
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Recipe into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var wikitext = this.toWikitext().trim();
		if ( !wikitext ) {
			// Recipe is invalid (refers to unknown item), not recording into the Cargo database.
			return '';
		}

		var result = '{{#cargo_store:_table = recipe';
		result += '\n|station=' + this.station;
		result += '\n|inputs=' + this.inputs.getItemCodes().join( ',' );
		result += '\n|outputs=' + this.outputs.getItemCodes().join( ',' );
		result += '\n|wikitext=' + wikitext
		result += '\n}} ';

		return result;
	}
}

module.exports = Recipe;
