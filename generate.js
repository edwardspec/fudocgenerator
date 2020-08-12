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
// NOTE: centrifugeConf covers not only centrifuges, but also powder sifters, etc.
var centrifugeConf = util.loadModFile( 'objects/generic/centrifuge_recipes.config' ),
	extractorConf = util.loadModFile( 'objects/generic/extractionlab_recipes.config' ),
	blastFurnaceConf = util.loadModFile( 'objects/power/fu_blastfurnace/fu_blastfurnace.object' ),
	arcSmelterConf = util.loadModFile( 'objects/power/isn_arcsmelter/isn_arcsmelter.object' ),
	mixerConf = util.loadModFile( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' );

// TODO: add recipes from other Stations (if any).
// No Honey Jarring Machine for now, because its recipes are not in JSON (they are in Lua script).

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
	RecipeDatabase.add(
		'Liquid Mixer',
		util.getStageValues( mixerRecipe.inputs, 0 ),
		util.getStageValues( mixerRecipe.outputs, 0 )
	);
}

/*-------------------------------------------------------------------------------------------- */
/* Step 3: Add recipes from Centrifuges into RecipeDatabase ---------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var [ recipeGroup, buildingName ] of Object.entries( config.centrifugeRecipeGroups ) ) {
	for ( var [ inputItem, outputToRarityMap ] of Object.entries( centrifugeConf[recipeGroup] ) ) {
		if ( recipeGroup === 'itemMapFarm' && inputItem === 'liquidwater' ) {
			// Ignore farm recipe for Water, because it is overridden in non-Wooden Centrifuges,
			// and we don't show Wooden Centrifuge anyway.
			// (this is the only situation where such override exists)
			continue;
		}

		var outputs = {};
		for ( var [ outputItem, rarityInfo ] of Object.entries( outputToRarityMap ) ) {
			outputs[outputItem] = { rarity: rarityInfo };
		}

		var inputs = {};
		inputs[inputItem] = {};

		RecipeDatabase.add( buildingName, inputs, outputs );
	}
}

/*-------------------------------------------------------------------------------------------- */
/* Step 4: Add recipes from Blast Furnace into RecipeDatabase -------------------------------- */
/*-------------------------------------------------------------------------------------------- */

var smelterBuildings = { 'Blast Furnace': blastFurnaceConf, 'Arc Smelter': arcSmelterConf };

for ( var [ buildingName, buildingConf ] of Object.entries( smelterBuildings ) ) {
	for ( var [ inputItem, outputItem ] of Object.entries( buildingConf.inputsToOutputs ) ) {
		var bonusOutputs = buildingConf.bonusOutputs[inputItem] || [];

		var inputs = {};
		inputs[inputItem] = { count: 2 }; // Base output for smelters is 2 Ore -> 1 Bar.

		var outputs = {};
		outputs[outputItem] = { count: 1 };

		for ( var [ bonusOutputItem, percent ] of Object.entries( bonusOutputs ) ) {
			outputs[bonusOutputItem] = { chance: percent };
		}

		RecipeDatabase.add( buildingName, inputs, outputs );
	}
}


/*-------------------------------------------------------------------------------------------- */
/* Step 5: Add crafting recipes into RecipeDatabase ------------------------------------------ */
/*-------------------------------------------------------------------------------------------- */

util.loadModFilesGlob( config.pathToMod + '/**/*.recipe', ( loadedData, filename ) => {
	RecipeDatabase.addNativeCraftingRecipe( loadedData );
} );

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
 * @param {Recipe[]} recipes
 * @return {string}
 */
function singleStationRecipesToWikitext( recipes ) {
	if ( !recipes ) {
		return '';
	}

	var wikitext = '';
	recipes.forEach( function ( Recipe ) {
		wikitext += Recipe.toWikitext();
	} );

	return wikitext;
}

/**
 * Format the output of getRecipesWhereInputIs() or getRecipesWhereOutputIs() as wikitext.
 * @param {object} recipeList E.g. { "Crafting Station1": [ Recipe1, ... ], ... }
 * @return {string}
 */
function recipeListToWikitext( recipeList ) {
	if ( !recipeList ) {
		return '';
	}

	var wikitext = '';

	for ( var [ CraftingStation, recipes ] of Object.entries( recipeList ) ) {
		var thisStationWikitext = singleStationRecipesToWikitext( recipes );
		if ( thisStationWikitext ) {
			wikitext += '=== [[' + CraftingStation + ']] ===\n\n' + thisStationWikitext + '\n';
		}
	}

	return wikitext;
}

// Create the output files with wikitext.
// TODO: this is temporary (for checking the correctness of output).
// Ultimately the output should be something like *.xml dump for Special:Import
// or an import file for pywikipediabot - something that would allow quick creation of pages.
fs.mkdirSync( config.outputDir, { recursive: true } );

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
		recipesWhereOutput = SearchIndex.getRecipesWhereOutputIs( ItemCode ),
		recipesWhereStation = SearchIndex.getRecipesWhereStationIs( ItemName ),
		howToObtainWikitext = recipeListToWikitext( recipesWhereOutput ),
		usedForWikitext = recipeListToWikitext( recipesWhereInput ),
		craftedHereWikitext = singleStationRecipesToWikitext( recipesWhereStation );

	// Form the automatically generated wikitext of recipes.
	var wikitext = '';

	if ( howToObtainWikitext ) {
		wikitext += '== How to obtain ==\n\n' + howToObtainWikitext;
	}

	if ( usedForWikitext ) {
		wikitext += '== Used for ==\n\n' + usedForWikitext;
	}

	if ( craftedHereWikitext ) {
		wikitext += '== Items crafted here ==\n\n' + craftedHereWikitext;
	}

	var validFilename = ItemName.replace( / /g, '_' ).replace( '/', '%2F' );

	var fd = fs.openSync( config.outputDir + '/' + validFilename + '.txt', 'w' );
	fs.writeSync( fd, wikitext );
	fs.closeSync( fd );
}
