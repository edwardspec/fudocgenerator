/**
 * List all monster names that are shared by more than 1 monster.
 */

'use strict';

var { RecipeDatabase, ItemDatabase, PageNameRegistry } = require( '../lib' );

// This will load almost everything - items, monsters, etc.
RecipeDatabase.load();

// Resolve.
PageNameRegistry.resolve();

// Some specific tests.
console.log(
	PageNameRegistry.getTitleFor( ItemDatabase.find( 'spookypie' ) ),
	PageNameRegistry.getTitleFor( ItemDatabase.find( 'spookypieobject' ) )
);
