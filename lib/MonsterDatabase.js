'use strict';

const { ItemDatabase, AssetDatabase, Monster, util } = require( '.' );

/**
 * Discovers all known monsters.
 */
class MonsterDatabase {
	constructor() {
		this.loaded = false;

		// Array of known monsters,
		// e.g. { "gleap": { ... }, "poptop": { ... }, ... }
		this.knownMonsters = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all monsters.
	 */
	load() {
		AssetDatabase.forEach( 'monster', ( filename, asset ) => {
			var monster = new Monster( asset.data );
			if ( monster.isSegment() ) {
				// Skip sub-monsters of multi-segment monsters (e.g. tail of Burrower).
				// They don't drop anything and don't need their own separate article.
				return;
			}

			this.knownMonsters.set( monster.type, monster );
		} );

		// Add human-readable names to all monsters. Some monsters don't have "shortdescription",
		// especially if they are not capturable by player.
		for ( var [ monsterCode, monster ] of this.knownMonsters ) {
			var displayName = monster.shortdescription;
			if ( !displayName ) {
				// The monster may have a capturable variation.
				var capturedMonsterCode = monster.baseParameters.capturedMonsterType;
				if ( capturedMonsterCode ) {
					displayName = this.knownMonsters.get( capturedMonsterCode ).shortdescription;
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

			if ( displayName ) {
				monster.displayName = util.cleanDescription( displayName );
			} else {
				util.log( '[info] MonsterDatabase: ' + monsterCode + " doesn't have a name." );
				this.knownMonsters.delete( monster.type );
			}
		}

		util.log( '[info] MonsterDatabase: found ' + this.knownMonsters.size + ' monsters.' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each monster.
	 * Callback gets the following parameters: 1) monster code, 2) Monster object.
	 *
	 * @param {monsterCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var monster of this.knownMonsters.values() ) {
			callback( monster );
		}
	}

	/**
	 * Callback expected by MonsterDatabase.forEach().
	 *
	 * @callback monsterCallback
	 * @param {Monster} monster
	 */

	/**
	 * Find the monster called "monsterCode" in the database.
	 *
	 * @param {string} monsterCode
	 * @return {Object|null} Arbitrary information about this monster.
	 */
	find( monsterCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownMonsters.get( monsterCode );
	}
}

module.exports = new MonsterDatabase();
