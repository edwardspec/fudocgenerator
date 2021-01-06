'use strict';

const { RecipeComponent } = require( '..' );

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeSide {
	constructor() {
		// Format: { itemCode1: [ RecipeComponent1, RecipeComponent2, ... ], itemCode2: ... }
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

		for ( var [ itemCode, counts ] of Object.entries( valuesArray ) ) {
			var count = Number.isInteger( counts ) ? counts : counts[extractorStage];
			side.addItem( itemCode, { count: count } );
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
	 * Add 1 arbitrary RecipeComponent to this RecipeSide object.
	 * Outside of RecipeSide class, you should use addItem(), addMonster(), etc. instead.
	 *
	 * @param {RecipeComponent} component
	 * @return {this}
	 */
	addComponent( component ) {
		var id = component.id;
		if ( !this.items[id] ) {
			// Most likely situation: adding a new item.
			this.items[id] = [];
		} else {
			// This item already exists in this RecipeSide,
			// so let's check if we can merge quantityAttributes into existing component.
			// For example, { count: 5 } and { count: 7 } can be combined into { count: 12 }.
			for ( var existingComponent of this.items[id] ) {
				if ( existingComponent.attemptMerge( component ) ) {
					// Successfully added to existing component.
					return this;
				}
			}
		}

		this.items[id].push( component );
		return this;
	}

	/**
	 * Add 1 item to this RecipeSide object.
	 *
	 * @param {string} itemCode
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addItem( itemCode, quantityAttributes = {} ) {
		return this.addComponent( RecipeComponent.newItem( itemCode, quantityAttributes ) );
	}

	/**
	 * Add 1 pseudo-item (something that doesn't have an item ID) to this RecipeSide object.
	 *
	 * @param {string} displayName Atritrary string, e.g. "Air" (for Atmospheric Condenser recipes).
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addPseudoItem( displayName, quantityAttributes = {} ) {
		return this.addComponent( RecipeComponent.newPseudoItem( displayName, quantityAttributes ) );
	}

	/**
	 * Add 1 monster pseudo-item (something that has a valid monster ID) to this RecipeSide object.
	 *
	 * @param {string} monsterCode
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addMonster( monsterCode, quantityAttributes = {} ) {
		return this.addComponent( RecipeComponent.newMonster( monsterCode, quantityAttributes ) );
	}

	/**
	 * Add 1 quest pseudo-item (something that has a valid quest ID) to this RecipeSide object.
	 * This is useful for recipe inputs (for items that are unavailable until a quest is completed).
	 *
	 * @param {string} questCode
	 * @return {this}
	 */
	addQuest( questCode ) {
		return this.addComponent( RecipeComponent.newQuest( questCode ) );
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
		Object.values( this.items )[0][0].setQuantity( 'secondsToCraft', seconds );
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
	 * Get list of unique IDs of items (including pseudo-items like "monster:") in this RecipeSide.
	 * Doesn't include the non-specific pseudo-item "pseudo:" (it's not useful for search purposes).
	 *
	 * @return {string[]}
	 */
	getAllCodes() {
		return Object.keys( this.items ).filter( ( itemCode ) => itemCode !== 'pseudo:' );
	}

	/**
	 * Get list of unique IDs of regular items (NOT pseudo-items like "monster:") in this RecipeSide.
	 *
	 * @return {string[]}
	 */
	getItemCodes() {
		return this.getAllCodes().filter( ( itemCode ) => !itemCode.match( /^(monster|quest):/ ) );
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

		return Object.values( this.items ).flat().every( ( component ) => component.isValid() );
	}

	/**
	 * Get wikitext representation of this RecipeSide.
	 *
	 * @param {string} craftingStation
	 * @return {string}
	 */
	toWikitext( craftingStation ) {
		var wikitext = '';
		for ( var component of Object.values( this.items ).flat() ) {
			var componentWikitext = component.toWikitext( craftingStation );
			if ( !componentWikitext ) {
				// This recipe contains an ID of nonexistent item, monster, etc.
				return '';
			}

			wikitext += componentWikitext;
		}

		return wikitext;
	}
}

module.exports = RecipeSide;
