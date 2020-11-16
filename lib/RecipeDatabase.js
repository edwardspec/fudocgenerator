/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 * Usage: first you add recipes via add(). Then you use makeSearchIndex().
 */

'use strict';

const { Recipe, RecipeSide, RecipeSearchIndex, CraftingStationDatabase, AssetDatabase,
	ItemDatabase, LiquidDatabase, TreasurePoolDatabase, MonsterDatabase,
	BiomeDatabase, MaterialDatabase,
	config, util } = require( '.' );

class RecipeDatabase {
	constructor() {
		this.loaded = false;

		// Array of all known recipes.
		this.knownRecipes = [];
	}

	/**
	 * Load all recipes (crafting, extraction, etc.) into this RecipeDatabase.
	 */
	load() {
		// TODO: add recipes from other Stations (if any).
		// No Honey Jarring Machine for now, because its recipes are not in JSON (they are in Lua script).

		// Extractions (recipes that convert N items into M items) of Extraction Lab and similar buildings.
		this.loadExtractionLab();
		this.loadMixer();
		this.loadXenoLab();
		this.loadErchiusConverter();
		this.loadEmbalming();
		this.loadPsiAmplifier();

		// Unlocking Techs in Tricorder.
		this.loadTricorderTechs();

		// Centrifugations (consuming 1 input item has A% to produce item M, B% to produce item N, etc.)
		// This is used not only by liquid centrifuges, but also by items like Sifter and Rock Crusher.
		this.loadCentrifuges();

		// Smelters consume 2 of input item and produce 1 of item item, plus chance-based bonus outputs.
		this.loadSmelters();

		// Atmospheric Condenser produces 1 randomly chosen item from the weighted list of possible items.
		this.loadAtmosphericCondenser();

		// Liquid Collector produces 1 of some liquid every N seconds.
		this.loadLiquidCollector();

		// Recipes of "crafting station" buildings. They consume input items and give output items.
		this.loadCraftingRecipes();

		// "Pixels for item" recipes for shops (like Infinity Express)
		this.loadPixelShops();

		// Outputs of items that can be "harvested": crop seeds, Moth Trap, Bug House, etc.
		this.loadHarvestableItems();

		// Outputs of Farm Beasts and other monsters that can be "harvested" (e.g. Cottonbop).
		this.loadHarvestableMonsters();

		// Outputs of bees.
		this.loadBees();

		// Which blocks can be found in which biomes.
		// TODO: this is disabled until we have biome articles. Re-enable if/when we can autogenerate them.
		// this.loadBiomeBlocks();

		// When upgrading a building, it gets replaced by better building, and N input items are consumed.
		this.loadBuildingUpgrades();

		// Wells (buildings like Water Generator, Lobster Trap, etc.) periodically produce items.
		this.loadWells();

		util.log( '[info] RecipeDatabase: found ' + this.knownRecipes.length + ' recipes.' );
		this.loaded = true;
	}

	/**
	 * Load all recipes of Extraction Lab and its upgrades.
	 */
	loadExtractionLab() {
		AssetDatabase.getData( 'objects/generic/extractionlab_recipes.config' ).forEach( ( extractorRecipe ) => {
			config.extractorStageBuildings.forEach( ( buildingName, extractorStage ) => {
				var inputs = RecipeSide.newFromExtraction( extractorRecipe.inputs, extractorStage ),
					outputs = RecipeSide.newFromExtraction( extractorRecipe.outputs, extractorStage );

				this.add( buildingName, inputs, outputs );

				if ( extractorRecipe.reversible ) {
					// This is currently only used for Nitrogen <-> Liquid Nitrogen
					this.add( buildingName, outputs, inputs );
				}
			} );
		} );
	}

