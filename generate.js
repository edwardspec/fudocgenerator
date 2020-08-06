/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

var config = require( './config.json' ),
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
	var outputs = extractorRecipe.outputs;

	config.extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		RecipeDatabase.add(
			buildingName,
			util.getStageValues( extractorRecipe.inputs, extractorStage ),
			util.getStageValues( extractorRecipe.outputs, extractorStage )
		);
	} );
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

ItemDatabase.load();

for ( var ItemCode of SearchIndex.listKnownItems() ) {
	var item = ItemDatabase.find( ItemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		//console.log( "Unknown item: " + ItemCode );
		continue;
	}

	// Obtain the human-readable item name.
	var ItemName = item.shortdescription;

	// Remove the color codes from the name (e.g. "^#e43774;" or "^reset;" ).
	ItemName = ItemName.replace( /\^[^;^]+;/g, '' );

	console.log( ItemCode + ' => ' + ItemName );
}
