/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

const { config, AssetDatabase, ItemDatabase, RecipeDatabase, ResearchTreeDatabase,
		TreasurePoolDatabase, MonsterDatabase, BiomeDatabase, LiquidDatabase, MaterialDatabase,
		ResultsWriter, RecipeSide, util } = require( './lib' );

// Load configs of all processing stations.
// NOTE: centrifugeConf covers not only centrifuges, but also powder sifters, etc.
const centrifugeConf = util.loadModFile( 'objects/generic/centrifuge_recipes.config' ),
	extractorConf = util.loadModFile( 'objects/generic/extractionlab_recipes.config' ),
	blastFurnaceConf = util.loadModFile( 'objects/power/fu_blastfurnace/fu_blastfurnace.object' ),
	arcSmelterConf = util.loadModFile( 'objects/power/isn_arcsmelter/isn_arcsmelter.object' ),
	mixerConf = util.loadModFile( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' ),
	xenolabConf = util.loadModFile( 'objects/generic/xenostation_recipes.config' ),
	erchiusConverterConf = util.loadModFile( 'objects/minibiome/precursor/precursorconverter/console.object' ),
	embalmingConf = util.loadModFile( 'objects/minibiome/elder/embalmingtable/embalmingtable_recipes.config' ),
	psiAmplifierConf = util.loadModFile( 'objects/generic/extractionlabmadness_recipes.config' ),
	condenserConf = util.loadModFile( 'objects/power/isn_atmoscondenser/isn_atmoscondenser.object' ),
	liquidCollectorConf = util.loadModFile( 'objects/power/fu_liquidcondenser/fu_liquidcondenser.object' ),
	geologistNpcConf = util.loadModFile( 'npcs/crew/crewmembergeologist.npctype' ),
	techshopConf = util.loadModFile( 'interface/scripted/techshop/techshop.config' ),
	beeConf = util.loadModFile( 'bees/beeData.config' );

// TODO: add recipes from other Stations (if any).
// No Honey Jarring Machine for now, because its recipes are not in JSON (they are in Lua script).

/*-------------------------------------------------------------------------------------------- */
/* Step 1: Add recipes from Extractors into RecipeDatabase ----------------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var extractorRecipe of extractorConf ) {
	config.extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		var inputs = RecipeSide.newFromExtraction( extractorRecipe.inputs, extractorStage ),
			outputs = RecipeSide.newFromExtraction( extractorRecipe.outputs, extractorStage );

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
		RecipeSide.newFromExtraction( mixerRecipe.inputs ),
		RecipeSide.newFromExtraction( mixerRecipe.outputs )
	);
}

for ( var xenolabRecipe of xenolabConf ) {
	RecipeDatabase.add(
		'Xeno Research Lab',
		RecipeSide.newFromExtraction( xenolabRecipe.inputs ),
		RecipeSide.newFromExtraction( xenolabRecipe.outputs )
	);
}

for ( var converterRecipe of erchiusConverterConf.recipeTable ) {
	var outputs = RecipeSide.newFromExtraction( converterRecipe.outputs );
	Object.values( outputs )[0].secondsToCraft = converterRecipe.time;

	RecipeDatabase.add(
		'Erchius Converter',
		RecipeSide.newFromExtraction( converterRecipe.inputs ),
		outputs
	);
}

for ( var embalmingRecipe of embalmingConf ) {
	RecipeDatabase.add(
		'Autopsy Table',
		RecipeSide.newFromExtraction( embalmingRecipe.inputs ),
		RecipeSide.newFromExtraction( embalmingRecipe.outputs )
	);
}

for ( var psiAmplifierRecipe of psiAmplifierConf ) {
	RecipeDatabase.add(
		'Psionic Amplifier',
		// This station is Tier 3 (extractorStage=2). Stage=0 is used for Tier 1 extractors.
		RecipeSide.newFromExtraction( psiAmplifierRecipe.inputs, 2 ),
		RecipeSide.newFromExtraction( psiAmplifierRecipe.outputs, 2 )
	);
}

for ( var tech of techshopConf.techs ) {
	RecipeDatabase.add(
		'Personal Tricorder',
		RecipeSide.newFromCraftingInput( tech.recipe ),
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
	var allBiomeCodes = [ biomeCode ].concat( sameOutputBiomes[biomeCode] || [] );

	var inputs = {};
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: 'Air', planets: allBiomeCodes };

	RecipeDatabase.add( 'Atmospheric Condenser', inputs, outputs );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 5.1: Add outputs of Luquid Collector into RecipeDatabase ----------------------------- */
/*-------------------------------------------------------------------------------------------- */

for ( var [ biomeCode, output ] of Object.entries( liquidCollectorConf.liquids ) ) {
	var liquid = LiquidDatabase.find( output.liquid );
	if ( !liquid ) {
		util.log( '[error] Unknown liquid in outputs of Liquid Collector: ' + output.liquid );
		continue;
	}

	var item = ItemDatabase.find( liquid.itemDrop );
	if ( !item ) {
		util.log( '[error] Liquid #' + output.liquid + ' drops unknown item ' + liquid.itemDrop + ' when collected.' );
		continue;
	}

	var inputs = {};
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: 'Air', planets: [ biomeCode ] };

	var outputs = {};
	outputs[item.itemCode] = { secondsToCraft: output.cooldown };

	RecipeDatabase.add( 'Liquid Collector', inputs, outputs );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 6: Add crafting recipes into RecipeDatabase ------------------------------------------ */
/*-------------------------------------------------------------------------------------------- */

AssetDatabase.forEach( 'recipe', ( filename, asset ) => {
	RecipeDatabase.addNativeCraftingRecipe( asset.data, filename );
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
/* Step 8: Add "crop seed -> produce" recipes, and also outputs of Moth Trap, Bug House, etc.  */
/*-------------------------------------------------------------------------------------------- */

ItemDatabase.forEach( ( itemCode, data ) => {
	if ( !data.stages ) {
		// Not harvestable.
		return;
	}

	var station, inputs;
	if ( data.category === 'seed' ) {
		// Show this as a recipe for Growing Tray (which requires 3 seeds).
		// Growing the crops on soil has the same results.
		station = 'Growing Tray';
		inputs = { [itemCode]: { count: 3 } };
	} else if ( data.scripts && data.scripts.includes( "/objects/scripts/harvestable.lua" ) ) {
		// These are objects like Moth Trap. They yield materials when player interacts with them.
		station = data.displayName;
		inputs = { PSEUDO_ITEM: { displayNameWikitext: "''(per harvest)''" } };
	} else {
		// Not harvestable.
		return;
	}

	for ( var stage of data.stages ) {
		var poolName = stage.harvestPool;
		if ( poolName ) {
			// Note: we don't show the seed itself (specifying it as second parameter to exclude it).
			// All plants return their own seed, so this information is useless.
			var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName, itemCode );

			if ( Object.keys( outputs ).length === 0 ) {
				util.log( '[warning] Nothing in treasurepool of ' + itemCode + ': ' + poolName );
				continue;
			}

			RecipeDatabase.add( station, inputs, outputs );
		}
	}
} );

/*-------------------------------------------------------------------------------------------- */
/* Step 9: Add "farm animal -> harvest" recipes                                                */
/*-------------------------------------------------------------------------------------------- */

MonsterDatabase.forEach( ( monsterCode, monster ) => {
	var poolName = monster.baseParameters.harvestPool;
	if ( !poolName ) {
		return;
	}

	var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName );

	if ( Object.keys( outputs ).length === 0 ) {
		util.log( '[warning] Nothing in treasurepool of ' + monster.displayName + ': ' + poolName );
		return;
	}

	var inputs = {}
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: '[[' + monster.displayName + ']]' };

	RecipeDatabase.add( 'Farm Beasts', inputs, outputs );
} );

