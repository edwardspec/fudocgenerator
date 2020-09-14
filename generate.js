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
	mixerConf = util.loadModFile( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' ),
	xenolabConf = util.loadModFile( 'objects/generic/xenostation_recipes.config' ),
	erchiusConverterConf = util.loadModFile( 'objects/minibiome/precursor/precursorconverter/console.object' ),
	embalmingConf = util.loadModFile( 'objects/minibiome/elder/embalmingtable/embalmingtable_recipes.config' ),
	psiAmplifierConf = util.loadModFile( 'objects/generic/extractionlabmadness_recipes.config' ),
	condenserConf = util.loadModFile( 'objects/power/isn_atmoscondenser/isn_atmoscondenser.object' ),
	planetTypeNames = util.loadModFile( 'interface/cockpit/cockpit.config' ).planetTypeNames;

// TODO: add recipes from other Stations (if any).
// No Honey Jarring Machine for now, because its recipes are not in JSON (they are in Lua script).

/*-------------------------------------------------------------------------------------------- */
/* Step 1: Add recipes from Extractors into RecipeDatabase ----------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var extractorRecipe of extractorConf ) {
	config.extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		var inputs = util.getStageValues( extractorRecipe.inputs, extractorStage ),
			outputs = util.getStageValues( extractorRecipe.outputs, extractorStage );

		RecipeDatabase.add( buildingName, inputs, outputs );

		if ( extractorRecipe.reversible ) {
			// This is currently only used for Nitrogen <-> Liquid Nitrogen
			RecipeDatabase.add( buildingName, outputs, inputs );
		}
	} );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 2: Add recipes from Liquid Mixer, Xeno Research Lab, etc. into RecipeDatabase -------- */
/*-------------------------------------------------------------------------------------------- */

for ( var mixerRecipe of mixerConf ) {
	RecipeDatabase.add(
		'Liquid Mixer',
		util.getStageValues( mixerRecipe.inputs, 0 ),
		util.getStageValues( mixerRecipe.outputs, 0 )
	);
}

for ( var xenolabRecipe of xenolabConf ) {
	RecipeDatabase.add(
		'Xeno Research Lab',
		util.getStageValues( xenolabRecipe.inputs, 0 ),
		util.getStageValues( xenolabRecipe.outputs, 0 )
	);
}

for ( var converterRecipe of erchiusConverterConf.recipeTable ) {
	RecipeDatabase.add(
		'Erchius Converter',
		util.getStageValues( converterRecipe.inputs, 0 ),
		util.getStageValues( converterRecipe.outputs, 0 )
	);
}

for ( var embalmingRecipe of embalmingConf ) {
	RecipeDatabase.add(
		'Autopsy Table',
		util.getStageValues( embalmingRecipe.inputs, 0 ),
		util.getStageValues( embalmingRecipe.outputs, 0 )
	);
}

for ( var psiAmplifierRecipe of psiAmplifierConf ) {
	RecipeDatabase.add(
		'Psionic Amplifier',
		// This station is Tier 3 (extractorStage=2). Stage=0 is used for Tier 1 extractors.
		util.getStageValues( psiAmplifierRecipe.inputs, 2 ),
		util.getStageValues( psiAmplifierRecipe.outputs, 2 )
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
/* Step 5: Add outputs of Atmospheric Condenser into RecipeDatabase -------------------------- */
/*-------------------------------------------------------------------------------------------- */

var condenserWeights = condenserConf.namedWeights,
	sumOfWeights = 0,
	outputsPerBiome = {};

for ( var weight of Object.values( condenserWeights ) ) {
	sumOfWeights += weight;
}

for ( var [ biomeCode, pool ] of Object.entries( condenserConf.outputs ) ) {
	if ( biomeCode == 'sulphuricocean' ) {
		// Sulphur Sea planets are disabled (no longer generated for new players), no need to show them.
		continue;
	}


	if ( typeof( pool ) == 'string' ) {
		// Alias, e.g. "moon_desert" : "moon".
		// This means that the output for "moon" will be used.
		outputsPerBiome[biomeCode] = { sameAsBiome: pool };
		continue;
	}

	// Calculate the chance for each item in "pool".
	// Atmospheric Condenser creates 1 random item every 2 seconds, so items in the same rarity
	// will compete with each other. The more items there are, the lower the chance of each.
	var outputs = {}

	for ( var subpool of pool ) {
		var chanceOfOneItem = 100. * condenserWeights[subpool.weight] / sumOfWeights;
		chanceOfOneItem /= subpool.items.length; // Competition

		for ( var ItemCode of subpool.items ) {
			var chance = chanceOfOneItem;
			if ( outputs[ItemCode] ) {
				// Some biomes have the same item in "common" and "rare" pools
				// (for example, Carbon for "moon" biome).
				chance += outputs[ItemCode].chance;
			}

			outputs[ItemCode] = { chance: chance };
		}
	}

	outputsPerBiome[biomeCode] = outputs;
}

for ( var [ biomeCode, outputs ] of Object.entries( outputsPerBiome ) ) {
	if ( outputs.sameAsBiome ) {
		// TODO: instead of showing duplicate recipes for Moon and Rocky Moon,
		// show this recipe once with "Air (Moon, Rocky Moon planets)" as input.
		outputs = outputsPerBiome[outputs.sameAsBiome];
	}

	var wikitext = 'Air (normal planets)';

	var biomeName = planetTypeNames[biomeCode];
	if ( biomeName ) {
		wikitext = 'Air ([[' + biomeName  + ']] planets)';
	}

	var inputs = {}
	inputs['PSEUDO_ITEM'] = { wikitext: wikitext };

	RecipeDatabase.add( 'Atmospheric Condenser', inputs, outputs );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 6: Add crafting recipes into RecipeDatabase ------------------------------------------ */
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
		wikitext += '|category = ' + util.cleanDescription( item.category ) + '\n';
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
