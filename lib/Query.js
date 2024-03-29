'use strict';

const { AssetDatabase, config, util } = require( '.' );

/**
 * Utility class for making queries like "get planet name by planet ID".
 *
 * Note: all queries are allowed to throw Error if used prematurely
 * (e.g. when trying to access ItemDatabase.find() from constructor of Item class).
 */
class Query {
	constructor() {
	}

	/**
	 * Convert planet code (e.g. "arboreal2") into human-readable name (e.g. "Volcanic Primeval").
	 *
	 * @param {string} planetCode
	 * @return {string|undefined}
	 */
	getPlanetName( planetCode ) {
		if ( !this.planetTypeNames ) {
			this.planetTypeNames = AssetDatabase.getData( 'interface/cockpit/cockpit.config' ).planetTypeNames;

			for ( var [ planetCode2, planetName ] of Object.entries( config.overridePlanetNames ) ) {
				this.planetTypeNames[planetCode2] = planetName;
			}
		}

		return this.planetTypeNames[planetCode];
	}

	/**
	 * Convert weather code (e.g. "ironstorm") into human-readable name and icon.
	 *
	 * @param {string} weatherCode
	 * @return {Object|undefined} E.g. { "displayName": "Rain", "icon": "/path/to/rain.png" }
	 */
	getWeatherNameAndIcon( weatherCode ) {
		if ( !this.displayWeathers ) {
			this.displayWeathers = AssetDatabase.getData( 'interface/cockpit/cockpit.config' ).displayWeathers;
		}
		return this.displayWeathers[weatherCode];
	}

	/**
	 * Convert biome code (e.g. "crystalswamp") into human-readable name (e.g. "Crystalline Swamp").
	 *
	 * @param {string} biomeCode
	 * @return {string|undefined}
	 */
	getBiomeName( biomeCode ) {
		// Using GPS configuration is generally better than "friendlyName" from .biome file,
		// because it has human-readable name for vanilla biomes too (some of them lack "friendlyName").
		if ( !this.biomeNames ) {
			this.biomeNames = AssetDatabase.getData( 'interface/kukagps/biomes.config' );
		}

		return this.biomeNames[biomeCode];
	}

	/**
	 * Convert dungeon ID (e.g. "starterhouse") into human-readable name (e.g. "Abandoned house").
	 *
	 * @param {string} dungeonId
	 * @return {string|undefined}
	 */
	getDungeonName( dungeonId ) {
		// .dungeon files don't have a human-readable name, but GPS configuration does (for some of them).
		if ( !this.dungeonNames ) {
			this.dungeonNames = AssetDatabase.getData( 'interface/kukagps/dungeons.config' );
		}

		return this.dungeonNames[dungeonId];
	}

	/**
	 * Obtain the information about mech fuel by its item ID. Returns false for non-fuels.
	 *
	 * @param {string} itemCode
	 * @return {Object|false}
	 */
	getMechFuelInfo( itemCode ) {
		if ( !this.mechFuels ) {
			this.mechFuels = AssetDatabase.getData( 'interface/mechfuel/mechfuel.config' ).fuels;
		}

		return this.mechFuels[itemCode] || false;
	}

	/**
	 * Returns tile effects (e.g. speed bonus on Asphalt) for material name (e.g. "clay").
	 * Returns false if this material doesn't have any effects.
	 *
	 * @param {string} materialName
	 * @return {Object|false}
	 */
	getTileEffects( materialName ) {
		if ( !this.tileEffects ) {
			var tileConf = AssetDatabase.getData( 'tileEffects.config' );
			this.tileEffects = Object.assign( tileConf.vanilla_tiles, tileConf.FU_tiles );
		}

		return this.tileEffects[materialName] || false;
	}

