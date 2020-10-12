'use strict';

var fs = require( 'fs' ),
	os = require( 'os' ),
	path = require( 'path' ),
	ConsistentHashing = require( 'consistent-hashing' ),
	jsonpack = require( 'jsonpack' ),
	util = require( './util' );

/**
 * Utility methods to split the file into delimited "chunks", each no more than N kilobytes.
 * MediaWiki can't handle large pages, especially ones with lots of {{#cargo_store}}, so we must
 * be responsible and split these pages into small "chunk" pages with reasonable parse time.
 *
 * Usage:
 *	writer = new ChunkWriter( ... );
 *	writer.write( 'something' );
 *	writer.write( 'something else' );
 *	writer.finalize();
 * Calling finalize() is mandatory, otherwise the last footer won't be added.
 */

class ChunkWriter {
	constructor() {
		// This cache is used to avoid heavy calculations of checksums for Consistent Hashing purposes.
		// Format: { partitionKey: partitionName, ... },
		// where "partitionKey" is arbitary string received by write(),
		// and "partitionName" defines a /Chunk<something> subpage where this entry will be be stored.
		this.cache = {};
		this.cacheFilename = os.tmpdir() + '/fudocgenerator/chunkNameToPartition.cache';
		this.cacheOutdated = false;

		if ( fs.existsSync( this.cacheFilename ) ) {
			this.cache = jsonpack.unpack( fs.readFileSync( this.cacheFilename ).toString() );
		}

		// Every call of write() results in 1 additional element in "entries" array.
		// Format: [ { partitionKey: "partitionKey1", text: "text1" }, ... ]
		this.entries = [];
	}

	/**
	 * Add one more entry.
	 * @param {string} partitionKey Arbitrary string, affects "into which chunk will this record go".
	 * @param {string} text
	 */
	write( partitionKey, text ) {
		this.entries.push( { partitionKey: partitionKey, text: text } );
	}

	/**
	 * Group all entries (from previous calls to write()) into chunks and write them into the file.
	 * @param {string} filename Name of output file. This file will be overwritten.
	 * @param string headerText Can contain "$1" (will be replaced with the number of chunk).
	 * @param string footerText
	 * @param int averageChunkSizeBytes
	 */
	finalize( filename, headerText, footerText, averageChunkSizeBytes ) {
		// For statistics only: { "chunkName": "bytesWrittenIntoThisChunk", ... }
		var bytesWritten = {};

		// First, let's determine how many chunks will we need,
		// based on 1) total length of all entries and 2) desired average size of chunk.
		var totalSize = 0;
		this.entries.forEach( ( entry ) => { totalSize += entry.text.length } );

		var chunksCount = Math.ceil( totalSize / averageChunkSizeBytes );
		util.log( "[notice] ChunkWriter: going to write " + chunksCount + " chunks (totalSize = " +
			totalSize + " bytes, requested average size = " + averageChunkSizeBytes + " bytes)." );

		// Create a map of partition names (we just use the number of the chunk, starting with 1)
		// to the array of indices from this.entries array (for entries that should be in this chunk).
		var chunkPartitions = {};
		for ( var i = 1; i <= chunksCount; i ++ ) {
			chunkPartitions['Chunk' + i] = [];
		}

		// Use consistent hashing algorithm to split the "entries" array into chunks.
		// This is to avoid having to overwrite entirety of chunks 5-100 if something changed in chunk 5.
		var partitionSelector = new ConsistentHashing( Object.keys( chunkPartitions ), {
			replicas: 10
		} );

		// TODO: invalidate this.cache if the number of partitions has changed since it was created.

		// This is a very time-intensive operation (repetitive hashing of all partition keys),
		// so measure how much time did it take.
		var secondsSpent,
			startTime = Date.now();

		this.entries.forEach( ( entry, idx ) => {
			var partitionKey = entry.partitionKey;

			// Calls to partitionSelector.getNode() are computation-heavy, so we check the cache first.
			var chunkName = this.cache[partitionKey];
			if ( !chunkName ) {
				chunkName = partitionSelector.getNode( partitionKey );
				this.cache[partitionKey] = chunkName;

				// Some new item, etc. was added. Let's remember that we need to update the cache.
				this.cacheOutdated = true;
			}

			chunkPartitions[chunkName].push( idx );
			bytesWritten[chunkName] = 0;
		} );
		secondsSpent = ( Date.now() - startTime ) / 1000;

		// Now write chunks into the output file, one chunk at a time,
		// while surrounding each chunk with headerText/footerText.
		var fd = fs.openSync( filename, 'w' );
		for ( var [ chunkName, entryIds ] of Object.entries( chunkPartitions ) ) {
			var chunkLength = 0;

			chunkLength += fs.writeSync( fd, headerText.replace( /\$1/g, chunkName ) );
			entryIds.map( ( id ) => this.entries[id].text ).forEach( ( text ) => {
				chunkLength += fs.writeSync( fd, text );
			} );
			chunkLength += fs.writeSync( fd, footerText );

			bytesWritten[chunkName] += chunkLength;
		}

		fs.closeSync( fd );

		util.log( '[debug] ChunkWriter: splitting took ' + secondsSpent + ' seconds, ' +
			'sizes of chunks (KB): ' +
			Object.values( bytesWritten )
				.map( ( a ) => Math.round( ( a || 0 ) / 1024 ) )
				.sort( ( a, b ) => a - b )
				.join( ', ' )
		);

		if ( this.cacheOutdated ) {
			// Update the cache.
			fs.mkdirSync( path.dirname( this.cacheFilename ), { recursive: true } );
			fs.writeFileSync( this.cacheFilename, jsonpack.pack( this.cache ) );

			console.log( '[notice] ChunkWriter: updated the cache (now contains partition keys for ' + Object.keys( this.cache ).length + ' entries).' );
		}
	}
}

module.exports = ChunkWriter;
