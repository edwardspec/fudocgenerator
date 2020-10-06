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
	ResearchTreeDatabase = require( './lib/ResearchTreeDatabase' ),
	TreasurePoolDatabase = require( './lib/TreasurePoolDatabase' ),
	MonsterDatabase = require( './lib/MonsterDatabase' ),
	AssetDatabase = require( './lib/AssetDatabase' ),
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
	planetTypeNames = util.loadModFile( 'interface/cockpit/cockpit.config' ).planetTypeNames,
	geologistNpcConf = util.loadModFile( 'npcs/crew/crewmembergeologist.npctype' ),
	techshopConf = util.loadModFile( 'interface/scripted/techshop/techshop.config' );

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

for ( var tech of techshopConf.techs ) {
	RecipeDatabase.add(
		'Personal Tricorder',
		util.craftingInputToRecipeInput( tech.recipe ),
		{ [tech.item]: {} }
	);
}

/*-------------------------------------------------------------------------------------------- */
/* Step 3: Add recipes from Centrifuges into RecipeDatabase ---------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var [ recipeGroup, buildingName ] of Object.entries( config.centrifugeRecipeGroups ) ) {
	for ( var [ inputItem, outputToRarityMap ] of Object.entries( centrifugeConf[recipeGroup] || {} ) ) {
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

// Format: { "moon": [ "moon_desert", "moon_toxic" ] }
// Records facts like "Desert Moon and Toxic Moon has the same outputs as Moon".
var sameOutputBiomes = {};

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
		var mainBiome = pool;

		if ( !sameOutputBiomes[mainBiome] ) {
			sameOutputBiomes[mainBiome] = [];
		}

		sameOutputBiomes[mainBiome].push( biomeCode );
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
	// It's possible that multiple biomes have the same output, e.g. 'Rocky Moon' and 'Lunar'.
	// Create a string like "[[Rocky Moon]] planets, [[Lunar]] planets, ..." for all these biomes.
	// Note that some biomes have the same name (e.g. "fugasgiant1" and "fugasgiant2" are Gas Giant).
	var allBiomeCodes = [ biomeCode ].concat( sameOutputBiomes[biomeCode] || [] ),
		allBiomeNames = allBiomeCodes.map( ( thisBiomeCode ) => planetTypeNames[thisBiomeCode] ),
		uniqueBiomeNames = Array.from( new Set( allBiomeNames ) ),
		allBiomeLinks = uniqueBiomeNames.map( ( biomeName ) => {
			return ( biomeName ? ( '[[' + biomeName + ']]' ) : 'normal' );
		} );

	var wikitext = 'Air (' + allBiomeLinks.join( ', ') + ' planets)';

	var inputs = {}
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: wikitext };

	RecipeDatabase.add( 'Atmospheric Condenser', inputs, outputs );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 6: Add crafting recipes into RecipeDatabase ------------------------------------------ */
/*-------------------------------------------------------------------------------------------- */

AssetDatabase.forEach( ( filename, asset ) => {
	if ( asset.type === 'recipe' ) {
		RecipeDatabase.addNativeCraftingRecipe( asset.data );
	}
} );

/*-------------------------------------------------------------------------------------------- */
/* Step 7: Add "pixels for item" recipes for shops (like Infinity Express) into RecipeDatabase */
/*-------------------------------------------------------------------------------------------- */

var shops = { 'Geologist': geologistNpcConf.scriptConfig.crew };

ItemDatabase.forEach( ( itemCode, data ) => {
	if ( data.interactAction !== 'OpenMerchantInterface' || !data.interactData.items ) {
		// Not a merchant.
		// This also skips Biggy's Reputable Weaponry (vanilla shop), because it sells random items.
		return;
	}

	shops[data.displayName] = data;
} );