	/**
	 * Find the ID of farm beast diet (e.g. "omnivore" or "lunar") that includes itemCode as possible food.
	 *
	 * @param {string} itemCode
	 * @return {string|undefined}
	 */
	whichAnimalsEat( itemCode ) {
		if ( !this.itemToAnimalDiet ) {
			this.itemToAnimalDiet = {};

			var farmConf = AssetDatabase.getData( 'scripts/actions/monsters/farmable.config' ).foodlists;
			for ( var [ diet, listOfFoodItems ] of Object.entries( farmConf ) ) {
				for ( var possibleFoodCode of listOfFoodItems ) {
					this.itemToAnimalDiet[possibleFoodCode] = diet;
				}
			}
		}

		return this.itemToAnimalDiet[itemCode];
	}

	/**
	 * Find the item by its ID.
	 *
	 * @param {string} itemCode
	 * @return {Item}
	 */
	findItem( itemCode ) {
		// This can't be required on top of Query.js, because Query is loaded before ItemDatabase.
		if ( !this.itemDb ) {
			this.itemDb = require( '.' ).ItemDatabase;
			if ( !this.itemDb.loaded ) {
				throw new Error( 'Query.findItem() can\'t be called before ItemDatabase.load().' );
			}
		}

		return this.itemDb.find( itemCode );
	}

	/**
	 * True if the item with this ID exists, false otherwise.
	 *
	 * @param {string} itemCode
	 * @return {boolean}
	 */
	doesItemExist( itemCode ) {
		return !!this.findItem( itemCode );
	}

	/**
	 * Returns fully loaded MonsterDatabase. Throws an exception if it's not loaded yet.
	 *
	 * @return {MonsterDatabase}
	 */
	getMonsterDatabase() {
		// This can't be required on top of Query.js, because Query is loaded before MonsterDatabase.
		if ( !this.monsterDb ) {
			this.monsterDb = require( '.' ).MonsterDatabase;
			if ( !this.monsterDb.loaded ) {
				throw new Error( 'Query.getMonsterDatabase() can\'t be called before MonsterDatabase.load().' );
			}
		}
		return this.monsterDb;
	}

	/**
	 * Find the monster by its ID.
	 *
	 * @param {string} monsterCode
	 * @return {Monster}
	 */
	findMonster( monsterCode ) {
		return this.getMonsterDatabase().find( monsterCode );
	}

	/**
	 * Find the critter by its ID.
	 *
	 * @param {string} monsterCode
	 * @return {boolean}
	 */
	findCritter( monsterCode ) {
		return this.getMonsterDatabase().findCritter( monsterCode );
	}

	/**
	 * Find the biome by its ID.
	 *
	 * @param {string} biomeCode
	 * @return {Biome}
	 */
	findBiome( biomeCode ) {
		// This can't be required on top of Query.js, because Query is loaded before BiomeDatabase.
		if ( !this.biomeDb ) {
			this.biomeDb = require( '.' ).BiomeDatabase;
			if ( !this.biomeDb.loaded ) {
				throw new Error( 'Query.findBiome() can\'t be called before BiomeDatabase.load().' );
			}
		}

		return this.biomeDb.find( biomeCode );
	}

	/**
	 * Find the TreasurePool by its name.
	 *
	 * @param {string} poolName
	 * @return {TreasurePool}
	 */
	findTreasurePool( poolName ) {
		// This can't be required on top of Query.js, because Query is loaded before TreasurePoolDatabase.
		if ( !this.treasurePoolDb ) {
			this.treasurePoolDb = require( '.' ).TreasurePoolDatabase;
			if ( !this.treasurePoolDb.loaded ) {
				throw new Error( 'Query.findTreasurePool() can\'t be called before TreasurePoolDatabase.load().' );
			}
		}

		return this.treasurePoolDb.find( poolName );
	}

	/**
	 * Find the planetary region by its name.
	 *
	 * @param {string} regionCode
	 * @return {Region}
	 */
	findRegion( regionCode ) {
		// This can't be required on top of Query.js, because Query is loaded before RegionDatabase.
		if ( !this.regionDb ) {
			this.regionDb = require( '.' ).RegionDatabase;
		}

		return this.regionDb.find( regionCode );
	}

