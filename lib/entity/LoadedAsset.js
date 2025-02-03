'use strict';

const { config, util } = require( '..' ),
	lodash = require( 'lodash' );

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
		this.db = db;

		if ( !this.absolutePath ) {
			// Can happen after JSON.parse(JSON.stringify(asset)).
			this.absolutePath = ( this.vanilla ? config.pathToVanilla : config.pathToMod ) +
				'/' + this.filename;
		}
	}

	/**
	 * Creates a pseudo-asset with the same paths, type, etc. as in "parentAsset".
	 * This is used by Item objects that represent a building with multiple upgrade stages
	 * (each of those stages is an Item object that needs its own LoadedAsset).
	 *
	 * @param {LoadedAsset} parentAsset
	 * @param {Object} childData Value of "data" in the newly created child asset.
	 * @return {LoadedAsset}
	 */
	static newChildAsset( parentAsset, childData ) {
		var assetInfo = {
			filename: parentAsset.filename,
			absolutePath: parentAsset.absolutePath,
			vanilla: parentAsset.vanilla,
			type: parentAsset.type,
			data: childData
		};
		return new LoadedAsset( parentAsset.db, assetInfo );
	}

	/**
	 * Load this asset immediately. Sets this.data if successful.
	 *
	 * @return {Object|null} Value of this.data.
	 */
	loadNow() {
		var data = {};
		if ( !this.notJson ) {
			data = util.loadModFile( this.absolutePath );
			if ( !data ) {
				return null;
			}

			// Is there a patch?
			var patchAsset = this.db.knownPatches.get( this.filename );
			if ( patchAsset ) {
				// We need to apply instructions from patch to "this.data".
				this.applyPatchInstructions( patchAsset.data || patchAsset.loadNow(), data );

				// Just in case (not really used): remember the fact that this asset was patched.
				this.patched = true;
			}

			// Remove keys that we don't use (reduces cache size, improves loading time).
			util.removeIrrelevantAssetKeys( data );
		}

		// Set this.data, which is used by everything except AssetDatabase.
		this.data = data;
		return data;
	}

	/**
	 * Returns the fields that must be included into JSON.stringify().
	 * This is used in AssetDatabase.updateCache().
	 * Note that "absolutePath" is excluded, because we can restore it from "filename" and "vanilla".
	 * Not saving this path reduces loading time.
	 *
	 * @return {Object}
	 */
	toJSON() {
		var ret = {
			filename: this.filename,
			vanilla: this.vanilla,
			type: this.type,
			data: this.data
		};
		if ( this.patched ) {
			ret.patched = true;
		}
		if ( this.overwrittenVanilla ) {
			ret.overwrittenVanilla = true;
		}

		return ret;
	}

	/**
	 * Apply the JSON patch to JSON data.
	 *
	 * @param {Object} patch
	 * @param {Object} data
	 */
	applyPatchInstructions( patch, data ) {
		// This is set to true if we find "test" operation that tells us to ignore the rest of this patch.
		var patchSkipped = false;

		patch.forEach( ( instruction ) => {
			if ( patchSkipped ) {
				// This instruction must be ignored, because preceding "test" instruction says so.
				return;
			}

			if ( Array.isArray( instruction ) ) {
				// This is an array of instructions, not a single instruction.
				// Handle this recursively.
				this.applyPatchInstructions( instruction, data );
				return;
			}

			var op = instruction.op,
				value = instruction.value;

			if ( op === 'copy' || op === 'move' ) {
				// These operations are not supported.
				// They are also not used in the mod.
				return;
			}

			if ( instruction.path === '/-' && op === 'add' ) {
				// Special case: the entire data is an array, and we are adding new element to the bottom of it.
				data.push( value );
				return;
			}

			var objectPath = instruction.path.slice( 1 ).split( '/' );
			if ( op === 'add' ) {
				// Handle add operations to: 1) "/some-array/-" (add to the end of array)
				// 2) "/some-array/123" (add the new element BEFORE what is currently element #123).
				var possiblyIndex = objectPath.pop();

				if ( possiblyIndex !== '-' && Number.isNaN( Number( possiblyIndex ) ) ) {
					// Not an index. We don't consider this an "add to array" operation,
					// instead this is "add new key-value" operation.
					objectPath.push( possiblyIndex );
				} else {
					var currentArray = ( lodash.get( data, objectPath ) || [] );

					if ( possiblyIndex === '-' ) {
						// Pseudo-value "-" means "add after the last element of array".
						// Here "value" is the new element that we are adding.
						value = currentArray.concat( [ value ] );
					} else {
						// Add "value" to currentArray BEFORE currentArray[possiblyIndex]
						var before = currentArray.slice( 0, possiblyIndex ),
							after = currentArray.slice( possiblyIndex );

						value = before.concat( [ value ] ).concat( after );
					}

					op = 'replace';
				}
			}

			if ( op === 'replace' || op === 'add' ) {
				lodash.set( data, objectPath, value );
			} else if ( op === 'remove' ) {
				// Carefully delete the element from Array/Object.
				// Note: while lodash.unset() would be enough for objects, using it to delete keys from arrays
				// would create holes in the array, resulting in incorrect application of further patches.
				var index = objectPath.pop();
				var list = lodash.get( data, objectPath );

				if ( Array.isArray( list ) ) {
					// Removing numeric index from array.
					list.splice( index, 1 );
					lodash.set( list, objectPath );
				} else {
					// Unsetting property of object.
					objectPath.push( index );
					lodash.unset( data, objectPath );
				}
			} else if ( op === 'test' ) {
				var fieldExists = lodash.has( data, objectPath );
				if ( fieldExists && instruction.inverse ) {
					// This patch shouldn't be applied if the field exists.
					patchSkipped = true;
				} else if ( !fieldExists && !instruction.inverse ) {
					// This patch shouldn't be applied, because the field doesn't exist.
					patchSkipped = true;
				}
			}
		} );
	}
}

module.exports = LoadedAsset;
