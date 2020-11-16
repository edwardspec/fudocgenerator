/**
 * Helper methods to serialize/deserialize JavaScript objects before writing them into cache.
 */

'use strict';

/**
 * Convert JavaScript object into string.
 * @param {object} arbitraryData
 * @param {string} dataType Specifies format, e.g. "recipe".
 * If schema for this format exists, we use binary format, making deserialization much faster.
 * @return string
 */
module.exports.serialize = function ( arbitraryData, dataType = 'unknown' ) {
	return JSON.stringify( arbitraryData );
};

/**
 * Convert serialized object (string) into JavaScript object.
 * @param {string} serializedString
 * @param {string} dataType
 * @return string
 */
module.exports.deserialize = function ( serializedString, dataType = 'unknown' ) {
	return JSON.parse( serializedString );
};
