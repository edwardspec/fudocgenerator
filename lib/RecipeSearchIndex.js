/**
 * Quick search engine for finding recipes/items in the RecipeDatabase.
 */

class RecipeSearchIndex {
	/**
	 * Loop over all recipes in RecipeDatabase and generate a high-performance search index.
	 */
	constructor( RecipeDatabase ) {
		this.db = RecipeDatabase;

		// { "ironore": true, "copperbar": true, ... }
		this.seenItems = {};

		// { "fu_carbon": { "Toaster": [ Recipe1 ], "Arc Smelter": [ Recipe2, Recipe3 ], ... }, ... }
		this.recipesWhereOutputIs = {};

		// { "liquidoil": { "Gas Centrifuge": [ Recipe1 ], "Liquid Mixer": [ Recipe2, ... ], ... }, ... }
		this.recipesWhereInputIs = {};

		this.db.knownRecipes.forEach( ( recipe ) => {
			var station = recipe.station,
				inputItems = Object.keys( recipe.inputs ),
				outputItems = Object.keys( recipe.outputs );

			for ( var mentionedItem of inputItems.concat( outputItems ) ) {
				this.seenItems[mentionedItem] = true;
			}

			for ( var inputItem of inputItems ) {
				if ( !this.recipesWhereInputIs[inputItem] ) {
					this.recipesWhereInputIs[inputItem] = {};
				}

				if ( !this.recipesWhereInputIs[inputItem][station] ) {
					this.recipesWhereInputIs[inputItem][station] = [];
				}

				this.recipesWhereInputIs[inputItem][station].push( recipe );
			}

			for ( var outputItem of outputItems ) {
				if ( !this.recipesWhereOutputIs[outputItem] ) {
					this.recipesWhereOutputIs[outputItem] = {};
				}

				if ( !this.recipesWhereOutputIs[outputItem][station] ) {
					this.recipesWhereOutputIs[outputItem][station] = [];
				}

				this.recipesWhereOutputIs[outputItem][station].push( recipe );
			}
		} );
	}

	/**
	 * Returns an array of ALL items that are a part of at least 1 Recipe.
	 * Format: [ "liquidoil", "copperore", "liquidhoney", "fu_carbon", ... ].
	 */
	listKnownItems() {
		return Object.keys( this.seenItems );
	}

	/**
	 * Returns an array of all recipes (grouped by Crafting Station) where itemName is an input.
	 * @param {string} itemName
	 * Format: { "Gas Centrifuge": [ Recipe1 ], "Liquid Mixer": [ Recipe2, ... ], ... }
	 */
	getRecipesWhereInputIs( itemName ) {
		return this.recipesWhereInputIs[itemName];
	}
	/**
	 * Returns an array of all recipes (grouped by Crafting Station) where itemName is an output.
	 * @param {string} itemName
	 * Format: { "Gas Centrifuge": [ Recipe1 ], "Liquid Mixer": [ Recipe2, ... ], ... }
	 */
	getRecipesWhereOutputIs( itemName ) {
		return this.recipesWhereOutputIs[itemName];
	}
}

module.exports = RecipeSearchIndex;
