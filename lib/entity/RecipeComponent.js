'use strict';

const { AssetDatabase, QuestDatabase, Query, config, util } = require( '..' );

/**
 * List of quantity attributes that can be combined,
 * e.g. { count: 5 } + { count: 7 } = { count: 12 }.
 */
const mergeableQuantities = [ 'count', 'averageCount', 'chance' ];

/**
 * List of codes that are known to be invalid, but shouldn't result in the Recipe becoming invalid.
 * This is used for buggy vanilla TreasurePools.
 */
const expectedMissingCodes = new Set( config.expectedMissingItems );

/**
 * This number is appended to ID of ":(number here)" pseudo-items.
 * We increment it every time such RecipeComponent is created, making their ID unique,
 * because we don't want pseudo-items within the same RecipeSide to be grouped together.
 */
var pseudoItemCounter = 0;

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeComponent {
	/**
	 * @param {string} code Arbitrary string that uniquely identifies this item, or this monster, etc.
	 * @param {Object} quantityAttributes
	 */
	constructor( code, quantityAttributes = {} ) {
		this.code = code;
		this.quantity = quantityAttributes;
	}

	/**
	 * Make 1 item into RecipeComponent.
	 *
	 * @param {string} itemCode
	 * @param {Object} quantityAttributes
	 * @return {RecipeComponent}
	 */
	static newItem( itemCode, quantityAttributes = {} ) {
		// Check if this is a blueprint (item that unlocks the crafting recipe of another item).
		if ( itemCode.endsWith( '-recipe' ) ) {
			itemCode = itemCode.replace( /-recipe$/, '' );
			quantityAttributes.isBlueprint = true;
		}

		var self = new RecipeComponent( itemCode, quantityAttributes );
		self.isItem = true;
		self.id = itemCode;
		return self;
	}

	/**
	 * Make 1 monster pseudo-item (something that has a valid monster ID) into RecipeComponent.
	 *
	 * @param {string} monsterCode
	 * @param {Object} quantityAttributes
	 * @return {RecipeComponent}
	 */
	static newMonster( monsterCode, quantityAttributes = {} ) {
		var replacementCode = config.identicalMonsters[monsterCode];
		if ( replacementCode ) {
			// Some vanilla and non-vanilla monsters are almost completely identical.
			// In these situations we add the modded monster (e.g. "fuchiropterror")
			// instead of the vanilla monster ("chiropterror").
			monsterCode = replacementCode;
		}

		if ( monsterCode.startsWith( 'bee_' ) ) {
			// We don't need separate article about wild catchable bee (monster) and its Bee Queen item,
			// so when such monster is added to the recipe, we add the Bee Queen item instead.
			return RecipeComponent.newItem( monsterCode + '_queen', quantityAttributes );
		}

		var self = new RecipeComponent( monsterCode, quantityAttributes );
		self.isMonster = true;
		self.id = 'monster:' + monsterCode;
		return self;
	}

	/**
	 * Make 1 biome pseudo-item (something that has a valid biome ID) into RecipeComponent.
	 *
	 * @param {string} biomeCode
	 * @param {string} extraComment
	 * @return {RecipeComponent}
	 */
	static newBiome( biomeCode, extraComment ) {
		var quantityAttributes = {};
		if ( extraComment ) {
			quantityAttributes.subtype = extraComment;
		}

		var self = new RecipeComponent( biomeCode, quantityAttributes );
		self.isBiome = true;
		self.id = 'biome:' + biomeCode;
		return self;
	}

	/**
	 * Make 1 music track pseudo-item (something that has a valid asset path) into RecipeComponent.
	 *
	 * @param {string} assetPath
	 * @return {RecipeComponent}
	 */
	static newMusicTrack( assetPath ) {
		var self = new RecipeComponent( assetPath );
		self.isMusicTrack = true;
		self.label = assetPath.replace( /^\/music\//, '' );
		self.id = 'music:' + self.label;
		return self;
	}

	/**
	 * Make 1 quest pseudo-item (something that has a valid quest ID) into RecipeComponent.
	 *
	 * @param {string} questCode
	 * @return {RecipeComponent}
	 */
	static newQuest( questCode ) {
		var self = new RecipeComponent( questCode );
		self.isQuest = true;
		self.id = 'quest:' + questCode;
		return self;
	}

	/**
	 * Make 1 tree stem/foliage (something that has a valid stem/foliage ID) into RecipeComponent.
	 *
	 * @param {string} name
	 * @param {boolean} isFoliage
	 * @return {RecipeComponent}
	 */
	static newSaplingPart( name, isFoliage ) {
		var self = new RecipeComponent( name );
		self.isSaplingPart = true;
		self.isFoliage = isFoliage;
		self.id = ( isFoliage ? 'foliage:' : 'stem:' ) + name;
		return self;
	}

	/**
	 * Make 1 pool pseudo-item (something that has a valid TreasurePool ID) into RecipeComponent.
	 *
	 * @param {string} poolName
	 * @param {float} weight
	 * @return {RecipeComponent}
	 */
	static newPool( poolName, weight ) {
		var quantityAttributes = {};
		if ( weight ) {
			if ( weight < 1 ) {
				quantityAttributes.chance = 100 * weight;
			} else {
				quantityAttributes.averageCount = weight;
			}
		}

		var self = new RecipeComponent( poolName, quantityAttributes );
		self.isPool = true;

		// Strip any suffixes of tier-specific pools, e.g. "uniqueWeapon:2" -> "uniqueWeapon".
		// This way "TreasurePool:Something" page will show "treasure pool -> contents" recipes not only
		// for the parent pool, but for all its variants too.
		poolName = poolName.split( ':', 1 )[0];

		self.id = 'pool:' + poolName;
		return self;
	}

	/**
	 * Make 1 arbitrary pseudo-item (something that doesn't have an ID) into RecipeComponent.
	 *
	 * @param {string} displayName Arbitrary string, e.g. "Air" (for Atmospheric Condenser recipes).
	 * @param {Object} quantityAttributes
	 * @return {RecipeComponent}
	 */
	static newPseudoItem( displayName, quantityAttributes = {} ) {
		var self = new RecipeComponent( '', quantityAttributes );
		self.isPseudo = true;
		self.id = ':' + ( ++pseudoItemCounter );
		self.displayName = displayName;
		return self;
	}

	/**
	 * Make a comment (one line of text, e.g. "Two of these monsters:") into RecipeComponent.
	 *
	 * @param {string} arbitraryWikitext
	 * @return {RecipeComponent}
	 */
	static newComment( arbitraryWikitext ) {
		return RecipeComponent.newPseudoItem( arbitraryWikitext, { isComment: true } );
	}

	/**
	 * Add a value to existing quantityAttributes, overwriting existing value in case of collision.
	 *
	 * @param {string} attributeName
	 * @param {*} attributeValue
	 */
	setQuantity( attributeName, attributeValue ) {
		this.quantity[attributeName] = attributeValue;
	}

	/**
	 * Try to merge another RecipeComponent into this one, combining quantities if they are compatible.
	 *
	 * @param {RecipeComponent} anotherComponent
	 * @return {boolean} True if anotherComponent was successfully merged, false if can't be merged.
	 */
	attemptMerge( anotherComponent ) {
		// Let's check if we can merge quantityAttributes of both components.
		// For example, { count: 5 } and { count: 7 } can be combined into { count: 12 }.
		// Both components must have exactly the same keys,
		// and ALL those keys must be whitelisted in "mergeableQuantities" array.
		var keys = Object.keys( anotherComponent.quantity ).sort(),
			foreignKeys = Object.keys( this.quantity ).sort();

		if ( keys.join( ',' ) != foreignKeys.join( ',' ) ) {
			// Can't merge, because "anotherComponent" doesn't have the same set of quantities.
			return false;
		}

		var unmergeableKeys = keys.filter( ( key ) => !mergeableQuantities.includes( key ) );
		if ( unmergeableKeys.length ) {
			// Can't merge, because some quantity attributes are not mergeable.
			return false;
		}

		// All keys can be merged.
		for ( var [ key, value ] of Object.entries( anotherComponent.quantity ) ) {
			// TODO: might have a switch() here to support merging non-numeric keys,
			// e.g. "planets" or "biomes".
			this.quantity[key] += value;
		}

		// Successfully merged.
		return true;
	}

	/**
	 * Returns true if this RecipeComponent has correct format. (This is used in sanity checks)
	 * See isValidAttribute() for which values are valid. Note: {} is valid (unknown/any quantity).
	 *
	 * @return {boolean}
	 */
	isValid() {
		for ( var [ attr, value ] of Object.entries( this.quantity ) ) {
			if ( !this.isValidAttribute( attr, value ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @private
	 * Check one quantityAttribute for whether it is valid or not.
	 * @param {Mixed} attr Name of attribute, e.g. "count", "chance", "planets", etc.
	 * @param {Mixed} value
	 * @return {bool} True if valid, false otherwise.
	 */
	isValidAttribute( attr, value ) {
		switch ( attr ) {
			case 'infrequency':
			case 'count':
			case 'secondsToCraft':
				if ( value != parseInt( value ) || value <= 0 ) {
					// Not a valid positive integer.
					return false;
				}
				return true;

			case 'chance':
			case 'averageCount':
				if ( value != parseFloat( value ) || value <= 0 ) {
					// Not a valid positive number.
					return false;
				}
				return true;

			case 'planets':
				if ( !Array.isArray( value ) ) {
					return false;
				}

				for ( var planetName of value ) {
					if ( !planetName || typeof ( planetName ) !== 'string' ) {
						// Not a valid planet name.
						return false;
					}
				}
				return true;

			case 'displayNameWikitext':
			case 'subtype':
				if ( !value || typeof ( value ) !== 'string' ) {
					// Not a valid string.
					return false;
				}
				return true;

			case 'rarity':
				if ( !Array.isArray( value ) ) {
					return false;
				}

				var [ rarity, divisor ] = value;
				if ( [ 'common', 'normal', 'uncommon', 'rare', 'rarest' ].indexOf( rarity ) === -1 ) {
					// Unknown rarity level.
					return false;
				}

				if ( divisor != parseFloat( divisor ) ) {
					// Not a valid number.
					return false;
				}
				return true;

			case 'parameters':
				if ( typeof ( value ) !== 'object' ) {
					// Not a key-value map.
					return false;
				}
				return true;

			case 'isBlueprint':
			case 'isBuildingToUpgrade':
			case 'isComment':
			case 'neverMerge':
			case 'noLineBreak':
				if ( value !== true ) {
					// Only accepted value is "true".
					return false;
				}
				return true;
		}

		console.log( 'Unknown quantity attribute in the recipe: ' + attr + ': ' + value );
		return false;
	}

	/**
	 * Get human-readable wikitext that mentions this item, e.g. "[[Carbon Dioxide]]".
	 * For most items, monsters, etc. it's a wikitext link to the article about item, monster, etc.
	 * However, pseudo-items like "Air (on Desert planets)" can specify this explicitly.
	 *
	 * @return {string}
	 */
	getDisplayName() {
		if ( this.displayName === undefined ) {
			this.displayName = this.getDisplayNameUncached();
		}

		return this.displayName;
	}

	/**
	 * @private
	 * Uncached version of getDisplayName().
	 *
	 * @return {string}
	 */
	getDisplayNameUncached() {
		if ( this.isMonster ) {
			var monster = Query.findMonster( this.code );
			if ( !monster ) {
				var critter = Query.findCritter( this.code );
				if ( critter ) {
					// Passive critters are decorative, don't have a human-readable name and don't need an article,
					// which is why MonsterDatabase doesn't have them,
					// but the "biome -> possible monsters" recipes with them must still be considered valid,
					// because they often share a spawnProfile with non-decorative monsters.
					var bugNetPoolName = critter.getBugNetPool();
					if ( bugNetPoolName ) {
						let pool = Query.findTreasurePool( bugNetPoolName );
						if ( !pool ) {
							util.log( '[error] Monster ' + this.code + ' has unknown bugnet pool: ' + bugNetPoolName );
							return '';
						}

						// Instead of capturable bug (monster) we can show the "caught bug" placeable item.
						var lootItems = pool.getPossibleOutputs().getItemCodes();
						if ( lootItems.length > 0 ) {
							return lootItems.map( ( itemCode ) => {
								var item = Query.findItem( itemCode );
								if ( !item ) {
									util.warnAboutUnknownItem( itemCode );
									return '';
								}

								// Link to the article about this item.
								return item.getWikiPageLink();
							} ).join( ', ' );
						}
					}

					// Generic critter, we know nothing about it except its ID.
					return 'Critter: ' + this.code;
				}

				util.warnAboutUnknownMonster( this.code );
				return '';
			}

			// Link to the article about this monster.
			return monster.getWikiPageLink();
		}

		if ( this.isQuest ) {
			// Quest ID. This is typically a quest that is required to be completed
			// before the recipe becomes available.
			var quest = QuestDatabase.find( this.code );
			if ( !quest ) {
				util.log( '[warn] Unknown quest in the recipe: ' + this.code );
				return '';
			}

			return "''(only after completing the quest: '''" + quest.title + "''')''";
		}

		if ( this.isPool ) {
			// If this.code has ":" symbol, then this is a tier-specific pool variant.
			// It shares its wiki article with the parent pool (and only parent pool is in PageNameRegistry).
			var [ poolCode, isSubpool ] = this.code.split( ':' );

			// Pool ID. This can be in the recipe when some monster drops include "common treasure" pools
			// in addition to the list of drops that are specific to this monster.
			var pool = Query.findTreasurePool( poolCode );
			if ( !pool ) {
				util.log( '[warn] Unknown TreasurePool in the recipe: ' + this.code );
				return '';
			}

			var suffix = '';
			if ( isSubpool ) {
				// Note: all pools use values like 2.9, 4.9, etc. for minTier, thus Math.ceil().
				var subpool = Query.findTreasurePool( this.code );
				suffix = " ''(tier " + Math.ceil( subpool.minTier ) + "+)''";
			}

			return pool.getWikiPageLink( '', suffix );
		}

		if ( this.isBiome ) {
			var biome = Query.findBiome( this.code );
			if ( !biome ) {
				util.log( '[warn] Unknown biome in the recipe: ' + this.code );
				return '';
			}

			// Link to the article about this biome.
			return biome.getWikiPageLink( 'Biome: ' );
		}

		if ( this.isMusicTrack ) {
			// Determine if track is from vanilla, and if not, then add a GitHub link.
			var asset = AssetDatabase.get( this.code );
			if ( !asset ) {
				// Aside from typos, this happens for several vanilla assets
				// that have incorrect capitalization in their filename.
				return this.label + " ''(not found)''";
			}

			if ( asset.vanilla ) {
				return this.label + " ''(vanilla)''";
			}

			var url = config.githubLink + '/blob/master' + this.code;
			return '[' + url + ' ' + this.label + ']';
		}

		if ( this.isSaplingPart ) {
			var saplingPart = this.isFoliage ? Query.findFoliage( this.code ) : Query.findStem( this.code );
			if ( !saplingPart ) {
				util.log( '[warn] Unknown ' + ( this.isFoliage ? 'modularfoliage' : 'modularstem' ) +
					' in the recipe: ' + this.code );
				return '';
			}

			// Link to the article about this stem.
			return saplingPart.getWikiPageLink();
		}

		// Normal item.
		var item = Query.findItem( this.code );
		if ( !item ) {
			util.warnAboutUnknownItem( this.code );
			return '';
		}

		// Link to the article about this item.
		return item.getWikiPageLink();
	}

	/**
	 * Get wikitext representation of this RecipeComponent.
	 *
	 * @param {Object} renderParameters Extra options (if any) that affect wikitext generation.
	 * @return {string}
	 */
	toWikitext( renderParameters ) {
		var displayName = this.getDisplayName();
		if ( !displayName ) {
			// Unknown item, etc.
			if ( !expectedMissingCodes.has( this.code ) ) {
				return '';
			}

			displayName = '(missing item: ' + this.code + ')';
		}

		var amount = this.quantity;
		var wikitext = '';

		if ( !amount.isComment ) {
			// All non-comment lines are an unordered bulleted list.
			wikitext += '* ';
		}

		if ( amount.count ) {
			wikitext += "'''" + amount.count + "x''' ";
		}

		wikitext += displayName;

		if ( amount.isBlueprint ) {
			wikitext += " '''(blueprint)'''";
		}

		if ( amount.chance ) {
			// Round to 2 digits.
			wikitext += " '''" + util.trimFloatNumber( amount.chance, 2 ) + "%'''";
		}

		if ( amount.rarity ) {
			// Note: we use MediaWiki templates (Template:CentrifugeRarity and its subtemplates
			// such as Template:CentrifugeChange/IronCentrifuge) to display actual values.
			// See "templatesAndStyles/" directory for examples.
			var [ rarity, chanceDivisor ] = amount.rarity;
			wikitext += " ''({{CentrifugeRarity|" + rarity + '|' + chanceDivisor;

			// Add flags like "onlyGasCentrifuge=1" or "sifter=1".
			if ( renderParameters.rarityFlag ) {
				wikitext += '|' + renderParameters.rarityFlag;
			}

			wikitext += "}})''";
		}

		if ( amount.subtype ) {
			// For bees, saplings, etc. (inputs that can have different outputs depending of subtype)
			wikitext += " ''(" + amount.subtype + ")''";
		}

		// If averageCount (commonly used for drop pools) is too low,
		// we show it as fraction (e.g. 0.005 -> 1/200) for better readability.
		if ( amount.averageCount && amount.averageCount < 0.02 && !amount.infrequency ) {
			amount.infrequency = util.trimFloatNumber( 1 / amount.averageCount, 0 );
			delete amount.averageCount;
		}

		if ( amount.infrequency ) {
			// NOTE: this value is somewhat hard to display in understandable format.
			// Notation "1/123" is imperfect, but what else can we show?
			// Meaning of "infrequency": the larger is this number, the less frequently is the item produced.
			// But we can't display the exact chance and/or needed time, because it gets multiplied
			// by other factors (such as Bee Production stat) and is therefore not constant.
			wikitext += " ''(1/" + amount.infrequency + ")''";
		}

		if ( amount.averageCount ) {
			// Unlike "count" (which is the strict number of items of required input or guaranteed output),
			// averageCount represents an average number of items that will be obtained from 1 drop
			// (e.g. from defeating 1 monster, or from harvesting 1 plant).
			// If only 1 monster out of 5 drops 2 some item, then this value will be 2/5=0.4.
			wikitext += ' ~' + util.trimFloatNumber( amount.averageCount, 2 ) + 'x';
		}

		if ( amount.secondsToCraft ) {
			// How many seconds does it take for this output to be generated.
			// NOTE: this is exclusively for Liquid Collector and Erchius Converter.
			// Do NOT add this to crafting recipes (where it is irrelevant, as everyone who cares about it
			// is using Instant Crafting) or to recipes from Extraction Lab (it has fixed extraction time).
			wikitext += ' (' + amount.secondsToCraft + 's)';
		}

		if ( amount.planets ) {
			// For pseudo-items like "Air (Desert, Savannah planets)".
			var allPlanetNames = amount.planets.map( ( thisPlanetCode ) => Query.getPlanetName( thisPlanetCode ) ),
				uniquePlanetNames = Array.from( new Set( allPlanetNames ) ),
				allPlanetLinks = uniquePlanetNames.map( ( planetName ) => {
					return ( planetName ? ( '[[' + planetName + ']]' ) : 'normal' );
				} );

			wikitext += ' (' + allPlanetLinks.join( ', ' ) + ' planets)';
		}

		if ( amount.isBuildingToUpgrade ) {
			// This item has "Upgrade Station" button, and this is a recipe "what happens if you click it".
			wikitext += " ''(will be upgraded)''";
		}

		var itemParams = amount.parameters;
		if ( itemParams && this.isItem ) {
			// Additional parameters of the item from the crafting recipe.
			// Meaning of these parameters greatly depends on the item, so we check this first.
			if ( this.code === 'sapling' ) {
				var saplingName = Query.getSaplingName(
					itemParams.foliageName,
					itemParams.stemName
				);
				wikitext += " ''(" + saplingName + ")''";
			} else if ( this.code === 'filledcapturepod' && itemParams.shortdescription ) {
				wikitext += " ''([[" + itemParams.shortdescription + "]])''";
			} else if ( itemParams.ammoCount ) {
				wikitext += ' (ammo: ' + itemParams.ammoCount + ')';
			}
		}

		if ( amount.isComment && !amount.noLineBreak ) {
			// Comments are not a part of bulleted list (*), so they need an explicit "new line".
			wikitext += '<br>';
		}

		wikitext += '\n';
		return wikitext;
	}
}

module.exports = RecipeComponent;
