/**
 * Check several JSON assets for validity, allowing "relaxed JSON" that is allowed by the game.
 * Usage: node lint_json.js FILENAME1 [FILENAME2...]
 *
 * Can theoretically be used to check JSON files in parallel, e.g. (for *.object files only):
 * find /path/to/FrackinUniverse -name "*.object" | xargs -P 4 -d '\n' node tools/lint_json.js || echo 'There were errors!'
 */

'use strict';

const { util } = require( '../lib' ),
	process = require( 'process' ),
	path = require( 'path' );

var filenamesToCheck = process.argv.slice( 2 );
if ( !filenamesToCheck ) {
	process.stderr.write( 'Usage: node lint_json.js FILENAME1 [FILENAME2...]\n' );
	process.exit( 1 );
}

console.log( 'Checking ' + filenamesToCheck.length + ' JSON files.' );

// Print all errors to stdout.
util.log = ( msg ) => process.stderr.write( msg + '\n' );

var hasError = 0;
filenamesToCheck.forEach( ( filename ) => {
	if ( !util.loadModFile( path.resolve( filename ) ) ) {
		hasError = 1;
	}
} );
process.exit( hasError ? 1 : 0 );
