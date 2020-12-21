/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

'use strict';

const { ItemDatabase, RecipeDatabase, ResearchTreeDatabase, ArmorSetDatabase, MonsterDatabase,
	ResultsWriter, util } = require( './lib' );

/* -------------------------------------------------------------------------------------------- */

// Generate the wikitext for each item that has at least 1 Recipe.
// Then send the results to ResultsWriter.write().

for ( var itemCode of RecipeDatabase.listMentionedItemCodes() ) {
	var item = ItemDatabase.find( itemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		util.warnAboutUnknownItem( itemCode );
		continue;
	}

	if ( item.isCodex() ) {
		// Codexes will be handled below.
		continue;
	}

	ResultsWriter.writeItem( item );
}

// Write all non-vanilla codexes (regardless of whether they have a recipe or not). Skip vanilla codexes.
ItemDatabase.forEach( ( itemCode, item ) => {
	if ( item.isNonVanillaCodex() ) {
		ResultsWriter.writeItem( item );
	}
} );

// Generate Cargo database of all known recipes.
RecipeDatabase.forEach( ( recipe ) => {
	ResultsWriter.writeRecipe( recipe );
} );

// Generate Cargo database of all research nodes.
ResearchTreeDatabase.forEach( ( node ) => {
	ResultsWriter.writeResearchNode( node );
} );

// Generate Cargo database of all known armor sets.
ArmorSetDatabase.forEach( ( armorSet ) => {
	ResultsWriter.writeArmorSet( armorSet );
} );


// Generate Cargo database of all known armor sets.
MonsterDatabase.forEach( ( monster ) => {
	ResultsWriter.writeMonster( monster );
} );


ResultsWriter.finalize();
