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

// Loop through ALL processing recipes and build 2 arrays: processedIntoMap and obtainedFromMap.
// Their format is: { codeOfItemOrMaterial: { buildingThatDoesProcessing: RECIPE },
// where RECIPE is { codeOfItem1: count1, codeOfItem2: count2, ... }.
// 1) Example for processedIntoMap:
// { liquidwater: { 'Extraction Lab': { fu_oxygen: 1, fu_hydrogen: 2, fu_salt: 1 } } }
// 2) Format of "obtainedFromMap" is TO BE DETERMINED (when Liquid Mixer recipes are supported).

var processedIntoMap = {}, obtainedFromMap = {};

/*-------------------------------------------------------------------------------------------- */
/*---------------- Step 1: Extractors -------------------------------------------------------- */
/*-------------------------------------------------------------------------------------------- */

// Array of Extractor names. Should be in the same order as outputs in [extractionlab_recipes.config].
var extractorStageBuildings = [ 'Extraction Lab', 'Extraction Lab MK II', 'Quantum Extractor' ];

for ( var extractorRecipe of extractorConf ) {
	var inputs = Object.keys( extractorRecipe.inputs )
	if ( inputs.length !== 1 ) {
		// NOTE: recipes with more than 1 input currently don't work (in FU itself),
		// so no need to support them for now.
		continue;
	}

	var input = inputs[0],
		outputs = extractorRecipe.outputs;

	// Here we group the "extraction results" by the Stage of the Extractor (its index
	// in "extractorStageBuildings" array).
	// For example, for Cookied Fish (gives 3 Research on stages 0/1, but 6 Research on stage 2):
	// [ { fuscienceresource: 3 }, { fuscienceresource: 3 }, { fuscienceresource: 6 } ]
	var stageOutput = [];

	for ( var [ outputItem, counts ] of Object.entries( outputs ) ) {
		// Some recipes (e.g. Iron Block -> Iron Bar) have only 1 count instead of an array of 3 counts.
		// Normalize the "counts" variable to be an array.
		if ( Number.isInteger( counts ) ) {
			counts = extractorStageBuildings.map( () => counts );
		}

		for ( var [ extractorStage, count ] of Object.entries( counts ) ) {
			if ( !stageOutput[extractorStage] ) {
				stageOutput[extractorStage] = {};
			}

			stageOutput[extractorStage][outputItem] = count;
		}
	}

	// Add this recipe to "processedIntoMap" map.
	if ( !processedIntoMap[input] ) {
		processedIntoMap[input] = {};
	}

	extractorStageBuildings.forEach( function ( buildingName, extractorStage ) {
		processedIntoMap[input][buildingName] = stageOutput[extractorStage];
	} );

	// TODO: update "obtainedFromMap" too.
}


console.log( processedIntoMap );
