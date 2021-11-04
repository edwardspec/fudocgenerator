'use strict';

const { Recipe, RecipeSide, CraftingStationDatabase, AssetDatabase,
	ItemDatabase, LiquidDatabase, TreasurePoolDatabase, MonsterDatabase, TenantDatabase,
	BiomeDatabase, MaterialDatabase, SaplingDatabase, RemoveBadSymbols,
	config, util } = require( '.' );

/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 */
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

		// Extractions (recipes that convert N items into M items) of Extraction Lab and similar buildings.
		this.loadExtractionLab();
		this.loadMixer();
		this.loadXenoLab();
		this.loadErchiusConverter();
		this.loadEmbalming();
		this.loadPsiAmplifier();
		this.loadHoneyJarrer();

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

		// Drops from chopping a tree.
		this.loadSaplings();

		// Monster drops (items that have a chance to drop when a monster gets defeated),
		// as well as outputs of Farm Beasts and other monsters that can be "harvested" (e.g. Cottonbop).
		this.loadMonsterDrops();

		// Outputs of bees.
		this.loadBees();

		// "Monster egg (item) -> monster" recipes.
		this.loadIncubator();

		// "Baby monster -> monster" recipes.
		this.loadMonsterEvolutions();

		// "Spawning item (for robot or monster) -> monster" recipes.
		this.loadBotSpawners();

		// What items are inside "openable reward" items (like "Alpine Set Bundle").
		this.loadMysteriousRewardContents();

		// Which blocks can be found in which biomes.
		this.loadBiomeBlocks();

		// Which monsters can be found in which biomes.
		this.loadBiomeMonsters();

		// Which placeables (chests, seeds, trees, etc.) can be found in which biomes.
		this.loadBiomePlaceables();

		// "Terraformer (item) -> biome" recipes.
		this.loadTerraformers();

		// When upgrading a building, it gets replaced by better building, and N input items are consumed.
		this.loadBuildingUpgrades();
		this.loadItemUpgrades();

		// Wells (buildings like Water Generator, Lobster Trap, etc.) periodically produce items.
		this.loadWells();

		// Fuel pseudo-recipes (amount of fuel => produced power)
		this.loadQuantumFuels();
		this.loadCombustionFuels();
		this.loadFissionFuels();
		this.loadHydraulicFuels();
		this.loadFusionFuels();

		// "Tenant -> possible rent" recipes.
		this.loadTenantRent();

		// "Treasure pool -> contents" recipes,
		// but only for pools that were mentioned in "outputs" of recipes that we already loaded earlier.
		this.loadTreasurePoolsFromOtherRecipes();

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
	 * Load all recipes of Erchius Converter and Faulty Erchius Converter.
	 */
	loadErchiusConverter() {
		for ( var converterItemCode of [ 'precursorconverter', 'precursorconverter2' ] ) {
			var converter = ItemDatabase.find( converterItemCode );
			converter.recipeTable.forEach( ( converterRecipe ) => {
				var outputs = RecipeSide.newFromExtraction( converterRecipe.outputs );
				outputs.setSecondsToCraft( converterRecipe.time );

				this.add(
					converter.displayName,
					RecipeSide.newFromExtraction( converterRecipe.inputs ),
					outputs
				);
			} );
		}
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
	 * Load all recipes of Honey Extractor and Honey Jarring Machine.
	 */
	loadHoneyJarrer() {
		AssetDatabase.getData( 'objects/generic/honeyjarrer_recipes.config' ).forEach( ( honeyJarrerRecipe ) => {
			this.add(
				'Honey Extractor',
				RecipeSide.newFromExtraction( honeyJarrerRecipe.inputs ),
				RecipeSide.newFromExtraction( honeyJarrerRecipe.outputs )
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
		for ( var smelterItemCode of [ 'electricfurnace', 'fu_blastfurnace', 'isn_arcsmelter' ] ) {
			var smelter = ItemDatabase.find( smelterItemCode );
			for ( var [ inputItem, outputItem ] of Object.entries( smelter.inputsToOutputs ) ) {
				var bonusOutputs = smelter.bonusOutputs[inputItem] || [];

				var inputs = new RecipeSide();
				inputs.addItem( inputItem, { count: 2 } ); // Base output for smelters is 2 Ore -> 1 Bar.

				var outputs = new RecipeSide();
				outputs.addItem( outputItem, { count: 1 } );

				for ( var [ bonusOutputItem, percent ] of Object.entries( bonusOutputs ) ) {
					outputs.addItem( bonusOutputItem, { chance: percent * smelter.fu_extraProductionChance } );
				}

				this.add( smelter.displayName, inputs, outputs );
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


			if ( typeof ( pool ) == 'string' ) {
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
				var chanceOfOneItem = 100.0 * condenserWeights[subpool.weight] / sumOfWeights;
				chanceOfOneItem /= subpool.items.length; // Competition

				for ( var ItemCode of subpool.items ) {
					outputs.addItem( ItemCode, { chance: chanceOfOneItem } );
				}
			}

			outputsPerBiome[biomeCode] = outputs;
		}

		for ( [ biomeCode, outputs ] of Object.entries( outputsPerBiome ) ) {
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
		shops.Geologist = AssetDatabase.getData( 'npcs/crew/crewmembergeologist.npctype' ).scriptConfig.crew;

		// "Lost and Found" trader in the Science Outpost.
		// TODO: if we need more merchants later, this should be moved to MerchantDatabase or something.
		var lostAndFoundPool = AssetDatabase.getData( 'npcs/merchantpools.config' ).fulostandfound[0][1];
		var lostAndFoundNpc = AssetDatabase.getData( 'npcs/scienceoutpost/lostandfoundnpc.npctype' );
		shops['Lost and Found'] = { interactData: {
			items: lostAndFoundPool,
			buyFactor: lostAndFoundNpc.scriptConfig.merchant.buyFactorRange[0]
		} };

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
					soldItemCount = 1;

				if ( typeof shopSlot.item == 'object' ) {
					if ( Array.isArray( shopSlot.item ) ) {
						// Vanilla: Terramart: [ 'hopsseed', 3 ]
						[ soldItemCode, soldItemCount ] = shopSlot.item;
					} else {
						// Vanilla: Ursa Miner: { name: 'silverpickaxe' }
						soldItemCode = shopSlot.item.name;
					}
				} else {
					// Most shops: item ID (string)
					soldItemCode = shopSlot.item;
				}

				var soldItem = ItemDatabase.find( soldItemCode );

				if ( !soldItem ) {
					// Some shops sell items from other mods, e.g. "impvase3" in "Forum Decorum" shop.
					util.warnAboutUnknownItem( soldItemCode );
					return;
				}

				var buyPrice = Math.ceil( ( shopSlot.price || soldItem.price ) * data.interactData.buyFactor );

				var inputs = new RecipeSide();
				inputs.addItem( 'money', { count: buyPrice * soldItemCount } );

				if ( shopSlot.prerequisiteQuest ) {
					inputs.addQuest( shopSlot.prerequisiteQuest );
				}

				var outputs = RecipeSide.newEmpty().addItem( soldItemCode, { count: soldItemCount } );
				this.add( shopName, inputs, outputs );
			} );
		}
	}

	/**
	 * Load all "openable reward item -> its contents" recipes (e.g. for "Alpine Set Bundle").
	 */
	loadMysteriousRewardContents() {
		ItemDatabase.forEach( ( itemCode, item ) => {
			if ( item.treasure ) {
				this.add(
					'Contents of openable box',
					RecipeSide.newEmpty().addItem( itemCode ),
					RecipeSide.newEmpty().addPool( item.treasure.pool )
				);
			}
		} );
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
			} else if ( data.scripts && data.scripts.includes( '/objects/scripts/harvestable.lua' ) ) {
				// These are objects like Moth Trap. They yield materials when player interacts with them.
				station = data.displayName;
				inputs.addPseudoItem( "''(per harvest)''" );
			} else {
				// Not harvestable.
				return;
			}

			var stageMinDurations = [],
				stageMaxDurations = [];

			for ( var stage of data.stages ) {
				var poolName = stage.harvestPool;
				if ( !poolName ) {
					var duration = stage.duration || [ 0, 0 ];
					stageMinDurations.push( duration[0] );
					stageMaxDurations.push( duration[1] );
				} else {
					var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName );
					var yieldsNoSeeds = false;

					if ( station === 'Growing Tray' ) {
						// Most plants return their own seed.
						// We move it to the bottom of the recipe, because produce items are more important.
						// Additionally, we make the item code of the seed "unlisted", hiding it from outputs=,
						// so that Corn Seed wouldn't appear in "How to obtain" section on the page Corn Seed.
						outputs = outputs.clone();
						yieldsNoSeeds = !outputs.hasItem( itemCode );

						outputs.makeItemUnlisted( itemCode );
						outputs.moveItemToBottom( itemCode );
					}

					if ( outputs.isEmpty() ) {
						util.log( '[warning] Nothing in treasurepool of ' + itemCode + ': ' + poolName );
						continue;
					}

					if ( yieldsNoSeeds ) {
						// Many crystal seeds are one-time use only and don't yield any seeds.
						// We should inform the player about this.
						outputs.addPseudoItem( "{{Red|Doesn't return the seed.}}" );
					}

					// Calculate time until next harvest.
					var isPerennial = ( stage.resetToStage !== undefined ),
						nextStage = stage.resetToStage || 0;

					var firstHarvestComment = '';
					if ( nextStage > 0 ) {
						firstHarvestComment = 'first harvest';
					} else if ( isPerennial ) {
						// Plant is perennial (doesn't require manual replanting),
						// but it returns to "just planted" stage (stage 0) after harvest.
						// Therefore "first harvest" and "regrowth" have the same time.
						firstHarvestComment = 'every harvest';
					}

					// Time between planting and first harvest.
					inputs.addTime(
						util.sum( stageMinDurations ),
						util.sum( stageMaxDurations ),
						firstHarvestComment
					);

					if ( nextStage > 0 ) {
						// Perennial plants only: time between two harvests.
						inputs.addTime(
							util.sum( stageMinDurations.slice( nextStage ) ),
							util.sum( stageMaxDurations.slice( nextStage ) ),
							'regrowth'
						);
					}

					this.add( station, inputs, outputs );
				}
			}
		} );
	}

	/**
	 * Add "stem/foliage of a tree -> drops when this tree gets chopped" recipes.
	 */
	loadSaplings() {
		SaplingDatabase.forEach( ( saplingPart ) => {
			this.add(
				'Drops from trees',
				RecipeSide.newEmpty().addSaplingPart( saplingPart.name, saplingPart.isFoliage ),
				saplingPart.drops
			);
		} );
	}

	/**
	 * Add: 1) "monster -> dropped items" recipes, 2) "farm animal -> harvest" recipes.
	 */
	loadMonsterDrops() {
		// All recipes that have BOTH the same poolName AND the same station (e.g. "Monster drops")
		// will be merged into one Recipe. (monsters will be added into existing "inputs" RecipeSide)
		// Format: { 'Monster drops': { poolName1: RecipeSide1, ... }, ... }
		var poolToInputs = {
			'Farm Beasts': {},
			'Monster drops': {},
			'Monster drops (hunting)': {}
		};

		// Map of poopType (1 for normal animals, 2 for robotic, 3 for lunar) to the list of monsters.
		var poopTypeToMonsters = {
			1: new RecipeSide().addComment( "'''Animal waste from:'''" ),
			2: new RecipeSide().addComment( "'''Animal waste from:'''" ),
			3: new RecipeSide().addComment( "'''Animal waste from:'''" )
		};

		MonsterDatabase.forEach( ( monster ) => {
			var pools = [
				{ station: 'Farm Beasts', poolName: monster.baseParameters.harvestPool }
			];
			if ( monster.dropPools.length > 0 ) {
				let normalPoolName, huntingPoolName;
				let poolOptions = monster.dropPools[0];

				if ( typeof ( poolOptions ) == 'string' ) {
					normalPoolName = poolOptions;
				} else {
					normalPoolName = poolOptions.default;
					huntingPoolName = poolOptions.bow;
				}

				pools.push( { station: 'Monster drops', poolName: normalPoolName } );

				// We omit hunting recipes if they use exactly the same pool as normal drops.
				if ( normalPoolName !== huntingPoolName ) {
					pools.push( { station: 'Monster drops (hunting)', poolName: monster.dropPools[0].bow } );
				}
			}

			for ( var dropInfo of pools ) {
				var poolName = dropInfo.poolName;
				if ( !poolName || poolName === 'empty' ) {
					continue;
				}

				var station = dropInfo.station;
				var inputs = poolToInputs[station][poolName];
				if ( inputs ) {
					// There is a recipe with other monster(s) but the same station AND poolName.
					// No need to create a new recipe, we can instead add this monster into existing recipe.
					inputs.addMonster( monster.type );
					continue;
				}

				var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName );
				if ( outputs.isEmpty() ) {
					util.log( '[warning] Nothing in treasurepool of ' + monster.displayName + ': ' + poolName );
					continue;
				}

				inputs = new RecipeSide();
				inputs.addMonster( monster.type );

				poolToInputs[station][poolName] = inputs;
				this.add( station, inputs, outputs );
			}

			if ( monster.baseParameters.harvestPool ) {
				// Remember the fact that this Farm Beast can poop.
				var poopType = monster.baseParameters.canPoop || '1';
				poopTypeToMonsters[poopType].addMonster( monster.type );
			}
		} );

		// Add poop recipes.
		this.add( 'Farm Beasts', poopTypeToMonsters['1'], RecipeSide.newEmpty()
			// Normal animal, e.g. Fluffalo.
			.addItem( 'poop' ).addItem( 'liquidwater' )
		);
		this.add( 'Farm Beasts', poopTypeToMonsters['2'], RecipeSide.newEmpty()
			// Robotic animal, e.g. Robot Hen.
			.addItem( 'ff_spareparts' ).addItem( 'liquidoil' )
		);
		this.add( 'Farm Beasts', poopTypeToMonsters['3'], RecipeSide.newEmpty()
			// Lunar animal (Erchibud).
			.addItem( 'supermatter' ).addItem( 'liquidfuel' )
		);
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
	 * Add "monster egg (item) -> monster" recipes.
	 */
	loadIncubator() {
		var incubatorConf = AssetDatabase.getData( 'objects/crafting/eggstra/eggincubator/eggincubator.object' );
		for ( var [ eggItemCode, hatchResults ] of Object.entries( incubatorConf.incubation ) ) {
			var [ monsterCode, secondsToHatch, successRate ] = hatchResults;

			var quantityAttributes = { secondsToCraft: secondsToHatch };
			if ( successRate < 1 ) {
				// Regular egg found in the kitchen (not to be confused with "Hen Egg" item)
				// has successRate=0.5, which means it has only 50% chance to hatch into a chicken.
				// Most eggs have successRate=1, so we don't show the chance for them.
				quantityAttributes.chance = successRate * 100;
			}

			var inputs = new RecipeSide();
			inputs.addItem( eggItemCode, { count: 1 } );

			var outputs = new RecipeSide();
			outputs.addMonster( monsterCode, quantityAttributes );

			this.add( 'Incubator', inputs, outputs );
		}
	}

	/**
	 * Add "baby monster -> monster" recipes.
	 */
	loadMonsterEvolutions() {
		MonsterDatabase.forEach( ( monster ) => {
			var parentType = monster.baseParameters.evolveType;
			if ( parentType ) {
				this.add( 'Monster evolution',
					RecipeSide.newEmpty().addMonster( monster.type ),
					RecipeSide.newEmpty().addMonster( parentType )
				);
			}
		} );
	}

	/**
	 * "Spawning item (for robot or monster) -> monster" recipes.
	 * For example, "madnessmegapoptop" item spawns "megatopmadnesspet" monster.
	 */
	loadBotSpawners() {
		ItemDatabase.forEach( ( itemCode, data ) => {
			var spawner = data.botspawner;
			if ( !spawner || !data.scripts ) {
				// Not a spawner.
				return;
			}

			var station;
			if ( data.scripts.includes( '/spawners/fubotspawner.lua' ) ) {
				station = 'Bot Pod';
			} else if ( data.scripts.includes( '/spawners/fuminionspawner.lua' ) ) {
				station = 'Dimensional Siphon';
			} else {
				util.log( '[warning] Item ' + itemCode + ' has unknown botspawner script.' );
				return;
			}

			this.add( station,
				RecipeSide.newEmpty().addItem( itemCode ),
				RecipeSide.newEmpty().addMonster( spawner.type )
			);
		} );
	}

	/**
	 * Add "which biome has which blocks" recipes.
	 */
	loadBiomeBlocks() {
		BiomeDatabase.forEach( ( biome ) => {
			var biomeCode = biome.biomeCode;
			var outputs = new RecipeSide();
			for ( var materialName of [ biome.mainBlock ].concat( biome.subBlocks || [] ) ) {
				if ( !materialName ) {
					continue;
				}

				var material = MaterialDatabase.findByName( materialName );
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
			inputs.addBiome( biomeCode, 'ground' );

			this.add( 'Biome blocks', inputs, outputs );
		} );
	}

	/**
	 * Add "which biome has which monsters" recipes.
	 */
	loadBiomeMonsters() {
		BiomeDatabase.forEach( ( biome ) => {
			var spawnProfile = biome.spawnProfile;
			if ( !spawnProfile || !Array.isArray( spawnProfile.groups ) ) {
				// Biome without any monsters (such as Tabula Rasa).
				return;
			}

			var inputs = new RecipeSide();
			inputs.addBiome( biome.biomeCode, 'monsters' );

			for ( var spawnGroup of spawnProfile.groups ) {
				var pool = spawnGroup.pool;
				if ( !Array.isArray( pool ) ) {
					// Non-unique monsters like "nightTerrors" or "generatedGround".
					continue;
				}

				var outputs = new RecipeSide();
				var optionsCount = pool.length;
				var selectedCount = spawnGroup.select;

				if ( selectedCount > optionsCount ) {
					util.log( '[warning] Biome ' + biome.biomeCode + ' wants to select ' + selectedCount +
						' monsters out of ' + optionsCount + '.' );
					selectedCount = optionsCount;
				}

				if ( optionsCount !== selectedCount ) {
					outputs.addComment( 'Any ' + selectedCount + ' of the following:' );
				} else if ( selectedCount > 1 ) {
					outputs.addComment( 'All of the following:' );
				}

				for ( var [ individualChance, spawnType ] of util.normalizeWeights( pool ) ) {
					// Value of "individualChance" would be a correct chance if we only rolled the dice once,
					// but we are trying to get "selectedCount" monsters from this pool (not just 1 monster),
					// so the resulting chances are higher. Let's calculate the resulting chance.
					// because individualChance is increasing on every roll. Actual result is even higher.
					var otherMonstersChance = 1 - individualChance;
					var remainingOtherMonsters = optionsCount - 1;
					var chanceToNotBeSelected = 1;

					for ( var roll = 0; roll < selectedCount; roll++ ) {
						chanceToNotBeSelected *= otherMonstersChance;

						if ( remainingOtherMonsters === 0 ) {
							break;
						}
						remainingOtherMonsters--;

						// console.log( 'roll #' + roll + ': multiplying otherMonstersChance=' + otherMonstersChance + ' by ' + remainingOtherMonsters + ' and dividing by ' + ( remainingOtherMonsters + 1 ) );
						otherMonstersChance *= ( remainingOtherMonsters / ( remainingOtherMonsters + 1 ) );

						// Normalize [ individualChance, otherMonstersChance ] to have a sum of 1.
						var newSum = individualChance + otherMonstersChance;
						individualChance /= newSum;
						otherMonstersChance /= newSum;
					}

					var quantityAttributes = {};
					var chance = 1 - chanceToNotBeSelected;
					if ( chance < 1 ) {
						quantityAttributes.chance = chance * 100;
					}

					outputs.addSpawnType( spawnType, quantityAttributes );
				}

				this.add( 'Biome monsters', inputs, outputs );
			}

		} );
	}

	/**
	 * Add "biome -> placeables (chests, trees, etc.)" recipes.
	 */
	loadBiomePlaceables() {
		var treasureChests = AssetDatabase.getData( 'treasure/default.treasurechests' );

		BiomeDatabase.forEach( ( biome ) => {
			var configs = [
				[ biome.surfacePlaceables, 'surface' ],
				[ biome.undergroundPlaceables, 'underground' ]
			];
			for ( var [ placeablesConf, subtype ] of configs ) {
				if ( !placeablesConf ) {
					// No placeables here (e.g. surface placeables for underground-only biome).
					continue;
				}

				var inputs = RecipeSide.newEmpty().addBiome( biome.biomeCode, subtype );
				var itemsDroppedFromBreakableObjects = new Set();

				( placeablesConf.items || [] ).forEach( ( placeable ) => {

					if ( placeable.type === 'object' ) {
						for ( var objectSet of placeable.objectSets ) {
							const outputs = new RecipeSide();

							for ( let [ chance, itemCode ] of util.normalizeWeights( objectSet.pool ) ) {
								var quantityAttributes = { chance: chance * 100 };
								if ( objectSet.parameters ) {
									quantityAttributes.parameters = objectSet.parameters;
								}

								var item = ItemDatabase.find( itemCode );
								if ( !item && itemCode.match( /(^|_)wild/ ) ) {
									// We don't have wild seeds in the ItemDatabase (they don't need their own article),
									// so we link to the obtainable player-plantable seed instead.
									var seedItemCode = itemCode.replace( /(^|_)wild/, '' );
									item = ItemDatabase.find( seedItemCode );
									if ( item && item.category === 'seed' ) {
										itemCode = seedItemCode;
									}
								}
								if ( !item ) {
									util.log( '[info] Unknown placeable object in biome ' + biome.biomeCode + ': ' + itemCode );
									return;
								}

								var isSmashable = (
									item.smashable || item.smashOnBreak ||
									( item.breakDropOptions && item.breakDropOptions.length > 0 ) ||
									( item.smashDropOptions && item.smashDropOptions.length > 0 )
								);
								if ( isSmashable ) {
									// Breakable objects are unobtainable by player, so we don't need articles about them.
									// However, we still track "which items are dropped when these objects are broken".
									( item.breakDropOptions || [] ).concat( item.smashDropOptions || [] ).forEach( ( dropOption ) => {
										for ( let [ itemCode ] of dropOption ) {
											itemsDroppedFromBreakableObjects.add( itemCode );
										}
									} );

									// TODO: also add item.smashDropPool and/or item.breakDropPool (if any).
									// Don't forget to ignore them for "timeobelisk" and "spacetimeobelisk",
									// which have a different "drop item.treasure.pool on scan" mechanic.

								}

								var isHarvestable = item.stages && item.stages.some( ( stage ) => stage.harvestPool );
								if ( !isSmashable || isHarvestable ) {
									outputs.addItem( itemCode, quantityAttributes );
								}
							}

							this.add( 'Biome objects', inputs, outputs );
						}
					} else if ( placeable.type === 'treasureBox' ) {
						for ( var treasureBoxType of placeable.treasureBoxSets ) {
							for ( var treasureConf of treasureChests[treasureBoxType] ) {
								const outputs = new RecipeSide();

								// Each of these recipes has a chest (Item) and a TreasurePool of what's within.
								treasureConf.containers.forEach( ( itemCode ) => outputs.addItem( itemCode ) );
								outputs.addPool( treasureConf.treasurePool );

								this.add( 'Biome chests', inputs, outputs );
							}
						}
					} else if ( placeable.type === 'tree' && placeable.mode === 'floor' ) {
						// These are regular tree saplings.
						// We are not interested in vines (mode=ceiling), because they are almost always the same.
						const outputs = new RecipeSide();
						for ( var stemType of placeable.treeStemList ) {
							outputs.addSaplingPart( stemType, false );
						}

						for ( var foliageType of placeable.treeFoliageList ) {
							outputs.addSaplingPart( foliageType, true );
						}

						this.add( 'Biome trees', inputs, outputs );
					} else {
						// There are other types of placeables (like "grass" and "bush", but they are not very important.
						// The only thing we can gather about "microdungeon" at this point is its machine-readable ID.
					}
				} );

				// Add recipe "Biome -> all possible drops from breaking biome objects".
				var outputs = new RecipeSide();
				itemsDroppedFromBreakableObjects.forEach( ( itemCode ) => outputs.addItem( itemCode ) );

				this.add( 'Drops from breakable objects', inputs, outputs );
			}
		} );
	}

	/**
	 * Add "terraformer/microformer (item) -> resulting biome" recipes.
	 */
	loadTerraformers() {
		ItemDatabase.forEach( ( itemCode, item ) => {
			var biomeCode = item.terraformBiome;
			if ( biomeCode ) {
				this.add( 'Terraforming',
					RecipeSide.newEmpty().addItem( itemCode ),
					RecipeSide.newEmpty().addBiome( biomeCode )
				);
			}
		} );
	}

	/**
	 * Add "upgrade this building" recipes (e.g. Armorworks -> Assembly Line).
	 */
	loadBuildingUpgrades() {
		ItemDatabase.forEach( ( itemCode, item ) => {
			if ( !item.upgradedStations ) {
				return;
			}

			var stages = [ item ].concat( item.upgradedStations );
			for ( var i = 0; i < stages.length - 1; i++ ) {
				var prevStage = stages[i];
				var nextStage = stages[i + 1];

				var upgradeMaterials = prevStage.interactData.upgradeMaterials;

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
	 * Add "upgrade this item" recipes (e.g. Bug Net -> Superior Bug Net).
	 */
	loadItemUpgrades() {
		ItemDatabase.forEach( ( itemCode, item ) => {
			if ( !item.upgradedItems ) {
				return;
			}

			var stages = [ item ].concat( item.upgradedItems );
			for ( var i = 0; i < stages.length - 1; i++ ) {
				this.add( 'Upgrade item',
					RecipeSide.newEmpty().addItem( stages[i].itemCode ),
					RecipeSide.newEmpty().addItem( stages[i + 1].itemCode )
				);
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

	/**
	 * Add "fuel item -> produced power" recipes for Quantum Reactor and  Precursor Reactor..
	 */
	loadQuantumFuels() {
		[
			'objects/power/fu_quantumgenerator/fu_quantumgenerator.object',
			'objects/minibiome/precursor/precursoromegagenerator/precursoromegagenerator.object'
		].forEach( ( pathToAsset ) => {
			var quantumConf = AssetDatabase.getData( pathToAsset );
			var maxHeatPower = Math.max( ...quantumConf.heat.map( ( heatLevel ) => heatLevel.power ) ),
				stationName = RemoveBadSymbols.fromName( quantumConf.shortdescription );

			for ( var [ itemCode, fuelPower ] of Object.entries( quantumConf.acceptablefuel ) ) {
				var inputs = new RecipeSide();
				inputs.addItem( itemCode, { count: 1 } );

				var outputs = new RecipeSide();
				outputs.addFuel( fuelPower + maxHeatPower, fuelPower );

				this.add( stationName, inputs, outputs );
			}
		} );
	}

	/**
	 * Add "fuel item -> produced power" recipes for Combustion Generator, Alternator Generator
	 * and Neuro-Psionic Generator (these three reactors have exactly the same mechanics).
	 */
	loadCombustionFuels() {
		[
			'objects/power/fu_alternatorgenerator/fu_alternatorgenerator.object',
			'objects/power/isn_thermalgenerator/isn_thermalgenerator.object',
			'objects/power/braingenerator/braingenerator.object'

		].forEach( ( pathToAsset ) => {
			var combustionConf = AssetDatabase.getData( pathToAsset );
			var maxHeatPower = Math.max( ...combustionConf.heat.map( ( heatLevel ) => heatLevel.power ) ),
				stationName = RemoveBadSymbols.fromName( combustionConf.shortdescription );

			for ( var [ itemCode, fuelDuration ] of Object.entries( combustionConf.acceptablefuel ) ) {
				var inputs = new RecipeSide();
				inputs.addItem( itemCode, { count: 1 } );

				var outputs = new RecipeSide();
				outputs.addFuel( maxHeatPower, fuelDuration );

				this.add( stationName, inputs, outputs );
			}
		} );
	}

	/**
	 * Add "fuel item -> produced power + byproduct items" recipes for Fission Reactor.
	 */
	loadFissionFuels() {
		var fissionConf = AssetDatabase.getData( 'objects/power/isn_fissionreactornew/isn_fissionreactornew.object' );
		var toxicWasteCount = 1 + 0.01 * fissionConf.bonusWasteChance;

		for ( var [ itemCode, fuelOptions ] of Object.entries( fissionConf.fuels ) ) {
			var inputs = new RecipeSide();
			inputs.addItem( itemCode, { count: 1 } );

			var outputs = new RecipeSide();
			outputs.addFuel( fuelOptions.power, fuelOptions.decayRate );
			outputs.addItem( 'toxicwaste', { averageCount: toxicWasteCount } );
			outputs.addItem( 'tritium', { chance: fissionConf.bonusWasteChance } );

			this.add( 'Fission Reactor', inputs, outputs );
		}
	}

	/**
	 * Add "fuel item -> produced power" recipes for Hydraulic Dynamo.
	 */
	loadHydraulicFuels() {
		var hydraulicConf = AssetDatabase.getData( 'objects/power/hydraulicdynamo/hydraulicdynamo.object' );

		for ( var [ itemCode, fuelOptions ] of Object.entries( hydraulicConf.fuels ) ) {
			var inputs = new RecipeSide();
			inputs.addItem( itemCode, { count: 1 } );

			var outputs = new RecipeSide();
			outputs.addFuel( fuelOptions.power, fuelOptions.decayRate );

			this.add( 'Hydraulic Dynamo', inputs, outputs );
		}
	}

	/**
	 * Add "fuel item -> produced power" recipes for Small Fusion Reactor and Large Fusion Reactor.
	 */
	loadFusionFuels() {
		[
			'objects/power/makeshiftreactor/makeshiftreactor.object',
			'objects/skath/skathfusionreactor/skathfusionreactor.object'

		].forEach( ( pathToAsset ) => {
			var fusionConf = AssetDatabase.getData( pathToAsset ),
				stationName = RemoveBadSymbols.fromName( fusionConf.shortdescription );

			for ( var [ itemCode, fuelOptions ] of Object.entries( fusionConf.fuels ) ) {
				var inputs = new RecipeSide();
				inputs.addItem( itemCode, { count: 1 } );

				var outputs = new RecipeSide();
				outputs.addFuel( fuelOptions.power, fuelOptions.decayRate );
				outputs.addItem( 'toxicwaste', { count: 1 } );

				this.add( stationName, inputs, outputs );
			}
		} );
	}

	/**
	 * Add "tenant -> possible rent" recipes for all tenants.
	 */
	loadTenantRent() {
		TenantDatabase.forEach( ( tenant ) => {
			this.add( 'Tenant rent',
				RecipeSide.newEmpty().addTenant( tenant.tenantCode ),
				RecipeSide.newEmpty().addPool( tenant.rent.pool )
			);
		} );
	}

	/**
	 * Add "treasure pool -> contents" recipes for subpools of TreasurePools that are a part of outputs
	 * in other (already loaded) recipes. For example, if some monster has "basic treasure" as part
	 * of its drops, then "basic treasure" pool will be included here.
	 *
	 * This method should be called near the end of RecipeDatabase.load(),
	 * because it won't know about the recipes that are loaded after it.
	 */
	loadTreasurePoolsFromOtherRecipes() {
		this.loadedTreasurePools = new Set();

		for ( var recipe of this.knownRecipes ) {
			for ( var mentionedPoolName of recipe.outputs.getPoolNames() ) {
				this.loadTreasurePool( mentionedPoolName );
			}
		}
	}

	/**
	 * Add "treasure pool -> contents" recipe for one TreasurePool.
	 *
	 * @param {string} poolName
	 */
	loadTreasurePool( poolName ) {
		if ( this.loadedTreasurePools.has( poolName ) ) {
			// Already loaded.
			return;
		}
		this.loadedTreasurePools.add( poolName );

		var inputs = new RecipeSide();
		inputs.addPool( poolName );

		var outputs = TreasurePoolDatabase.getPossibleOutputs( poolName );
		this.add( 'Treasure pool', inputs, outputs );

		// Load subpools (if any).
		outputs.getPoolNames().forEach( ( subPoolName ) => this.loadTreasurePool( subPoolName ) );

		// Load tier-specific variants of this pool (if any).
		TreasurePoolDatabase.getTierSpecificPoolNames( poolName )
			.forEach( ( tieredPoolName ) => this.loadTreasurePool( tieredPoolName ) );
	}

	/* ----------------------------------------------------------------------------------------------- */

	/**
	 * Record the recipe into the database. This makes this recipe findable via search methods.
	 * See [Recipe.js] for meaning of parameters.
	 *
	 * @param {string} station
	 * @param {RecipeSide} inputs
	 * @param {RecipeSide} outputs
	 * @param {string} errorContext If the recipe is invalid, this will be included into error message.
	 */
	add( station, inputs, outputs, errorContext ) {
		var recipeObject = new Recipe( station, inputs, outputs );

		// Sanity check. Prevent unchecked objects from being added into database.
		// Note: we are not throwing an exception (displaying tolerance to bad input),
		// because bad recipe likely means incomplete work-in-progress object from the mod,
		// and such "temporarily broken recipe" shouldn't stop this script from running.
		if ( !recipeObject.isValid() ) {
			// Don't add.
			console.log( 'Invalid recipe found: ' +
				( errorContext ? errorContext + ' :' : '' ) +
				'[' + JSON.stringify( recipeObject ) + ']' );
			return;
		}
		this.knownRecipes.push( recipeObject );
	}

	/**
	 * Add the crafting recipe from *.recipe file.
	 *
	 * @param {Object} loadedData Value returned by AssetDatabase.getData() for *.recipe file.
	 * @param {string} filename If the recipe is invalid, this will be included into error message.
	 */
	addNativeCraftingRecipe( loadedData, filename ) {
		var station = CraftingStationDatabase.findByGroups( loadedData.groups );
		if ( !station ) {
			// This recipe can't be crafted anywhere.
			return;
		}

		var inputs = RecipeSide.newFromCraftingInput( loadedData.input );
		if ( loadedData.currencyInputs ) {
			// Used by Terraforge recipes, Teleporters, some EPP augments, etc.
			for ( var [ itemCode, count ] of Object.entries( loadedData.currencyInputs ) ) {
				inputs.addItem( itemCode, { count: count } );
			}
		}

		var outputs = RecipeSide.newFromCraftingInput( loadedData.output );
		this.add( station, inputs, outputs, filename );
	}

	/**
	 * Iterate over all recipes. Run the callback for each of them.
	 * Callback receives 1 parameter (Recipe object).
	 *
	 * @param {recipeCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		this.knownRecipes.forEach( callback );
	}

	/**
	 * Callback expected by RecipeDatabase.forEach().
	 *
	 * @callback recipeCallback
	 * @param {Recipe} recipe
	 */

	/**
	 * Returns an array of ALL items that are a part of at least 1 Recipe.
	 *
	 * @return {string[]} Format: [ "liquidoil", "copperore", "liquidhoney", "fu_carbon", ... ].
	 */
	listMentionedItemCodes() {
		if ( !this.loaded ) {
			this.load();
		}

		// { "ironore", "copperbar", ... }
		var seenItems = new Set();

		// { "Tinkering Table", "Primitive Furnace", ... }
		var seenStationNames = new Set();

		this.knownRecipes.forEach( ( recipe ) => {
			var inputItems = recipe.inputs.getItemCodes(),
				outputItems = recipe.outputs.getItemCodes();

			for ( var mentionedItem of inputItems.concat( outputItems ) ) {
				seenItems.add( mentionedItem );
			}

			seenStationNames.add( recipe.station );
		} );

		// Add noticed crafting stations into "seenItems" array.
		for ( var stationName of seenStationNames ) {
			var stationItemCode = ItemDatabase.findCodeByPageName( stationName );
			if ( stationItemCode ) {
				seenItems.add( stationItemCode );
			}
		}

		return [...seenItems].sort();
	}

	/**
	 * Returns an array of all TreasurePool names that are a part of at least 1 Recipe.
	 *
	 * @return {string[]} Format: [ "poolName1", "poolName2", ... ].
	 */
	listMentionedTreasurePools() {
		if ( !this.loaded ) {
			this.load();
		}

		return [...this.loadedTreasurePools].sort();
	}
}

module.exports = new RecipeDatabase();
