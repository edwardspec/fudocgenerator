/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

const { ItemDatabase, RecipeDatabase, ResearchTreeDatabase,
	ResultsWriter, util } = require( './lib' );

/*-------------------------------------------------------------------------------------------- */

// Generate the wikitext for each item that has at least 1 Recipe.
// Then send the results to ResultsWriter.write().

for ( var ItemCode of RecipeDatabase.listMentionedItemCodes() ) {
	var item = ItemDatabase.find( ItemCode );
	if ( !item ) {
		// Must be tolerant to bad input (ignore unknown items, continue with known items),
		// because a typo somewhere in the mod shouldn't stop the script.
		util.warnAboutUnknownItem( ItemCode );
		continue;
	}

	ResultsWriter.writeItem( item );
}

// Generate Cargo database of all known recipes.
RecipeDatabase.forEach( ( recipe ) => {
	ResultsWriter.writeRecipe( recipe );
} );

// Generate Cargo database of all research nodes.
ResearchTreeDatabase.forEach( ( node ) => {
	ResultsWriter.writeResearchNode( node );
} );

ResultsWriter.finalize();
