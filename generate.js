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
	ResultsWriter = require( './lib/ResultsWriter' ),
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

// Generate the wikitext for each item that has at least 1 Recipe.
// Then send the results to ResultsWriter.write().

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

	// Write information about this item into the Cargo database.
	// NOTE: this automatically generated page is a template that can be included into the article
	// (for example, [[Template:Automatic item info/Carbon]] for [[Carbon]]).
	wikitext += '<noinclude>{{#cargo_store:_table = item\n';
	wikitext += '|id = ' + ItemCode + '\n';
	wikitext += '|name = ' + ItemName + '\n';

	// Most of these fields are optional, because we must be tolerant to bad input.
	if ( item.category ) {
		wikitext += '|category = ' + item.category + '\n';
	}

	if ( item.description ) {
		wikitext += '|description = ' + util.cleanDescription( item.description ) + '\n';
	}

	if ( item.inventoryIcon ) {
		wikitext += '|icon = ' + item.inventoryIcon + '\n';
	}

	if ( item.rarity ) {
		wikitext += '|rarity = ' + item.rarity + '\n';
	}

	wikitext += '|price = ' + ( item.price || 0 ) + '\n';

	if ( item.maxStack ) {
		wikitext += '|stackSize = ' + item.maxStack + '\n';
	}

	if ( item.level ) {
		wikitext += '|tier = ' + item.level + '\n';
	}

	// TODO: what is the default if this parameter is not specified? Two-handed or one-handed?
	if ( item.twoHanded !== undefined ) {
		wikitext += '|twoHanded = ' + ( item.twoHanded ? 1 : 0 ) + '\n';
	}

	var isUpgradeable = false;
	if ( Array.isArray( item.itemTags ) ) {
		if ( item.itemTags.indexOf( 'upgradeableWeapon' ) !== -1 ) {
			isUpgradeable = true;
		} else if ( item.itemTags.indexOf( 'upgradeableTool' ) !== -1 ) {
			isUpgradeable = true;
		}
	}

	wikitext += '|upgradeable = ' + ( isUpgradeable ? 1 : 0 ) + '\n';
	wikitext += '}}</noinclude>\n';

	ResultsWriter.write( ItemName, wikitext, ItemCode );
}
