'use strict';

const { util } = require( '..' );

/**
 * Represents one asset (parsed JSON file from either vanilla or the mod). Used in AssetDatabase.
 */
class LoadedAsset {
	/**
	 * @param {AssetDatabase} db Dependency injection of the AssetDatabase object.
	 * @param {Object} assetInfo Must contain keys: 'absolutePath' (string), 'filename' (string).
	 */
	constructor( db, assetInfo ) {
		this.db = db;
		Object.assign( this, assetInfo );
	}

	/**
	 * Load this asset immediately. Sets this.data if successful.
	 * @return {Object|null} Value of this.data.
	 */
	loadNow() {
		var data = util.loadModFile( this.absolutePath );
		if ( !data ) {
			return null;
		}

		// Is there a patch?
		var patchAsset = this.db.knownPatches.get( this.filename );
		if ( patchAsset ) {
			// We need to apply instructions from patch to "this.data".
			this.db.applyPatchInstructions( patchAsset.data, data );

			// Just in case (not really used): remember the fact that this asset was patched.
			this.patched = true;
		}

		// Delete the getter, so that next attempts to access .data won't call the function.
		Object.defineProperty( this, 'data', { value: data } );
		return data;
	}

	/**
	 * Getter that calls loadNow() if it hasn't been called yet.
	 * @return {Object} Contents of the parsed JSON file (arbitrary object).
	 */
	get data() {
		return this.loadNow();
	}
}

module.exports = LoadedAsset;