	/**
	 * Load all recipes of Liquid Mixer.
	 */
	loadMixer() {
		AssetDatabase.getData( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' ).forEach( ( mixerRecipe ) => {
			this.add(
				'Liquid Mixer',
				RecipeSide.newFromExtraction( mixerRecipe.inputs ),
				RecipeSide.newFromExtraction( mixerRecipe.outputs )
			);
		} );
	}

	/**
	 * Load all recipes of Xeno Research Lab.
	 */
	loadXenoLab() {
		AssetDatabase.getData( 'objects/generic/xenostation_recipes.config' ).forEach( ( xenolabRecipe ) => {
			this.add(
				'Xeno Research Lab',
				RecipeSide.newFromExtraction( xenolabRecipe.inputs ),
				RecipeSide.newFromExtraction( xenolabRecipe.outputs )
			);
		} );
	}

	/**
	 * Load all recipes of Erchius Converter.
	 */
	loadErchiusConverter() {
		AssetDatabase.getData( 'objects/minibiome/precursor/precursorconverter/console.object' ).recipeTable.forEach( ( converterRecipe ) => {
			var outputs = RecipeSide.newFromExtraction( converterRecipe.outputs );
			outputs.setSecondsToCraft( converterRecipe.time );

			this.add(
				'Erchius Converter',
				RecipeSide.newFromExtraction( converterRecipe.inputs ),
				outputs
			);
		} );
	}

	/**
	 * Load all recipes of Autopsy Table.
	 */
	loadEmbalming() {
		AssetDatabase.getData( 'objects/minibiome/elder/embalmingtable/embalmingtable_recipes.config' ).forEach( ( embalmingRecipe ) => {
			this.add(
				'Autopsy Table',
				RecipeSide.newFromExtraction( embalmingRecipe.inputs ),
				RecipeSide.newFromExtraction( embalmingRecipe.outputs )
			);
		} );
	}

	/**
	 * Load all recipes of Psionic Amplifier
	 */
	loadPsiAmplifier() {
		AssetDatabase.getData( 'objects/generic/extractionlabmadness_recipes.config' ).forEach( ( psiAmplifierRecipe ) => {
			this.add(
				'Psionic Amplifier',
				// This station is Tier 3 (extractorStage=2). Stage=0 is used for Tier 1 extractors.
				RecipeSide.newFromExtraction( psiAmplifierRecipe.inputs, 2 ),
				RecipeSide.newFromExtraction( psiAmplifierRecipe.outputs, 2 )
			);
		} );
	}

	/**
	 * Add prices to unlock a personal tech (such as Magnet Grip II) in the Personal Tricorder.
	 */
	loadTricorderTechs() {
		AssetDatabase.getData( 'interface/scripted/techshop/techshop.config' ).techs.forEach( ( tech ) => {
			this.add(
				'Personal Tricorder',
				RecipeSide.newFromCraftingInput( tech.recipe ),
				RecipeSide.newEmpty().addItem( tech.item )
			);
		} );
	}

	/**
	 * Load all recipes of Centrifuges, Sifters and Rock Crushers.
	 */
	loadCentrifuges() {
		var centrifugeConf = AssetDatabase.getData( 'objects/generic/centrifuge_recipes.config' );

		for ( var [ recipeGroup, buildingName ] of Object.entries( config.centrifugeRecipeGroups ) ) {
			for ( var [ inputItem, outputToRarityMap ] of Object.entries( centrifugeConf[recipeGroup] || {} ) ) {
				if ( recipeGroup === 'itemMapFarm' && inputItem === 'liquidwater' ) {
					// Ignore farm recipe for Water, because it is overridden in non-Wooden Centrifuges,
					// and we don't show Wooden Centrifuge anyway.
					// (this is the only situation where such override exists)
					continue;
				}

				var outputs = new RecipeSide();
				for ( var [ outputItem, rarityInfo ] of Object.entries( outputToRarityMap ) ) {
					outputs.addItem( outputItem, { rarity: rarityInfo } );
				}

				var inputs = RecipeSide.newEmpty().addItem( inputItem );

				this.add( buildingName, inputs, outputs );
			}
		}
	}

	/**
	 * Load all recipes of ore-smelting items like Arc Smelter.
	 */
	loadSmelters() {
		var smelterBuildings = {
			'Electric Furnace': AssetDatabase.getData( 'objects/power/electricfurnace/electricfurnace.object' ),
			'Blast Furnace': AssetDatabase.getData( 'objects/power/fu_blastfurnace/fu_blastfurnace.object' ),
			'Arc Smelter': AssetDatabase.getData( 'objects/power/isn_arcsmelter/isn_arcsmelter.object' )
		};

		for ( var [ buildingName, buildingConf ] of Object.entries( smelterBuildings ) ) {
			for ( var [ inputItem, outputItem ] of Object.entries( buildingConf.inputsToOutputs ) ) {
				var bonusOutputs = buildingConf.bonusOutputs[inputItem] || [];

				var inputs = new RecipeSide();
				inputs.addItem( inputItem, { count: 2 } ); // Base output for smelters is 2 Ore -> 1 Bar.

				var outputs = new RecipeSide();
				outputs.addItem( outputItem, { count: 1 } );

				for ( var [ bonusOutputItem, percent ] of Object.entries( bonusOutputs ) ) {
					outputs.addItem( bonusOutputItem, { chance: percent } );
				}

				this.add( buildingName, inputs, outputs );
			}
		}
	}

	/**
	 * Add outputs of Atmospheric Condenser in different biomes.
	 */
	loadAtmosphericCondenser() {
		var condenserConf = AssetDatabase.getData( 'objects/power/isn_atmoscondenser/isn_atmoscondenser.object' );

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
			var outputs = new RecipeSide();

			for ( var subpool of pool ) {
				var chanceOfOneItem = 100. * condenserWeights[subpool.weight] / sumOfWeights;
				chanceOfOneItem /= subpool.items.length; // Competition

				for ( var ItemCode of subpool.items ) {
					outputs.addItem( ItemCode, { chance: chanceOfOneItem } );
				}
			}

			outputsPerBiome[biomeCode] = outputs;
		}

		for ( var [ biomeCode, outputs ] of Object.entries( outputsPerBiome ) ) {
			// It's possible that multiple biomes have the same output, e.g. 'Rocky Moon' and 'Lunar'.
			// Create a string like "[[Rocky Moon]] planets, [[Lunar]] planets, ..." for all these biomes.
			// Note that some biomes have the same name (e.g. "fugasgiant1" and "fugasgiant2" are Gas Giant).
			var allBiomeCodes = [ biomeCode ].concat( sameOutputBiomes[biomeCode] || [] );

			var inputs = new RecipeSide();
			inputs.addPseudoItem( 'Air', { planets: allBiomeCodes } );

			this.add( 'Atmospheric Condenser', inputs, outputs );
		}
	}

	/**
	 * Add outputs of Liquid Collector in different biomes.
	 */
	loadLiquidCollector() {
		var liquidCollectorConf = AssetDatabase.getData( 'objects/power/fu_liquidcondenser/fu_liquidcondenser.object' );
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

			var inputs = new RecipeSide();
			inputs.addPseudoItem( 'Air', { planets: [ biomeCode ] } );

			var outputs = new RecipeSide();
			outputs.addItem( item.itemCode, { secondsToCraft: output.cooldown } );

			this.add( 'Liquid Collector', inputs, outputs );
		}
	}

	/**
	 * Load all "craft item" recipes of the regular crafting stations.
	 */
	loadCraftingRecipes() {
		AssetDatabase.forEach( 'recipe', ( filename, asset ) => {
			this.addNativeCraftingRecipe( asset.data, filename );
		} );
	}

	/**
	 * Load "pixels for item" recipes for shops (like Infinity Express).
	 */
	loadPixelShops() {
		var shops = {};
		shops['Geologist'] = AssetDatabase.getData( 'npcs/crew/crewmembergeologist.npctype' ).scriptConfig.crew;

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

				this.add( shopName,
					RecipeSide.newEmpty().addItem( 'money', { count: buyPrice } ),
					RecipeSide.newEmpty().addItem( soldItemCode, { count: 1 } )
				);
			} );
		}
	}

	/**
	 * Load all "crop seed -> produce" recipes, and also outputs of Moth Trap, Bug House, etc.
	 */
	loadHarvestableItems() {
		ItemDatabase.forEach( ( itemCode, data ) => {
			if ( !data.stages ) {
				// Not harvestable.
				return;
			}

			var station, inputs = new RecipeSide();
			if ( data.category === 'seed' ) {
				// Show this as a recipe for Growing Tray (which requires 3 seeds).
				// Growing the crops on soil has the same results.
				station = 'Growing Tray';
				inputs.addItem( itemCode, { count: 3 } );
			} else if ( data.scripts && data.scripts.includes( "/objects/scripts/harvestable.lua" ) ) {
				// These are objects like Moth Trap. They yield materials when player interacts with them.
				station = data.displayName;
				inputs.addPseudoItem( "''(per harvest)''" );
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

					if ( outputs.isEmpty() ) {
						util.log( '[warning] Nothing in treasurepool of ' + itemCode + ': ' + poolName );
						continue;
					}

					this.add( station, inputs, outputs );
				}
			}
		} );
	}

	/**
	 * Add "farm animal -> harvest" recipes
	 */
	loadHarvestableMonsters() {
		MonsterDatabase.forEach( ( monsterCode, monster ) => {
			var poolName = monster.baseParameters.harvestPool;
			if ( !poolName ) {
				return;
			}

			var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName );

			if ( outputs.isEmpty() ) {
				util.log( '[warning] Nothing in treasurepool of ' + monster.displayName + ': ' + poolName );
				return;
			}

			var inputs = new RecipeSide();
			inputs.addPseudoItem( '[[' + monster.displayName + ']]' );

			this.add( 'Farm Beasts', inputs, outputs );
		} );
	}

	/**
	 * Add "bee queen -> possible output" recipes
	 */
	loadBees() {
		var beeConf = AssetDatabase.getData( 'bees/beeData.config' );
		for ( var [ beeType, subtypes ] of Object.entries( beeConf.stats ) ) {
			subtypes.forEach( ( info ) => {
				var inputs = new RecipeSide();
				inputs.addItem( 'bee_' + beeType + '_queen', { subtype: info.name } );

				var outputs = new RecipeSide();
				for ( var [ itemCode, infrequency ] of Object.entries( info.production ) ) {
					outputs.addItem( itemCode, { infrequency: infrequency } );
				}

				this.add( 'Apiary', inputs, outputs );
			} );
		}
	}

	/**
	 * Add "which biome has which blocks" recipes.
	 */
	loadBiomeBlocks() {
		BiomeDatabase.forEach( ( biomeCode, biome ) => {
			var outputs = new RecipeSide();
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

				outputs.addItem( itemCode );
			}

			if ( outputs.isEmpty() ) {
				util.log( '[info] Biome ' + biomeCode + " doesn't have any blocks." );
				return;
			}

			var inputs = new RecipeSide();
			inputs.addPseudoItem( 'Land ({{BiomeLink|' + biome.friendlyName + '}})' );

			this.add( 'Matter Manipulator', inputs, outputs );
		} );
	}

	/**
	 * Add "upgrade this building" recipes (e.g. Armorworks -> Assembly Line).
	 */
	loadBuildingUpgrades() {
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

				var outputs = new RecipeSide();
				outputs.addItem( nextStage.itemCode, { count: 1 } );

				var inputs = new RecipeSide();
				inputs.addItem( prevStage.itemCode, { isBuildingToUpgrade: true } );

				// Add the crafting cost.
				inputs.addEverythingFrom( RecipeSide.newFromCraftingInput( upgradeMaterials ) );

				this.add( 'Upgrade crafting station', inputs, outputs );
			}
		} );
	}

	/**
	 * Add outputs of well-style buildings: Water Generator, Pest Trap, etc.
	 */
	loadWells() {
		ItemDatabase.forEach( ( itemCode, data ) => {
			var wellSlots = data.wellslots;
			if ( !wellSlots && data.wellConfig ) {
				wellSlots = data.wellConfig.wellSlots;
			}

			if ( !wellSlots ) {
				// Not a well.
				return;
			}

			var inputs = new RecipeSide();
			inputs.addPseudoItem( "''(over time)''" );

			var outputs = new RecipeSide();
			for ( var slot of wellSlots ) {
				outputs.addItem( slot.name );
			}

			this.add( data.displayName, inputs, outputs );
		} );
	}

	/*-----------------------------------------------------------------------------------------------*/

	/**
	 * Record the recipe into the database. This makes this recipe findable via search methods.
	 * See [Recipe.js] for meaning of parameters.
	 * @param {string} station
	 * @param {Object} inputs
	 * @param {Object} outputs
	 * @param {string} errorContext If the recipe is invalid, this will be included into error message.
	 */
	add( station, inputs, outputs, errorContext ) {
		var RecipeObject = new Recipe( station, inputs, outputs );

		// Sanity check. Prevent unchecked objects from being added into database.
		// Note: we are not throwing an exception (displaying tolerance to bad input),
		// because bad recipe likely means incomplete work-in-progress object from the mod,
		// and such "temporarily broken recipe" shouldn't stop this script from running.
		if ( !RecipeObject.isValid() ) {
			// Don't add.
			console.log( 'Invalid recipe found: ' +
				( errorContext ? errorContext + ' :' : '' ) +
				'[' + JSON.stringify( RecipeObject ) + ']' );
			return;
		}

		RecipeObject.outputs.compress();
		this.knownRecipes.push( RecipeObject );
	}

	/**
	 * Add the crafting recipe from *.recipe file.
	 * @param {object} loadedData Value returned by AssetDatabase.getData() for *.recipe file.
	 * @param {string} filename If the recipe is invalid, this will be included into error message.
	 */
	addNativeCraftingRecipe( loadedData, filename ) {
		var station = CraftingStationDatabase.findByGroups( loadedData.groups );
		if ( !station ) {
			// This recipe can't be crafted anywhere.
			return;
		}

		this.add( station,
			RecipeSide.newFromCraftingInput( loadedData.input ),
			RecipeSide.newFromCraftingInput( loadedData.output ),
			filename
		);
	}

	/**
	 * Returns an index that can be used to rapidly search the database.
	 * @return {RecipeSearchIndex}
	 */
	makeSearchIndex() {
		return new RecipeSearchIndex( this );
	}
}

module.exports = new RecipeDatabase();
