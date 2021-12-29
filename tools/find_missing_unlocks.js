/**
 * Finds all craftable items that are not unlocked by anything.
 */

'use strict';

const { CraftingStationDatabase, ItemDatabase, Recipe, RecipeDatabase,
	ResearchTreeDatabase, QuestDatabase } = require( '../lib' );

// Find items with unlocks.
var unlockableItems = new Set();

ResearchTreeDatabase.forEach( ( node ) => {
	for ( let itemCode of node.unlocks ) {
		// Unlocked via research trees.
		unlockableItems.add( itemCode );
	}
} );

ItemDatabase.forEach( ( itemCode, item ) => {
	( item.learnBlueprintsOnPickup || [] ).forEach( ( unlockedItemCode ) => {
		// Unlocked by picking up an item.
		unlockableItems.add( unlockedItemCode );
	} );
} );

RecipeDatabase.forEach( ( recipe ) => {
	recipe.outputs.getAllComponents().forEach( ( component ) => {
		if ( component.quantity.isBlueprint ) {
			// Blueprint item ("<something>-recipe") can be found by player.
			unlockableItems.add( component.id );
		}
	} );
} );

QuestDatabase.forEach( ( quest ) => {
	if ( !quest.scriptConfig ) {
		return;
	}

	( quest.scriptConfig.giveBlueprints || [] ).forEach( ( itemCode ) => {
		// Blueprint is a quest reward.
		unlockableItems.add( itemCode );
	} );
} );

// Find craftable items.
var craftableItems = new Set();

RecipeDatabase.forEach( ( recipe ) => {
	if ( recipe.type !== Recipe.Type.Crafting ) {
		return;
	}

	if ( !CraftingStationDatabase.requiresBlueprint( recipe.station ) ) {
		// Doesn't require a blueprint.
		return;
	}

	let itemCode = recipe.outputs.getAllCodes()[0];
	craftableItems.add( itemCode );
} );

// Find craftable items without an unlock.
[...craftableItems].sort().forEach( ( itemCode ) => {
	if ( !unlockableItems.has( itemCode ) ) {
		console.log( itemCode );
	}
} );