	/**
	 * Find the status effect by its code (e.g. "biomepoisongas").
	 *
	 * @param {string} effectCode
	 * @return {StatusEffect|undefined}
	 */
	findStatusEffect( effectCode ) {
		// This can't be required on top of Query.js, because Query is loaded before StatusEffectDatabase.
		if ( !this.statusDb ) {
			this.statusDb = require( '.' ).StatusEffectDatabase;
			if ( !this.statusDb.loaded ) {
				throw new Error( 'Query.getStatusEffectLabel() can\'t be called before StatusEffectDatabase.load().' );
			}
		}

		return this.statusDb.find( effectCode );
	}

	/**
	 * Find weather by its code (e.g. "ironstorm").
	 *
	 * @param {string} weatherCode
	 * @return {Object|undefined}
	 */
	findWeather( weatherCode ) {
		if ( !this.knownWeathers ) {
			// Load all weathers here. There is currently no need to have a WeatherDatabase class,
			// because we don't save individual weathers into Cargo.
			this.knownWeathers = new Map();
			AssetDatabase.forEach( 'weather', ( filename, asset ) => {
				var weather = asset.data;
				this.knownWeathers.set( weather.name, weather );
			} );
		}

		return this.knownWeathers.get( weatherCode );
	}

	/**
	 * Returns the ready SaplingDatabase.
	 *
	 * @return {SaplingDatabase}
	 */
	getSaplingDatabase() {
		// This can't be required on top of Query.js, because Query is loaded before SaplingDatabase.
		if ( !this.saplingDb ) {
			this.saplingDb = require( '.' ).SaplingDatabase;
		}
		return this.saplingDb;
	}

	/**
	 * Find the modular tree stem by its name.
	 *
	 * @param {string} stemCode Machine-readable code of the stem, e.g. "coconutwood".
	 * @return {Object|undefined}
	 */
	findStem( stemCode ) {
		return this.getSaplingDatabase().findStem( stemCode );
	}

	/**
	 * Find the modular tree foliage by its name.
	 *
	 * @param {string} foliageCode Machine-readable code of the foliage, e.g. "snowleafy".
	 * @return {Object|undefined}
	 */
	findFoliage( foliageCode ) {
		return this.getSaplingDatabase().findFoliage( foliageCode );
	}

	/**
	 * Find human-readable name of the tree from of its foliage and its stem.
	 *
	 * @param {string} foliageCode Machine-readable code of the foliage, e.g. "snowleafy".
	 * @param {string} stemCode Machine-readable code of the stem, e.g. "coconutwood".
	 * @return {string}
	 */
	getSaplingName( foliageCode, stemCode ) {
		return this.getSaplingDatabase().getSaplingName( foliageCode, stemCode );
	}

	/**
	 * Convert an array of liquid names (e.g. "fuhoney") into array of IDs of corresponding items.
	 *
	 * @param {string[]} liquidNames
	 * @return {string[]}
	 */
	liquidNamesToItemCodes( liquidNames ) {
		// This can't be required on top of Query.js, because Query is loaded before LiquidDatabase.
		if ( !this.liquidDb ) {
			this.liquidDb = require( '.' ).LiquidDatabase;
			if ( !this.liquidDb.loaded ) {
				throw new Error( 'Query.liquidNamesToItemCodes() can\'t be called before LiquidDatabase.load().' );
			}
		}

		var itemCodes = [];
		for ( var liquidName of liquidNames ) {
			if ( liquidName === 'empty' ) {
				// Pseudo-liquid that means "no liquid".
				continue;
			}

			var droppedItemCode = this.liquidDb.findByName( liquidName ).itemDrop;
			if ( droppedItemCode ) {
				itemCodes.push( droppedItemCode );
			} else {
				util.log( '[warning] Liquid ' + liquidName + ' drops nothing when collected.' );
			}
		}

		// Make the list unique (some liquids drop the same item, and we don't need it to be listed twice).
		return [...new Set( itemCodes )];
	}
}

module.exports = new Query();