for ( var [ shopName, data ] of Object.entries( shops ) ) {
	data.interactData.items.forEach( ( shopSlot ) => {
		var soldItemCode = shopSlot.item,
			soldItem = ItemDatabase.find( soldItemCode );
		if ( !soldItem ) {
			// Some shops sell items from other mods, e.g. "impvase3" in "Forum Decorum" shop.
			util.warnAboutUnknownItem( soldItemCode );
			return;
		}

		var buyPrice = Math.ceil( ( shopSlot.price || soldItem.price ) * data.interactData.buyFactor );

		RecipeDatabase.add( shopName,
			{ money: { count: buyPrice } },
			{ [ soldItemCode ]: { count: 1 } }
		);
	} );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 8: Add "crop seed -> produce" recipes, "farm animal -> harvest" recipes                */
/*-------------------------------------------------------------------------------------------- */

ItemDatabase.forEach( ( itemCode, data ) => {
	if ( data.category !== 'seed' || !data.stages ) {
		// Not a seed.
		return;
	}

	for ( var stage of data.stages ) {
		var poolName = stage.harvestPool;
		if ( poolName ) {
			var outputs = {};
			for ( var possibleItemCode of TreasurePoolDatabase.getPossibleItems( poolName ) ) {
				if ( possibleItemCode === itemCode ) {
					// Don't show the seed itself. All plants return their own seed, so this information is useless.
					continue;
				}

				// Currently not collecting the information on weights or counts.
				// Simply saying "seed A results in crops B, C, D" without showing "how many of them".
				outputs[possibleItemCode] = {};
			}

			if ( Object.keys( outputs ).length === 0 ) {
				util.log( '[warning] Nothing in treasurepool of ' + itemCode + ': ' + poolName );
				continue;
			}

			// Show this as a recipe for Growing Tray (which requires 3 seeds).
			// Growing the crops on soil has the same results.
			RecipeDatabase.add( 'Growing Tray', { [itemCode]: { count: 3 } }, outputs );
		}
	}
} );

MonsterDatabase.forEach( ( monsterCode, monster ) => {
	var poolName = monster.baseParameters.harvestPool;
	if ( !poolName ) {
		return;
	}

	var possibleItems = TreasurePoolDatabase.getPossibleItems( poolName );
	if ( possibleItems.length === 0 ) {
		util.log( '[warning] Nothing in treasurepool of ' + monster.displayName + ': ' + poolName );
		return;
	}

	var outputs = {};
	for ( var possibleItemCode of TreasurePoolDatabase.getPossibleItems( poolName ) ) {
		outputs[possibleItemCode] = {};
	}

	var inputs = {}
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: '[[' + monster.displayName + ']]' };

	RecipeDatabase.add( 'Farm Beasts', inputs, outputs );
} );

/*-------------------------------------------------------------------------------------------- */

/*-------------------------------------------------------------------------------------------- */

// Generate the wikitext for each item that has at least 1 Recipe.
// Then send the results to ResultsWriter.write().
var SearchIndex = RecipeDatabase.makeSearchIndex();

for ( var ItemCode of SearchIndex.listKnownItems() ) {
	var item = ItemDatabase.find( ItemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		util.warnAboutUnknownItem( ItemCode );
		continue;
	}

	// Generate Cargo database of all known items.
	ResultsWriter.writeIntoCargoDatabase( util.itemToCargoDatabase( item ) );

	// Legacy: overwrite [[Template:Automatic item info/NameOfItemHere]].

	var wikitext = '{{All recipes for item|id=' + ItemCode + '|name=' + item.displayName + '}}\n';
	ResultsWriter.write( item.wikiPageName, wikitext, ItemCode );

	// Add discovered icon of this item (small PNG image) into "upload these icons" list.
	var iconPath = item.inventoryIconPath;
	if ( iconPath ) {
		ResultsWriter.writeToUploadThisList( ItemCode, iconPath );
	}
}

// Generate Cargo database of all known recipes.
for ( var Recipe of RecipeDatabase.knownRecipes ) {
	ResultsWriter.writeIntoCargoDatabase( Recipe.toCargoDatabase() );
}

// Generate Cargo database of all research nodes.
ResearchTreeDatabase.forEach( ( node ) => {
	ResultsWriter.writeIntoCargoDatabase( util.researchNodeToCargoDatabase( node ) );
} );

ResultsWriter.finalize();
