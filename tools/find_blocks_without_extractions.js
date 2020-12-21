/**
 * Find all blocks without extraction/sifting/crushing/smelting recipes.
 */

'use strict';

const { ItemDatabase, RecipeDatabase } = require( '../lib' );

// These stations count as "automatic processing" (extraction, sifting, etc.) by this script.
var processingStations = new Set( [
	'Extraction Lab',
	'Extraction Lab MKII',
	'Quantum Extractor',
	'Sifter',
	'Powder Sifter',
	'Rock Breaker',
	'Rock Crusher',
	'Electric Furnace',
	'Blast Furnace',
	'Arc Smelter'
] );

var allBlocks = new Set();
var blocksWithExtractions = new Set();
var craftableBlocks = new Set();
var blocksCraftableIntoSomethingElse = new Set();

ItemDatabase.forEach( ( itemCode, item ) => {
	if ( item.category !== 'block' ) {
		// Only interested in blocks.
		return;
	}

	allBlocks.add( item.itemCode );

	RecipeDatabase.forEach( ( recipe ) => {
		var isExtraction = processingStations.has( recipe.station );
		var isRecipeInput = recipe.inputs.getItemCodes().includes( item.itemCode );

		if ( isExtraction && isRecipeInput ) {
			// This block can be extracted into something.
			blocksWithExtractions.add( item.itemCode );
		} else if ( !isExtraction ) {
			if ( recipe.outputs.getItemCodes().includes( item.itemCode ) ) {
				// This block can be crafted from something.
				craftableBlocks.add( item.itemCode );
			}

			if ( isRecipeInput ) {
				// This block can be crafted INTO something.
				blocksCraftableIntoSomethingElse.add( item.itemCode );
			}
		}
	} );
} );

console.log( 'List of blocks that can\'t be extracted/sifted/crushed/smelted. (note: this list is NOT updated automatically)' );
console.log( '{| class="wikitable sortable"\n ! Item code !! Name !! Can you craft this block? !! Can you craft something else FROM this block?' );
[...allBlocks].sort().forEach( ( itemCode ) => {
	if ( blocksWithExtractions.has( itemCode ) ) {
		// We are making a list of blocks without extractions.
		return;
	}

	console.log( ' |-\n | ' + itemCode + ' || ' + ItemDatabase.find( itemCode ).getWikiPageLink() + ' || ' +
		( craftableBlocks.has( itemCode ) ? 'Yes' : 'No' ) + ' || ' +
		( blocksCraftableIntoSomethingElse.has( itemCode ) ? 'Yes' : 'No' )
	);
} );

console.log( ' |}' );
