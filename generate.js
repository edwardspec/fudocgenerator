/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

'use strict';

const { ItemDatabase, RecipeDatabase, ResearchTreeDatabase, ArmorSetDatabase, PlanetDatabase,
	BiomeDatabase, MonsterDatabase, RegionDatabase, WeatherPoolDatabase,
	ResultsWriter, TreasurePoolDatabase, util } = require( './lib' );

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
ItemDatabase.forEach( ( itemCode2, item2 ) => {
	if ( item2.isNonVanillaCodex() ) {
		ResultsWriter.writeItem( item2 );
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

// Generate Cargo database of all known monsters.
MonsterDatabase.forEach( ( monster ) => {
	ResultsWriter.writeMonster( monster );
} );

for ( var poolName of RecipeDatabase.listMentionedTreasurePools() ) {
	var pool = TreasurePoolDatabase.find( poolName );
	if ( !pool ) {
		util.log( '[error] Unknown TreasurePool in the recipe: ' + poolName );
		continue;
	}

	ResultsWriter.writeTreasurePool( pool );
}

PlanetDatabase.forEach( ( planet ) => {
	ResultsWriter.writePlanet( planet );
} );

RegionDatabase.forEach( ( region ) => {
	ResultsWriter.writeRegion( region );
} );

BiomeDatabase.forEach( ( biome ) => {
	ResultsWriter.writeBiome( biome );
} );

WeatherPoolDatabase.forEach( ( weatherPool ) => {
	ResultsWriter.writeWeatherPool( weatherPool );
} );

ResultsWriter.finalize();