/*-------------------------------------------------------------------------------------------- */
/* Step 10: Add "bee queen -> possible output" recipes                                         */
/*-------------------------------------------------------------------------------------------- */

for ( var [ beeType, subtypes ] of Object.entries( beeConf.stats ) ) {
	subtypes.forEach( ( info ) => {
		var inputs = {};
		inputs['bee_' + beeType + '_queen'] = { subtype: info.name };

		var outputs = {};
		for ( var [ itemCode, infrequency ] of Object.entries( info.production ) ) {
			// We don't collect the weights of items yet, only the list of possible items.
			outputs[itemCode] = { infrequency: infrequency };
		}

		RecipeDatabase.add( 'Apiary', inputs, outputs );
	} );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 11: Add "which biome has which blocks" recipes - DISABLED until we have biome articles */
/*-------------------------------------------------------------------------------------------- */
if ( 0 ) { // TODO: re-enable if/when we can autogenerate pages about biomes.
BiomeDatabase.forEach( ( biomeCode, biome ) => {
	var outputs = {};
	for ( var materialName of [ biome.mainBlock ].concat( biome.subBlocks || [] ) ) {
		if ( !materialName ) {
			continue;
		}

		var material = MaterialDatabase.find( materialName );
		if ( !material ) {
			util.log( '[error] Biome ' + biomeCode + ' refers to unknown block: ' + materialName );
			continue;
		}

		var itemCode = material.itemDrop;
		if ( !itemCode ) {
			// Unobtainable block like Dead Moon Core.
			continue;
		}

		outputs[itemCode] = {};
	}

	if ( Object.keys( outputs ).length === 0 ) {
		util.log( '[info] Biome ' + biomeCode + " doesn't have any blocks." );
		return;
	}

	var inputs = {};
	inputs['PSEUDO_ITEM'] = { displayNameWikitext: 'Land ({{BiomeLink|' + biome.friendlyName + '}})' };

	RecipeDatabase.add( 'Matter Manipulator', inputs, outputs );
} );
}

/*-------------------------------------------------------------------------------------------- */
/* Step 12: Add "upgrade this building" recipes (e.g. Armorworks -> Assembly Line)             */
/*-------------------------------------------------------------------------------------------- */

ItemDatabase.forEach( ( itemCode, item ) => {
	var stages = item.upgradedItems;
	if ( !stages ) {
		return;
	}

	for ( var i = 0; i < stages.length - 1; i ++ ) {
		var prevStage = stages[i];
		var nextStage = stages[i + 1];

		var upgradeMaterials = prevStage.interactData.upgradeMaterials;
		if ( i == 0 ) {
			// For stage 1 buildings: use the main item instead of pseudo-item of stage 1.
			prevStage = item;
		}

		var outputs = {};
		outputs[nextStage.itemCode] = { count: 1 };

		var inputs = {};
		inputs[prevStage.itemCode] = { isBuildingToUpgrade: true };

		// Add the crafting cost.
		Object.assign( inputs, RecipeSide.newFromCraftingInput( upgradeMaterials ) );

		RecipeDatabase.add( 'Upgrade crafting station', inputs, outputs );
	}
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

	ResultsWriter.writeItem( item );
}

// Generate Cargo database of all known recipes.
for ( var Recipe of RecipeDatabase.knownRecipes ) {
	ResultsWriter.writeRecipe( Recipe );
}

// Generate Cargo database of all research nodes.
ResearchTreeDatabase.forEach( ( node ) => {
	ResultsWriter.writeResearchNode( node );
} );

ResultsWriter.finalize();
