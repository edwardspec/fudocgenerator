/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 * Usage: first you add recipes via add(). Then you use makeSearchIndex().
 */

const Recipe = require( './Recipe' ),
	RecipeSearchIndex = require( './RecipeSearchIndex' );

class RecipeDatabase {
	constructor() {
		// Array of all known recipes.
		this.knownRecipes = [];
	}

	/**
	 * Record the recipe into the database. This makes this recipe findable via search methods.
	 * See [Recipe.js] for meaning of parameters.
	 */
	add( station, inputs, outputs ) {
		var RecipeObject = new Recipe( station, inputs, outputs );

		// Sanity check. Prevent unchecked objects from being added into database.
		// Note: we are not throwing an exception (displaying tolerance to bad input),
		// because bad recipe likely means incomplete work-in-progress object from the mod,
		// and such "temporarily broken recipe" shouldn't stop this script from running.
		if ( !RecipeObject.isValid() ) {
			console.log( RecipeObject );

			// Don't add.
			console.log( 'Invalid recipe found: [' + JSON.stringify( RecipeObject ) + ']' );
			return;
		}

		this.knownRecipes.push( RecipeObject );
	}

	/**
	 * Debugging method: print the entire database to STDOUT (for troubleshooting).
	 */
	dump() {
		console.log( JSON.stringify( this.knownRecipes, null, '  ' ) );
	}

	/**
	 * Returns an index that can be used to rapidly search the database.
	 * @return {RecipeSearchIndex}
	 */
	makeSearchIndex() {
		return new RecipeSearchIndex( this );
	}
}

module.exports = new RecipeDatabase();
