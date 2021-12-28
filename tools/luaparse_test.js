/**
 * Experiment with parsing Lua files.
 */

'use strict';

const { config } = require( '../lib' ),
	fs = require( 'fs' ),
	luaParser = require( 'luaparse' );

const filename = config.pathToMod + '/stats/effects/fu_armoreffects/set_bonuses/tier6/sunwalkersetbonuseffect.lua',
	ast = luaParser.parse( fs.readFileSync( filename ).toString() );

console.log( JSON.stringify( ast, null, '\t' ) );
