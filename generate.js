/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

var config = require( './config.json' ),
	fs = require( 'fs' ),
	RecipeDatabase = require( './lib/RecipeDatabase' ),
	ItemDatabase = require( './lib/ItemDatabase' ),
	util = require( './lib/util' );

// Load configs of all processing stations.
// NOTE: centrifugeConf covers not only centrifuges, but also powder sifters, honey jars, etc.
var centrifugeConf = util.loadModFile( 'objects/generic/centrifuge_recipes.config' ),
	extractorConf = util.loadModFile( 'objects/generic/extractionlab_recipes.config' ),
	blastFurnaceConf = util.loadModFile( 'objects/power/fu_blastfurnace/fu_blastfurnace.object' ),
	arcSmelterConf = util.loadModFile( 'objects/power/isn_arcsmelter/isn_arcsmelter.object' ),
	mixerConf = util.loadModFile( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' );


/*-------------------------------------------------------------------------------------------- */
/* Step 1: Add recipes from Extractors into RecipeDatabase ----------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var extractorRecipe of extractorConf ) {
	config.extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		RecipeDatabase.add(
			buildingName,
			util.getStageValues( extractorRecipe.inputs, extractorStage ),
			util.getStageValues( extractorRecipe.outputs, extractorStage )
		);
	} );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 2: Add recipes from Liquid Mixer into RecipeDatabase --------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var mixerRecipe of mixerConf ) {
	RecipeDatabase.add( 'Liquid Mixer', mixerRecipe.inputs, mixerRecipe.outputs );
}

// TODO: add recipes from other Stations.






/*-------------------------------------------------------------------------------------------- */

//RecipeDatabase.dump();

var SearchIndex = RecipeDatabase.makeSearchIndex();

/*
console.log( JSON.stringify( SearchIndex.getRecipesWhereInputIs( 'fu_salt' ), null, '  ' ) );
console.log( JSON.stringify( SearchIndex.getRecipesWhereOutputIs( 'fu_salt' ), null, '  ' ) );
console.log( SearchIndex.listKnownItems().join( ', ' ) );
*/

/**
 * Format the output of getRecipesWhereInputIs() or getRecipesWhereOutputIs() as wikitext.
 * @param {array} recipeList
 * @return {string}
 */
function recipeListToWikitext( recipeList ) {
	if ( !recipeList ) {
		return '';
	}

	var wikitext = '';

	for ( var [ CraftingStation, recipes ] of Object.entries( recipeList ) ) {
		wikitext += '=== ' + CraftingStation + ' ===\n\n';

		recipes.forEach( function ( Recipe ) {
			wikitext += Recipe.toWikitext() + '\n';
		} );

		wikitext += '\n';
	}

	return wikitext;
}

if ( !fs.statSync( config.outputDir ) ) {
	fs.mkdirSync( config.outputDir );
}

for ( var ItemCode of SearchIndex.listKnownItems() ) {
	var item = ItemDatabase.find( ItemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		util.log( "[warning] Unknown item in the recipe: " + ItemCode );
		continue;
	}

	// Obtain the human-readable item name.
	var ItemName = item.displayName,
		recipesWhereInput = SearchIndex.getRecipesWhereInputIs( ItemCode ),
		recipesWhereOutput = SearchIndex.getRecipesWhereOutputIs( ItemCode );

	// Form the automatically generated wikitext of recipes.
	var wikitext = '';

	wikitext += '== How to obtain ==\n\n' + recipeListToWikitext( recipesWhereOutput );
	wikitext += '== Used for ==\n\n' + recipeListToWikitext( recipesWhereInput );

	// TODO: creating these files is temporary (for checking the correctness of files).
	// Ultimately the output should be something like *.xml dump for Special:Import
	// or an import file for pywikipediabot - something that would allow quick creation of pages.

	var fd = fs.openSync( config.outputDir + '/' + ItemName.replace( / /g, '_' ) + '.txt', 'w' );
	fs.writeSync( fd, wikitext );
	fs.closeSync( fd );
}
