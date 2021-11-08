'use strict';

const { RecipeComponent, SpawnTypeDatabase, util } = require( '..' );

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeSide {
	constructor() {
		// Format: { itemCode1: [ RecipeComponent1, RecipeComponent2, ... ], itemCode2: ... }
		this.items = new Map();

		// These items can have a visible wikitext, but are not listed by getAllCodes().
		this.unlistedItemCodes = new Set();
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
			var quantityAttributes = { count: ingredient.count || 1 };
			if ( ingredient.parameters ) {
				// Some crafted items have parameters, e.g. stem/foliage of Apple Tree Sapling.
				quantityAttributes.parameters = ingredient.parameters;
			}

			side.addItem( ingredient.item || ingredient.name, quantityAttributes );
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
	 * Determines the result of JSON.stringify(someRecipeSide).
	 * This is mainly for debug logs.
	 *
	 * @return {string}
	 */
	toJSON() {
		return [...this.items.values()].flat();
	}

	/**
	 * Add 1 arbitrary RecipeComponent to this RecipeSide object.
	 * Outside of RecipeSide class, you should use addItem(), addMonster(), etc. instead.
	 *
	 * @param {RecipeComponent} component
	 * @return {this}
	 */
	addComponent( component ) {
		this.addComponentWithoutSubcomponents( component );

		for ( var subcomponent of component.getSubComponents() ) {
			this.addComponent( subcomponent );
		}

		return this;
	}

	/**
	 * Same as addComponent(), but doesn't add subcomponents.
	 *
	 * @param {RecipeComponent} component
	 * @return {this}
	 */
	addComponentWithoutSubcomponents( component ) {
		var id = component.id;
		var list = this.items.get( id );
		if ( !list ) {
			// Most likely situation: adding a new item.
			list = [];
			this.items.set( id, list );
		} else {
			// This item already exists in this RecipeSide,
			// so let's check if we can merge quantityAttributes into existing component.
			// For example, { count: 5 } and { count: 7 } can be combined into { count: 12 }.
			for ( var existingComponent of list ) {
				if ( existingComponent.attemptMerge( component ) ) {
					// Successfully added to existing component.
					return this;
				}
			}
		}

		list.push( component );
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
	 * @param {string} displayName Arbitrary string, e.g. "Air" (for Atmospheric Condenser recipes).
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addPseudoItem( displayName, quantityAttributes = {} ) {
		return this.addComponent( RecipeComponent.newPseudoItem( displayName, quantityAttributes ) );
	}

	/**
	 * Add fuel (power output in Watts and decay rate in seconds) to this RecipeSide object.
	 *
	 * @param {int} power
	 * @param {int} decayRate
	 * @return {this}
	 */
	addFuel( power, decayRate ) {
		return this.addPseudoItem( power + 'W', { secondsToCraft: decayRate } );
	}

	/**
	 * Add time (in seconds) to this RecipeSide object.
	 *
	 * @param {int} minTime
	 * @param {int} maxTime Optional, set to 0 to not show.
	 * @param {string} extraComment
	 * @return {this}
	 */
	addTime( minTime, maxTime = 0, extraComment = '' ) {
		var wikitext = 'Time: ' + minTime;
		if ( maxTime && minTime != maxTime ) {
			wikitext += '-' + maxTime;
		}
		wikitext += 's';

		if ( extraComment ) {
			wikitext += " ''(" + extraComment + ")''";
		}

		return this.addComment( wikitext );
	}

	/**
	 * Add a comment (one line of text, e.g. "Two of these monsters:") to this RecipeSide object.
	 *
	 * @param {string} arbitraryWikitext
	 * @return {this}
	 */
	addComment( arbitraryWikitext ) {
		return this.addComponent( RecipeComponent.newComment( arbitraryWikitext ) );
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
	 * Add 1 biome pseudo-item (something that has a valid biome ID) to this RecipeSide object.
	 *
	 * @param {string} biomeCode
	 * @param {string} extraComment Can be used to specify the aspect of biome, e.g. "land" or "air".
	 * @return {this}
	 */
	addBiome( biomeCode, extraComment ) {
		return this.addComponent( RecipeComponent.newBiome( biomeCode, extraComment ) );
	}

	/**
	 * Add 1 music track pseudo-item (something that has a valid asset path) to this RecipeSide object.
	 *
	 * @param {string} assetPath
	 * @return {this}
	 */
	addMusicTrack( assetPath ) {
		return this.addComponent( RecipeComponent.newMusicTrack( assetPath ) );
	}

	/**
	 * Add 1 tenant pseudo-item (something that has a valid tenant ID) to this RecipeSide object.
	 *
	 * @param {string} tenantCode
	 * @return {this}
	 */
	addTenant( tenantCode ) {
		return this.addComponent( RecipeComponent.newTenant( tenantCode ) );
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
	 * Add 1 pool pseudo-item (something that has a valid TreasurePool ID) to this RecipeSide object.
	 *
	 * @param {string} poolName
	 * @param {float} weight
	 * @return {this}
	 */
	addPool( poolName, weight ) {
		return this.addComponent( RecipeComponent.newPool( poolName, weight ) );
	}

	/**
	 * Add 1 tree stem/foliage (something that has a valid stem/foliage ID) to this RecipeSide object.
	 *
	 * @param {string} name
	 * @param {boolean} isFoliage True for foliage, false for stem.
	 * @return {this}
	 */
	addSaplingPart( name, isFoliage ) {
		if ( name === '' ) {
			// Empty string (used in many .biome files) means "no stem/foliage is being added".
			return this;
		}

		return this.addComponent( RecipeComponent.newSaplingPart( name, isFoliage ) );
	}

	/*
	 * Add several RecipeComponent objects to this RecipeSide object, wrapping them in visible <div>.
	 * Shouldn't be used outside of RecipeSide class.
	 *
	 * @param {RecipeComponent[]} components
	 * @param {Object} quantityAttributes
	 * @param {string} headerText
	 * @return {this}
	 */
	addGroup( components, quantityAttributes, headerText ) {
		this.addPseudoItem( '<div class="recipe-group">' + ( headerText || '' ), {
			isComment: true,
			noLineBreak: true
		} );
		for ( var component of components ) {
			// "neverMerge" is to ensure that the same item inside and outside of this group won't be merged.
			component.setQuantity( 'neverMerge', true );
			this.addComponent( component );
		}

		quantityAttributes.isComment = true;
		return this.addPseudoItem( '</div>', quantityAttributes );
	}

	/**
	 * Add a list of several monsters, all of them wrapped in a styled <div> tag,
	 * based on ID of one the spawn types from SpawnTypeDatabase.
	 *
	 * @param {string} spawnTypeName
	 * @param {Object} quantityAttributes
	 * @return {this}
	 */
	addSpawnType( spawnTypeName, quantityAttributes = {} ) {
		var spawnType = SpawnTypeDatabase.find( spawnTypeName );
		if ( !spawnType ) {
			util.log( '[error] Unknown spawnType=' + spawnTypeName + ' in the recipe.' );
			return this;
		}

		var monsterType = spawnType.monsterType;
		if ( !Array.isArray( monsterType ) ) {
			// It's just 1 monster, so no need to wrap it into a group.
			// However, different spawn types can have the same monster, so mark this as non-mergeable.
			quantityAttributes.neverMerge = true;
			return this.addMonster( monsterType, quantityAttributes );
		}

		var components = [];
		var weightedMonsters = util.normalizeWeights( util.flattenWeightedPool( monsterType ) );

		for ( var [ chance, monsterCode ] of weightedMonsters ) {
			components.push( RecipeComponent.newMonster( monsterCode, { chance: chance * 100 } ) );
		}

		return this.addGroup( components, quantityAttributes );
	}

	/**
	 * Exclude 1 item from results of getAllCodes(). Doesn't remove the wikitext related to this item.
	 *
	 * @param {string} itemCode
	 * @return {this}
	 */
	makeItemUnlisted( itemCode ) {
		this.unlistedItemCodes.add( itemCode );
		return this;
	}

	/**
	 * Move item to the bottom of this RecipeSide object.
	 *
	 * @param {string} itemCode
	 * @return {this}
	 */
	moveItemToBottom( itemCode ) {
		var components = this.items.get( itemCode );
		if ( components ) {
			this.items.delete( itemCode );
			this.items.set( itemCode, components );
		}

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
		this.getAllComponents()[0].setQuantity( 'secondsToCraft', seconds );
	}

	/**
	 * Returns true if this RecipeSide object doesn't have any items, false otherwise.
	 *
	 * @return {boolean}
	 */
	isEmpty() {
		return this.items.size === 0;
	}

	/**
	 * Returns true if item "itemCode" is a part of this RecipeSide, false otherwise.
	 *
	 * @param {string} itemCode
	 * @return {boolean}
	 */
	hasItem( itemCode ) {
		return this.items.has( itemCode );
	}

	/**
	 * Append all materials from another RecipeSide object to this RecipeSide object.
	 *
	 * @param {RecipeSide} anotherRecipeSide
	 */
	addEverythingFrom( anotherRecipeSide ) {
		for ( var [ itemCode, rows ] of anotherRecipeSide.items ) {
			this.items.set( itemCode, ( this.items.get( itemCode ) || [] ).concat( rows ) );
		}
	}

	/**
	 * Get list of unique IDs of items (including pseudo-items like "monster:") in this RecipeSide.
	 * Doesn't include the non-specific pseudo-item ":(number_here)" (it's not useful for search purposes).
	 *
	 * @return {string[]}
	 */
	getAllCodes() {
		var codes = [];
		for ( var itemCode of this.items.keys() ) {
			if ( itemCode[0] !== ':' && !this.unlistedItemCodes.has( itemCode ) ) {
				codes.push( itemCode );
			}
		}
		return codes;
	}

	/**
	 * Get list of unique IDs of regular items (NOT pseudo-items like "monster:") in this RecipeSide.
	 *
	 * @return {string[]}
	 */
	getItemCodes() {
		return this.getAllCodes().filter( ( itemCode ) => !itemCode.match( /^(monster|quest|pool|biome|stem|foliage):/ ) );
	}

	/**
	 * Get list of unique IDs of treasure pools in this RecipeSide.
	 *
	 * @return {string[]}
	 */
	getPoolNames() {
		var poolCodes = [];
		for ( var itemCode of this.items.keys() ) {
			var match = itemCode.match( /^pool:(.*)$/ );
			if ( match ) {
				poolCodes.push( match[1] );
			}
		}
		return poolCodes;
	}

	/**
	 * Get the array of all RecipeComponent objects in this RecipeSide.
	 *
	 * @return {RecipeComponent[]}
	 */
	getAllComponents() {
		var allComponents = [];
		for ( var components of this.items.values() ) {
			for ( var component of components ) {
				allComponents.push( component );
			}
		}
		return allComponents;
	}

	/**
	 * Returns true if this RecipeSide has correct format. (This is used in sanity checks)
	 * See isValidAttribute() for which values are valid. Note: {} is valid (unknown/any quantity).
	 *
	 * @return {boolean}
	 */
	isValid() {
		for ( var itemCode of this.items.keys() ) {
			if ( typeof ( itemCode ) !== 'string' || itemCode === 'undefined' ) {
				return false;
			}
		}

		return this.getAllComponents().every( ( component ) => component.isValid() );
	}

	/**
	 * Get wikitext representation of this RecipeSide.
	 *
	 * @param {Object} renderParameters Extra options (if any) that affect wikitext generation.
	 * @return {string}
	 */
	toWikitext( renderParameters ) {
		var wikitext = '';
		for ( var component of this.getAllComponents() ) {
			var componentWikitext = component.toWikitext( renderParameters );
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
