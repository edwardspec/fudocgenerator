/**
 * Finds all situations when two (or more) *.recipe files have exactly the same Input/Output.
 */

var { CraftingStationDatabase, AssetDatabase, RecipeSide } = require( '../lib' );

// { normalizedRecipeString: [ filename1, filename2, ... ], ... }
var recipes = {};

AssetDatabase.forEach( 'recipe', ( filename, asset ) => {
	var loadedData = asset.data;
	if ( !CraftingStationDatabase.findByGroups( loadedData.groups ) ) {
		// Skip recipes that can't be crafted anywhere.
		return;
	}

	// Reduce the normal input/output of Recipe to normalized string.
	var normalize = function ( ingredients ) {
		var ret = [];

		for ( var item of Object.keys( ingredients ).sort() ) {
			ret.push( item + '(' + ingredients[item].count + ')' );
		}

		return ret.join( ',' );
	};

	var normalizedRecipe = normalize( RecipeSide.newFromCraftingInput( loadedData.input ) ) +
		' => ' + normalize( RecipeSide.newFromCraftingInput( loadedData.output ) );

	if ( !recipes[normalizedRecipe] ) {
		recipes[normalizedRecipe] = [];
	}

	recipes[normalizedRecipe].push( filename );
} );

for ( var [ normalizedRecipe, filenames ] of Object.entries( recipes ) ) {
	if ( filenames.length > 1 ) {
		console.log( { filenames: filenames, normalizedInputOutput: normalizedRecipe } );
	}
}
