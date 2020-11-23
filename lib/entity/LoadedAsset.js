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
		Object.assign( this, assetInfo );
		Object.defineProperty( this, 'db', {
			value: db,
			enumerable: false // Don't include this field into JSON.stringify(asset)
		} );
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
			this.db.applyPatchInstructions( patchAsset.data || patchAsset.loadNow(), data );

			// Just in case (not really used): remember the fact that this asset was patched.
			this.patched = true;
		}

		// Set this.data, which is used by everything except AssetDatabase.
		this.data = data;
		return data;
	}
}

module.exports = LoadedAsset;
