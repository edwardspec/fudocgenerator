/**
 * Tool to automatically generate documentation for the Frackin' Universe (Starbound mod)
 * directly from the sources of the mod (things like "what is material A extracted to/from").
 *
 * @author Edward Chernenko
 *
 * Usage: node generate.js
 */

var config = require( './config.json' ),
	fs = require( 'fs' ),
	vm = require( 'vm' );

var RecipeDatabase = require( './lib/RecipeDatabase' );

/**
 * Load the contents of one *.config/*.object file from the Starbound mod.
 * Returns the parsed structure.
 */
function loadModFile( filename ) {
	var jsSourceCode = fs.readFileSync( config.pathToMod + '/' + filename );

	// This config is fully functional JavaScript code (not JSON), with comments and all,
	// but without the necessary "module.exports =", so require() can't be used.
	return vm.runInNewContext( '_ThisVariableIsNeverUsed = ' + jsSourceCode );
}

// Load configs of all processing stations.
// NOTE: centrifugeConf covers not only centrifuges, but also powder sifters, honey jars, etc.
var centrifugeConf = loadModFile( 'objects/generic/centrifuge_recipes.config' ),
	extractorConf = loadModFile( 'objects/generic/extractionlab_recipes.config' ),
	blastFurnaceConf = loadModFile( 'objects/power/fu_blastfurnace/fu_blastfurnace.object' ),
	arcSmelterConf = loadModFile( 'objects/power/isn_arcsmelter/isn_arcsmelter.object' ),
	mixerConf = loadModFile( 'objects/power/fu_liquidmixer/fu_liquidmixer_recipes.config' );


/*-------------------------------------------------------------------------------------------- */
/* Step 1: Add recipes from Extractors into RecipeDatabase ----------------------------------- */
/*-------------------------------------------------------------------------------------------- */

/**
 * Helper function: reduces the array like { "carbon": 3, "oxygen": [ 1, 4, 9 ] }
 * into { "carbon": 3, "oxygen": 1 } for extractorStage=0,
 * into { "carbon": 3, "oxygen": 4 } for extractorStage=1, etc.
 */
function getStageValues( valuesArray, extractorStage ) {
	var valuesForThisStage = {};

	for ( var [ itemName, counts ] of Object.entries( valuesArray ) ) {
		valuesForThisStage[itemName] =
			Number.isInteger( counts ) ? counts : counts[extractorStage];
	}

	return valuesForThisStage;
}

for ( var extractorRecipe of extractorConf ) {
	var outputs = extractorRecipe.outputs;

	config.extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		RecipeDatabase.add(
			buildingName,
			getStageValues( extractorRecipe.inputs, extractorStage ),
			getStageValues( extractorRecipe.outputs, extractorStage )
		);
	} );
}


// TODO: add recipes from other Stations.






/*-------------------------------------------------------------------------------------------- */

RecipeDatabase.dump();
