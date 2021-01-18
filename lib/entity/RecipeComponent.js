'use strict';

const { QuestDatabase, Query, util } = require( '..' );

/**
 * List of quantity attributes that can be combined,
 * e.g. { count: 5 } + { count: 7 } = { count: 12 }.
 */
const mergeableQuantities = [ 'count', 'averageCount', 'chance' ];

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
		var self = new RecipeComponent( monsterCode, quantityAttributes );
		self.isMonster = true;
		self.id = 'monster:' + monsterCode;
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
	 * Make 1 pool pseudo-item (something that has a valid TreasurePool ID) into RecipeComponent.
	 *
	 * @param {string} poolName
	 * @param {float} weight
	 * @return {RecipeComponent}
	 */
	static newPool( poolName, weight ) {
		var quantityAttributes = {};
		if ( weight < 1 ) {
			quantityAttributes.chance = 100 * weight;
		} else {
			quantityAttributes.averageCount = weight;
		}

		var self = new RecipeComponent( poolName, quantityAttributes );
		self.isPool = true;
		self.id = 'pool:' + poolName;
		return self;
	}

	/**
	 * Make 1 arbitrary pseudo-item (something that doesn't have an ID) into RecipeComponent.
	 *
	 * @param {string} displayName Atritrary string, e.g. "Air" (for Atmospheric Condenser recipes).
	 * @param {Object} quantityAttributes
	 * @return {RecipeComponent}
	 */
	static newPseudoItem( displayName, quantityAttributes = {} ) {
		var self = new RecipeComponent( '', quantityAttributes );
		self.isPseudo = true;
		self.id = 'pseudo:';
		self.displayName = displayName;
		return self;
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

			case 'isBuildingToUpgrade':
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
		if ( !this.displayName ) {
			if ( this.isMonster ) {
				var monster = Query.findMonster( this.code );
				if ( !monster ) {
					util.log( '[warn] Unknown monster in the recipe: ' + this.code );
					return '';
				}

				// Link to the article about this monster.
				this.displayName = monster.getWikiPageLink();
			} else if ( this.isQuest ) {
				// Quest ID. This is typically a quest that is required to be completed
				// before the recipe becomes available.
				var quest = QuestDatabase.find( this.code );
				if ( !quest ) {
					util.log( '[warn] Unknown quest in the recipe: ' + this.code );
					return '';
				}

				var questName = quest.title;
				this.displayName = "''(only after completing the quest: '''" + questName + "''')''";
			} else if ( this.isPool ) {
				// Pool ID. This can be in the recie when some monster drops include "common treasure" pools
				// in addition to the list of drops that are specific to this monster.
				this.displayName = '[[Template:TreasurePool/' + this.code + '|' + this.code + ']]';
			} else {
				// Normal item.
				var item = Query.findItem( this.code );
				if ( !item ) {
					util.warnAboutUnknownItem( this.code );
					return '';
				}

				// Link to the article about this item.
				this.displayName = item.getWikiPageLink();
			}
		}

		return this.displayName;
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
			return '';
		}

		var amount = this.quantity;
		var wikitext = '* ';

		if ( amount.count ) {
			wikitext += "'''" + amount.count + "x''' ";
		}

		wikitext += displayName;

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

		wikitext += '\n';
		return wikitext;
	}
}

module.exports = RecipeComponent;
