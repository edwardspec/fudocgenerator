/**
 * Discovers all known monsters.
 */

const ItemDatabase = require( './ItemDatabase' ),
	AssetDatabase = require( './AssetDatabase' ),
	util = require( './util' ),
	config = require( '../config' );

class MonsterDatabase {
	constructor() {
		this.loaded = false;

		// Array of known research nodes,
		// e.g. { "gleap: { ... }, { "poptop": { ... }, ... }
		this.knownMonsters = {};
	}

	/**
	 * Scan the ItemDatabase and find all crafting stations.
	 */
	load() {
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.type !== 'monster' ) {
				return;
			}

			var monster = asset.data;
			if ( monster.type ) {
				this.knownMonsters[monster.type] = monster;
			}
		} );

		// Add human-readable names to all monsters. Some monsters don't have "shortdescription",
		// especially if they are not capturable by player.
		for ( var [ monsterCode, monster ] of Object.entries( this.knownMonsters ) ) {
			var displayName = monster.shortdescription;
			if ( !displayName ) {
				// The monster may have a capturable variation.
				var capturedMonsterCode = monster.baseParameters.capturedMonsterType;
				if ( capturedMonsterCode ) {
					displayName = this.knownMonsters[capturedMonsterCode].shortdescription;
				}
			}

			if ( !displayName && monster.baseParameters.harvestPool ) {
				// It's possible that this monster hatches from egg, and this egg has a name.
				var possibleEggCodes = [
					monsterCode + 'egg',
					monsterCode.replace( /^fu/, '' ) + 'egg'
				];
				if ( monster.eggType ) {
					// High-priority choice: directly specified in .monstertype asset.
					possibleEggCodes.unshift( monster.eggType );
				}

				for ( var eggItemCode of possibleEggCodes ) {
					var eggName = ItemDatabase.getDisplayName( eggItemCode );
					if ( eggName ) {
						displayName = eggName.replace( /\s*egg\s*/gi, '' );
						break;
					}
				}
			}

			if ( !displayName ) {
				// Fallback to machine-readable monster ID.
				util.log( '[info] MonsterDatabase: ' + monsterCode + "doesn't have a name." );
				displayName = monsterCode;
			}

			this.knownMonsters[monsterCode].displayName = util.cleanDescription( displayName );
		}

		util.log( '[info] MonsterDatabase: found ' + Object.keys( this.knownMonsters ).length + ' monsters.' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each monster.
	 * Callback gets the following parameters: 1) monster code, 2) loaded data.
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ monsterCode, loadedData ] of Object.entries( this.knownMonsters ) ) {
			callback( monsterCode, loadedData );
		}
	}
}

module.exports = new MonsterDatabase();