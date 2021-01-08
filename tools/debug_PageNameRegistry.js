/**
 * Run some manual checks on PageNameRegistry.
 */

'use strict';

var { RecipeDatabase, ItemDatabase, PageNameRegistry } = require( '../lib' );

// This will load almost everything - items, monsters, etc.
RecipeDatabase.load();

// Resolve.
PageNameRegistry.resolve();

// Some specific tests.
console.log( [
	PageNameRegistry.getTitleFor( ItemDatabase.find( 'zerchtable' ) ),
	PageNameRegistry.getTitleFor( ItemDatabase.find( 'zerchesiumtable' ) )
].join( ', ' ) );
