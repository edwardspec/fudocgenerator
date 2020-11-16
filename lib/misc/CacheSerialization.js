/**
 * Helper methods to serialize/deserialize JavaScript objects before writing them into cache.
 */

'use strict';

const avro = require( 'avsc' );

// Having serialization schema of Apache Avro for some data type (e.g. crafting recipes)
// allows us to serialize/deserialize them more efficiently.
// Format: { dataType1: avro.Type.forSchema( ... ), dataType2: ..., ... }
var avroSchemaForType = {};

// Crafting recipes (*.recipe files).
const recipeIngredientSchema = {
	type: 'record',
	fields: [
		{ name: 'item', type: 'string', default: '' },
		{ name: 'name', type: 'string', default: '' },
		{ name: 'count', type: 'int', default: 1 }
	]
};
const recipeIngredientsListSchema = [
	recipeIngredientSchema,
	{
		type: 'array',
		items: recipeIngredientSchema
	}
];
const recipeSchema = {
	type: 'record',
	fields: [
		{ name: 'input', type: recipeIngredientsListSchema },
		{ name: 'output', type: recipeIngredientsListSchema },
		{ name: 'groups', type: { type: 'array', items: 'string' } }
	]
};
avroSchemaForType['recipe'] = avro.Type.forSchema( recipeSchema );

/**
 * Convert JavaScript object into string.
 * @param {object} arbitraryData
 * @param {string} dataType Specifies format, e.g. "recipe".
 * If schema for this format exists, we use binary format, making deserialization much faster.
 * @return Buffer|string
 */
module.exports.serialize = function ( arbitraryData, dataType = 'unknown' ) {
	var avroType = avroSchemaForType[dataType];
	if ( avroType ) {
		try {
			return avroType.toBuffer( arbitraryData );
		} catch ( err ) {
			console.log( '\nerror serializing ' + dataType + ' using Avro!\n' + JSON.stringify( arbitraryData, null, '  ' ) + '\n' );
			require( 'process' ).exit( 1 );
		}
	}

	return JSON.stringify( arbitraryData );
};

/**
 * Convert serialized object (string) into JavaScript object.
 * @param {Buffer} serializedBuffer
 * @param {string} dataType
 * @return string
 */
module.exports.deserialize = function ( serializedBuffer, dataType = 'unknown' ) {
	var avroType = avroSchemaForType[dataType];
	if ( avroType ) {
		return avroType.fromBuffer( serializedBuffer );
	}

	return JSON.parse( serializedBuffer.toString() );
};
