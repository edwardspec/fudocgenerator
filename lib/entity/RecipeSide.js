'use strict';

const { Query, util } = require( '..' );

/**
 * List of quantity attributes that can be combined,
 * e.g. { count: 5 } + { count: 7 } = { count: 12 }.
 */
const mergeableQuantities = [ 'count', 'averageCount', 'chance' ];

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeSide {
	constructor() {
		// Format: { itemCode1: [ { count: 2 }, { chance: 0.65 } ], itemCode2: [ { count: 10 } ], ... }
		this.items = {};
	}

	/**
	 * Create RecipeSide object from representation of input/output ingredients from *.recipe files
	 * (native crafting recipes), such as [ { "item" : "something", "count" : 1 } ].
	 *
	 * @param {Object} nativeCraftingInput
	 * @return {RecipeSide}
	 */
	static newFromCraftingInput( nativeCraftingInput ) {
		var side = new RecipeSide();

		if ( !Array.isArray( nativeCraftingInput ) ) {
			nativeCraftingInput = [ nativeCraftingInput ];
		}

		nativeCraftingInput.forEach( function ( ingredient ) {
			side.addItem( ingredient.item || ingredient.name, { count: ingredient.count || 1 } );
		} );

		return side;
	}

	/**
	 * Create RecipeSide object from input/output of multi-stage extractors,
	 * for example, an array like { "carbon": 3, "oxygen": [ 1, 4, 9 ] }
	 * becomes { "carbon": { count: 3 }, "oxygen": { count: 1 } } for extractorStage=0,
	 * becomes { "carbon": { count: 3 }, "oxygen": { count: 4 } } for extractorStage=1, etc.
	 *
	 * @param {Object} valuesArray
	 * @param {int} extractorStage
	 * @return {RecipeSide}
	 */
	static newFromExtraction( valuesArray, extractorStage = 0 ) {
		var side = new RecipeSide();

		for ( var [ itemName, counts ] of Object.entries( valuesArray ) ) {
			var count = Number.isInteger( counts ) ? counts : counts[extractorStage];
			side.addItem( itemName, { count: count } );
		}

		return side;
	}

	/**
	 * Syntactic sugar for "new RecipeSide".
	 *
	 * @return {RecipeSide}
	 */
	static newEmpty() {
		return new RecipeSide();
	}

	/**
	 * Make a copy of existing RecipeSide object.
	 * This can be used with excludeItem(), etc. to avoid modifying the original RecipeSide object.
	 *
	 * @return {RecipeSide}
	 */
	clone() {
		var cloned = new RecipeSide();
		cloned.addEverythingFrom( this );
		return cloned;
	}

	/**
	 * Add 1 item to this RecipeSide object.
	 *
	 * @param {string} itemCode
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addItem( itemCode, quantityAttributes = {} ) {
		if ( !this.items[itemCode] ) {
			// Most likely situation: adding a new item.
			this.items[itemCode] = [];
		} else {
			// This item already exists in this RecipeSide,
			// so let's check if we can merge quantityAttributes into existing entry.
			// For example, { count: 5 } and { count: 7 } can be combined into { count: 12 }.
			for ( var entry of this.items[itemCode] ) {
				// To merge "entry" and "quantityAttributes", they must have exactly the same keys,
				// and ALL those keys must be whitelisted in "mergeableQuantities" array.
				var entryKeys = Object.keys( quantityAttributes ).sort();
				var oldEntryKeys = Object.keys( entry ).sort();
				if ( entryKeys.join( ',' ) == oldEntryKeys.join( ',' ) ) {
					// Might be possible to merge.
					var unmergeableKeys = entryKeys.filter( ( key ) => !mergeableQuantities.includes( key ) );
					if ( unmergeableKeys.length == 0 ) {
						// All keys can be merged.
						for ( var [ key, value ] of Object.entries( quantityAttributes ) ) {
							// TODO: might have a switch() here to support merging non-numeric keys,
							// e.g. "planets" or "biomes".
							entry[key] += value;
						}

						// We successfully merged quantityAttributes,
						// so there is no longer any need to add another entry to this.items[itemCode] array.
						return this;
					}
				}
			}
		}

		this.items[itemCode].push( quantityAttributes );
		return this;
	}

	/**
	 * Add 1 pseudo-item (something that doesn't have an item ID) to this RecipeSide object.
	 *
	 * @param {string} displayName Atritrary string, e.g. "Air" (for Atmospheric Condenser recipes).
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addPseudoItem( displayName, quantityAttributes = {} ) {
		quantityAttributes.displayNameWikitext = displayName;
		return this.addItem( 'pseudo:', quantityAttributes );
	}

	/**
	 * Add 1 monster pseudo-item (something that has a valid monster ID) to this RecipeSide object.
	 *
	 * @param {string} monsterCode
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addMonster( monsterCode, quantityAttributes = {} ) {
		return this.addItem( 'monster:' + monsterCode, quantityAttributes );
	}

	/**
	 * Remove 1 item from this RecipeSide object.
	 *
	 * @param {string} itemCode
	 * @return {this}
	 */
	excludeItem( itemCode ) {
		delete this.items[itemCode];
		return this;
	}

	/**
	 * Add "seconds to craft" to the first item.
	 * NOTE: This should only be used for things like Erchius Converter (where the time is important).
	 * Do NOT call this for regular crafting recipes.
	 *
	 * @param {number} seconds
	 */
	setSecondsToCraft( seconds ) {
		Object.values( this.items )[0][0].secondsToCraft = seconds;
	}

	/**
	 * Returns true if this RecipeSide object doesn't have any items, false otherwise.
	 *
	 * @return {boolean}
	 */
	isEmpty() {
		return Object.values( this.items ).length === 0;
	}

	/**
	 * Returns true if item "itemCode" is a part of this RecipeSide, false otherwise.
	 *
	 * @param {string} itemCode
	 * @return {boolean}
	 */
	hasItem( itemCode ) {
		return !!this.items[itemCode];
	}

	/**
	 * Append all materials from another RecipeSide object to this RecipeSide object.
	 *
	 * @param {RecipeSide} anotherRecipeSide
	 */
	addEverythingFrom( anotherRecipeSide ) {
		for ( var [ itemCode, rows ] of Object.entries( anotherRecipeSide.items ) ) {
			this.items[itemCode] = ( this.items[itemCode] || [] ).concat( rows );
		}
	}

	/**
	 * Get list of unique IDs of items in this RecipeSide object.
	 *
	 * @return {string[]}
	 */
	getItemCodes() {
		return Object.keys( this.items ).filter( ( itemCode ) => itemCode !== 'pseudo:' );
	}

	/**
	 * Iterate over [ itemCode, quantityAttributes ] pairs.
	 *
	 * @generator
	 * @yield {Array}
	 */
	*rowIterator() {
		for ( var [ itemName, rows ] of Object.entries( this.items ) ) {
			for ( var quantityAttributes of rows ) {
				yield [ itemName, quantityAttributes ];
			}
		}
	}

	/**
	 * Returns true if this RecipeSide has correct format. (This is used in sanity checks)
	 * See isValidAttribute() for which values are valid. Note: {} is valid (unknown/any quantity).
	 *
	 * @return {boolean}
	 */
	isValid() {
		for ( var itemCode of Object.keys( this.items ) ) {
			if ( typeof ( itemCode ) !== 'string' || itemCode === 'undefined' ) {
				return false;
			}
		}

		for ( var [ , quantityAttributes ] of this.rowIterator() ) {
			for ( var [ attr, value ] of Object.entries( quantityAttributes ) ) {
				if ( !this.isValidAttribute( attr, value ) ) {
					return false;
				}
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
	 * Get wikitext representation of this RecipeSide.
	 *
	 * @param {string} craftingStation
	 * @return {string}
	 */
	toWikitext( craftingStation ) {
		var wikitext = '';

		for ( var [ itemCode, amount ] of this.rowIterator() ) {
			// Human-readable string that can be used to mention this item, e.g. "[[Carbon Dioxide]]".
			// This can be provided as wikitext (e.g. pseudo-item "Air (on Desert planets)" for the
			// outputs of Atmospheric Condenser, but in most cases it will be a normal item.
			var displayNameWikitext = amount.displayNameWikitext;
			if ( !displayNameWikitext ) {
				// Detect pseudo-item codes like "monster:poptop", which mean Poptop monster.
				// Here the string "monster" is called "namespace".
				// If namespace is empty, then this is a real item from ItemDatabase, not a pseudo-item.
				if ( itemCode.startsWith( 'monster:' ) ) {
					var monsterCode = itemCode.replace( /^monster:/, '' );
					var monster = Query.findMonster( monsterCode );
					if ( !monster ) {
						util.log( '[warn] Unknown monster in the recipe: ' + monsterCode );
						return '';
					}

					displayNameWikitext = '[[' + monster.displayName + ']]';
				} else {
					// Normal item.
					var item = Query.findItem( itemCode );
					if ( !item ) {
						util.warnAboutUnknownItem( itemCode );
						return '';
					}

					// Link to the article about this item.
					displayNameWikitext = item.getWikiPageLink();
				}
			}

			wikitext += '* ';
			if ( amount.count ) {
				wikitext += "'''" + amount.count + "x''' ";
			}

			wikitext += displayNameWikitext;

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

				if ( craftingStation === 'Gas Centrifuge' ) {
					wikitext += '|onlyGasCentrifuge=1';
				} else if ( craftingStation === 'Sifter' ) {
					wikitext += '|sifter=1';
				} else if ( craftingStation === 'Rock Crusher' ) {
					wikitext += '|rock=1';
				}

				wikitext += "}})''";
			}

			if ( amount.subtype ) {
				// For bees, saplings, etc. (inputs that can have different outputs depending of subtype)
				wikitext += " ''(" + amount.subtype + ")''";
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

			wikitext += '\n';
		}

		return wikitext;
	}
}

module.exports = RecipeSide;
