'use strict';

const { ItemDatabase, AssetDatabase, Monster, PageNameRegistry, config, util } = require( '.' );

/**
 * Discovers all known monsters.
 */
class MonsterDatabase {
	constructor() {
		this.loaded = false;

		// Array of known monsters, e.g. { "gleap": Monster1, "poptop": Monster2, ... }
		this.knownMonsters = new Map();

		// Array of known nameless critters, e.g. { "owlcritter": Monster1, ... }.
		// We don't include them into knownMonsters (because they don't need separate articles),
		// but we still keep track of them.
		this.knownCritters = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all monsters.
	 */
	load() {
		var ignoredMonstersList = new Set( config.ignoredMonsters );

		AssetDatabase.forEach( 'monster', ( filename, asset ) => {
			if ( asset.filename.startsWith( 'monsters/bees/' ) ) {
				// Pre-beevamp bees. They are no longer used.
				return;
			}

			const monster = new Monster( asset.data );
			if ( monster.isSegment() ) {
				// Skip sub-monsters of multi-segment monsters (e.g. tail of Burrower).
				// They don't drop anything and don't need their own separate article.
				return;
			}

			var monsterCode = monster.type;
			if ( ignoredMonstersList.has( monsterCode ) ) {
				util.log( '[info] MonsterDatabase: Ignoring ' + monsterCode + ' (in ignoredMonsters list of config.json).' );
				return;
			}

			this.knownMonsters.set( monsterCode, monster );
		} );

		// Keep track of monster types that we exclude due to them not having a human-readable name.
		// This is only used for logging.
		// Format:  [ "owlcritter", "tidefly", ... ].
		var namelessMonsterTypes = [];

		// Add human-readable names to all monsters. Some monsters don't have "shortdescription",
		// especially if they are not capturable by player.
		for ( const [ monsterCode, monster ] of this.knownMonsters ) {
			var displayName = monster.shortdescription;
			if ( !displayName ) {
				// The monster may have a capturable variation.
				var capturedMonsterCode = monster.baseParameters.capturedMonsterType;
				if ( capturedMonsterCode ) {
					displayName = ( this.knownMonsters.get( capturedMonsterCode ) || {} ).shortdescription;
				}
			}

			if ( !displayName && monster.baseParameters.harvestPool ) {
				// It's possible that this monster hatches from egg, and this egg has a name.
				// TODO: use Incubator configuration instead, as in RecipeDatabase.loadIncubator().
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

			if ( displayName === 'Burrower' ) {
				// Many Burrower monsters have the same name,
				// so we should prepend the name of ore to avoid confusion.
				var match = monsterCode.match( /^(.*)_burrower$/ );
				if ( match ) {
					displayName = util.ucfirst( match[1] ) + ' Burrower';
				}
			}

			if ( displayName ) {
				// Successfully named.
				monster.displayName = util.ucfirst( util.cleanDescription( displayName.replace( /_/g, ' ' ) ) );
				PageNameRegistry.add( monster );
			} else {
				if ( monster.isCritter() ) {
					// Critters that don't have a human-readable name will be tracked separately from other monsters.
					this.knownCritters.set( monsterCode, monster );
					this.knownMonsters.delete( monster.type );
				} else {
					// Nameless monster shouldn't have an article, so we don't add it to PageNameRegistry.
					// However, we keep it in the MonsterDatabase, so that "biome -> monster" Recipes
					// won't be considered invalid due to the presence of unknown monster.
					monster.displayName = 'Nameless monster: ' + util.cleanDescription( monsterCode );
					monster.isNameless = true;
					namelessMonsterTypes.push( monsterCode );
				}
			}
		}

		// Also scan .monsterpart assets. The only reason why we need them is to determine paths to images,
		// so let's calculate these paths here, and then add them into Monster objects.
		AssetDatabase.forEach( 'monsterpart', ( filename, asset ) => {
			var data = asset.data;
			var imageFilename = data.frames.body;
			if ( !imageFilename ) {
				// We don't support full animations (yet?), e.g. monsters with frontWings/backWings.
				return;
			}

			const monster = this.knownMonsters.get( data.category );
			if ( !monster ) {
				// Part of the monster that we chose to not include into the MonsterDatabase (e.g. segment).
				return;
			}

			if ( monster.bodyImage ) {
				// Many monster have differently looking variants, e.g. male/female Moontant.
				// Here we only capture the image of first variant (whatever it might be), ignoring all others.
				return;
			}

			// FIXME: not all monsters have "idle:1" frame.
			monster.bodyImage = '/' + filename.replace( /[^/]+$/, imageFilename ) + ':idle.1';
		} );

		util.log( '[info] MonsterDatabase: found monsters without human-readable name (' +
			namelessMonsterTypes.length + '), they won\'t have an article: ' + namelessMonsterTypes.sort().join( ', ' ) );
		util.log( '[info] MonsterDatabase: found ' + this.knownMonsters.size +
			' monsters and ' + this.knownCritters.size + ' critters.' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each monster.
	 * Callback receives 1 parameter (Monster object).
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
	 * Find the monster by its ID.
	 *
	 * @param {string} monsterCode
	 * @return {Monster|null}
	 */
	find( monsterCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownMonsters.get( monsterCode );
	}


	/**
	 * Find the critter by its ID.
	 *
	 * @param {string} monsterCode
	 * @return {Monster|null}
	 */
	findCritter( monsterCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownCritters.get( monsterCode );
	}
}

module.exports = new MonsterDatabase();
