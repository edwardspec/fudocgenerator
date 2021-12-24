/**
 * Finds all situations when two (or more) *.recipe files have exactly the same Input/Output.
 */

'use strict';

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
	var normalize = function ( recipeSide ) {
		var ret = [];

		for ( var [ item, counts ] of Object.entries( recipeSide.items ).sort() ) {
			ret.push( item + '(' + counts.map( ( count ) => JSON.stringify( count ) ).join( ',' ) + ')' );
		}

		return ret.join( ',' );
	};

	const normalizedRecipe = normalize( RecipeSide.newFromCraftingInput( loadedData.input ) ) +
		' => ' + normalize( RecipeSide.newFromCraftingInput( loadedData.output ) );

	if ( !recipes[normalizedRecipe] ) {
		recipes[normalizedRecipe] = [];
	}

	recipes[normalizedRecipe].push( filename );
} );

for ( const [ normalizedRecipe, filenames ] of Object.entries( recipes ) ) {
	if ( filenames.length > 1 ) {
		console.log( { filenames: filenames, normalizedInputOutput: normalizedRecipe } );
	}
}
