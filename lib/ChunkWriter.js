'use strict';

var fs = require( 'fs' ),
	os = require( 'os' ),
	path = require( 'path' ),
	crypto = require( 'crypto' ),
	jumpConsistentHash = require( '@subspace/jump-consistent-hash' ).jumpConsistentHash,
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
	 * @param int chunksCount
	 * @param int maxChunkSizeBytes
	 */
	finalize( filename, headerText, footerText, chunksCount, maxChunkSizeBytes ) {
		// For statistics only: { "Chunk1": "bytesWrittenIntoChunk1", ... }
		var bytesWritten = {};

		// First, let's determine how many chunks will we need,
		// based on 1) total length of all entries and 2) desired average size of chunk.
		var totalSize = 0;
		this.entries.forEach( ( entry ) => { totalSize += entry.text.length } );

		util.log( "[notice] ChunkWriter: going to write " + chunksCount + " chunks (totalSize = " +
			totalSize + " bytes, estimated average size = " +  Math.floor( totalSize / chunksCount ) + " bytes)." );

		// Array of partitions, where each partition is an array of indices from this.entries array.
		var chunkPartitions = [];
		for ( var i = 0; i < chunksCount; i ++ ) {
			chunkPartitions[i] = [];
		}

		// Load the cache with the results of jumpConsistentHash().
		// It returns the same value for the same partitionKey (if the number of chunks hasn't changed),
		// so the cache can save some time.
		// Format: { partitionKey: chunkIndex, ... }.
		var cache = {},
			cacheFilename = os.tmpdir() + '/fudocgenerator/partitionKeyToChunk.cache',
			cacheOutdated = true;

		if ( fs.existsSync( cacheFilename ) ) {
			cache = JSON.parse( fs.readFileSync( cacheFilename ).toString() );

			if ( chunksCount !== cache.NUMBER_OF_CHUNKS ) {
				console.log( 'ChunkWriter: ignoring the cache as non-actual: it was calculated for '
					+ cache.NUMBER_OF_CHUNKS + ' chunks, and we plan to write ' + chunksCount + ' chunks.' );

				// If the number of chunks has changed, then some of the results are no longer valid.
				// We don't know "which ones", so discard the cache completely.
				cache = {};
			} else {
				cacheOutdated = false;
			}
		}

		// Statistics: measure how much time it takes to run Consistent Hashing algorithm.
		var secondsSpent,
			startTime = Date.now();

		this.entries.forEach( ( entry, idx ) => {
			var partitionKey = entry.partitionKey;

			// Check the cache first.
			var chunkIndex = cache[partitionKey];
			if ( chunkIndex === undefined ) {
				var hash = new Uint8Array( crypto.createHash( 'md5' ).update( partitionKey ).digest() );
				chunkIndex = jumpConsistentHash( hash, chunksCount );

				cache[partitionKey] = chunkIndex;

				// Some new item, etc. was added. Let's remember that we need to update the cache.
				cacheOutdated = true;
			}

			chunkPartitions[chunkIndex].push( idx );
		} );
		secondsSpent = ( Date.now() - startTime ) / 1000;

		// Now write chunks into the output file, one chunk at a time,
		// while surrounding each chunk with headerText/footerText.
		var fd = fs.openSync( filename, 'w' );
		var chunkLength = 0;

		var currentChunkName = '';
		var writeHeader = ( suffix ) => {
			currentChunkName = "Chunk" + suffix;
			fs.writeSync( fd, headerText.replace( /\$1/g, currentChunkName ) );

			// Each call to writeHeader() begins the new chunk.
			bytesWritten[currentChunkName] = chunkLength = 0;
		};
		var writeFooter = () => {
			fs.writeSync( fd, footerText );
			bytesWritten[currentChunkName] = chunkLength;
		};

		chunkPartitions.forEach( ( entryIds, chunkIndex ) => {
			var newChunkName = chunkIndex + 1,
				subchunk = 1;

			writeHeader( newChunkName );
			entryIds.map( ( id ) => this.entries[id].text ).forEach( ( text ) => {
				if ( chunkLength + text.length > maxChunkSizeBytes ) {
					// Adding this entry would exceed the hard limit on the size of Chunk pages.
					// To avoid this, we will split the chunk.
					writeFooter();
					writeHeader( newChunkName + '.' + subchunk );
					subchunk ++;
				}

				chunkLength += fs.writeSync( fd, text );
			} );
			writeFooter();
		} );

		fs.closeSync( fd );

		util.log( '[debug] ChunkWriter: splitting took ' + secondsSpent + ' seconds, ' +
			'number of chunks: ' + Object.keys( bytesWritten ).length + ', ' +
			'sizes of chunks (KB): ' +
			Object.values( bytesWritten ).map( ( a ) => Math.round( ( a || 0 ) / 1024 ) )
				.sort( ( a, b ) => a - b )
				.join( ', ' )
		);

		if ( cacheOutdated ) {
			// Update the cache.
			cache.NUMBER_OF_CHUNKS = chunksCount;

			fs.mkdirSync( path.dirname( cacheFilename ), { recursive: true } );
			fs.writeFileSync( cacheFilename, JSON.stringify( cache ) );

			util.log( '[notice] ChunkWriter: updated the cache (now contains partition keys for ' + Object.keys( cache ).length + ' entries).' );
		}
	}
}

module.exports = ChunkWriter;
