'use strict';

const fs = require( 'fs' ),
	path = require( 'path' ),
	crypto = require( 'crypto' ),
	jumpConsistentHash = require( '@subspace/jump-consistent-hash' ).jumpConsistentHash,
	{ config, util } = require( '..' );

/**
 * Utility methods to split the file into delimited "chunks", each no more than N kilobytes.
 * MediaWiki can't handle large pages, especially ones with lots of {{#cargo_store}}, so we must
 * be responsible and split these pages into small "chunk" pages with reasonable parse time.
 *
 * @example
 * writer = new ChunkWriter( ... );
 * writer.write( 'something' );
 * writer.write( 'something else' );
 * writer.finalize();
 *
 * Calling finalize() is mandatory, otherwise the last footer won't be added.
 */

class ChunkWriter {
	/**
	 * @param {Object} groupsConfig
	 * @param {Object.<string,Object>} groupsConfig.groups List of supported groups,
	 * ... where keys are group names (e.g. "armorset"),
	 * ... and values are Objects with the following keys:
	 * {string} idxPattern Extra text for header, e.g. 'node/$1' ($1 gets replaced with chunk index).
	 * {int} chunksCount How many chunks to create. (resulting count will be higher due to size limit)
	 */
	constructor( groupsConfig ) {
		// Copy fields like "groups" from groupsConfig.
		Object.assign( this, groupsConfig );

		// Hard limit on the size of chunk (chunk will be split if this is exceeded).
		this.maxChunkSizeBytes = config.cargoMaxChunkSizeKBytes * 1024;
		this.maxChunkRowsCount = config.cargoMaxChunkRowsCount;

		// Every call of write() results in 1 additional element in "entries" array.
		// Format: [ { partitionKey: "partitionKey1", text: "text1" }, ... ]
		Object.values( this.groups ).forEach( ( group ) => {
			group.entries = [];
		} );
	}

	/**
	 * Add one more entry.
	 *
	 * @param {string} groupName
	 * @param {string} partitionKey Arbitrary string, affects "into which chunk will this record go".
	 * @param {string} text
	 */
	write( groupName, partitionKey, text ) {
		this.groups[groupName].entries.push( { partitionKey: partitionKey, text: text } );
	}

	/**
	 * Group all entries (from previous calls to write()) into chunks and write them to the output.
	 *
	 * @param {Function} outputCallback Function that is called when each chunk is ready.
	 * It receives the following parameters: 1) chunk name (string), 2) contents of chunk (string).
	 */
	finalize( outputCallback ) {
		Object.keys( this.groups ).forEach( ( groupName ) =>
			this.finalizeGroup( groupName, outputCallback ) );
	}

	/**
	 * Write all chunks of one of the groups.
	 *
	 * @param {string} groupName
	 * @param {Function} outputCallback
	 */
	finalizeGroup( groupName, outputCallback ) {
		var group = this.groups[groupName],
			chunksCount = group.chunksCount,
			logContext = 'ChunkWriter[' + groupName + ']: ';

		// For statistics only: { "Chunk1": "bytesWrittenIntoChunk1", ... }
		var bytesWritten = {};

		// For statistics only:  { "Chunk1": "rowsWritteIntoChunk1", ... }
		var rowsWritten = {};

		// First, let's determine how many chunks will we need,
		// based on 1) total length of all entries and 2) desired average size of chunk.
		var totalSize = 0;
		group.entries.forEach( ( entry ) => {
			totalSize += entry.text.length;
		} );

		util.log( '[notice] ' + logContext + 'going to write ' + chunksCount + ' chunks (totalSize = ' +
			totalSize + ' bytes, totalRows = ' + group.entries.length +
			', estimated average size = ' + Math.floor( totalSize / chunksCount ) + ' bytes' +
			', estimated average entries = ' + Math.floor( group.entries.length / chunksCount ) + ').' );

		// Array of partitions, where each partition is an array of indices from group.entries array.
		var chunkPartitions = [];
		for ( var i = 0; i < chunksCount; i++ ) {
			chunkPartitions[i] = [];
		}

		// Load the cache with the results of jumpConsistentHash().
		// It returns the same value for the same partitionKey (if the number of chunks hasn't changed),
		// so the cache can save some time.
		// Format: { partitionKey: chunkIndex, ... }.
		var cache = new Map(),
			cacheFilename = util.tmpdir + '/partitionKeyToChunk.' + groupName + '.cache',
			cacheOutdated = true;

		if ( fs.existsSync( cacheFilename ) ) {
			cache = new Map( JSON.parse( fs.readFileSync( cacheFilename ).toString() ) );

			var cachedChunksCount = cache.get( 'NUMBER_OF_CHUNKS' );
			if ( chunksCount !== cachedChunksCount ) {
				console.log( logContext + 'ignoring the cache as non-actual: it was calculated for ' +
					cachedChunksCount + ' chunks, and we plan to write ' + chunksCount + ' chunks.' );

				// If the number of chunks has changed, then some of the results are no longer valid.
				// We don't know "which ones", so discard the cache completely.
				cache.clear();
			} else {
				cacheOutdated = false;
			}
		}

		// Statistics: measure how much time it takes to run Consistent Hashing algorithm.
		var secondsSpent,
			startTime = Date.now();

		group.entries.forEach( ( entry, idx ) => {
			var partitionKey = entry.partitionKey;

			// Check the cache first.
			var chunkIndex = cache.get( partitionKey );
			if ( chunkIndex === undefined ) {
				var hash = new Uint8Array( crypto.createHash( 'md5' ).update( partitionKey ).digest() );
				chunkIndex = jumpConsistentHash( hash, chunksCount );

				cache.set( partitionKey, chunkIndex );

				// Some new item, etc. was added. Let's remember that we need to update the cache.
				cacheOutdated = true;
			}

			chunkPartitions[chunkIndex].push( idx );
		} );
		secondsSpent = ( Date.now() - startTime ) / 1000;

		// Now write chunks into the output file, one chunk at a time,
		// while surrounding each chunk with headerText/footerText.
		var chunkLength = 0,
			chunkRowsCount = 0;

		var currentChunkName = '';
		var currentChunkContents = '';

		var writeHeader = ( suffix ) => {
			currentChunkName = group.idxPattern.replace( /\$1/g, 'Chunk' + suffix );

			// Each call to writeHeader() begins the new chunk.
			bytesWritten[currentChunkName] = chunkLength = 0;
			rowsWritten[currentChunkName] = chunkRowsCount = 0;
		};
		var writeFooter = () => {
			outputCallback( currentChunkName, currentChunkContents );
			currentChunkContents = '';

			bytesWritten[currentChunkName] = chunkLength;
			rowsWritten[currentChunkName] = chunkRowsCount;
		};

		chunkPartitions.forEach( ( entryIds, chunkIndex ) => {
			var newChunkName = chunkIndex + 1,
				subchunk = 1;

			writeHeader( newChunkName );
			entryIds.map( ( id ) => group.entries[id].text ).forEach( ( text ) => {
				if (
					( chunkLength + text.length > this.maxChunkSizeBytes ) ||
					( chunkRowsCount + 1 > this.maxChunkRowsCount )
				) {
					// Adding this entry would exceed the hard limit on the size of Chunk pages.
					// To avoid this, we will split the chunk.
					writeFooter();
					writeHeader( newChunkName + '.' + subchunk );
					subchunk++;
				}

				currentChunkContents += text;
				chunkLength = currentChunkContents.length;
				chunkRowsCount++;
			} );
			writeFooter();
		} );

		var loggedSizes = Object.values( bytesWritten ).map( ( a ) => Math.round( ( a || 0 ) / 1024 ) )
			.sort( ( a, b ) => a - b )
			.join( ', ' );
		var loggedRowCounts = Object.values( rowsWritten ).sort( ( a, b ) => a - b ).join( ', ' );

		util.log( '[debug] ' + logContext + 'splitting took ' + secondsSpent + ' seconds; ' +
			'number of chunks: ' + Object.keys( bytesWritten ).length + ', ' +
			'sizes of chunks (KB): ' + loggedSizes + '; ' +
			'rows in chunks: ' + loggedRowCounts );

		if ( cacheOutdated ) {
			// Update the cache.
			cache.set( 'NUMBER_OF_CHUNKS', chunksCount );

			fs.mkdirSync( path.dirname( cacheFilename ), { recursive: true } );
			fs.writeFileSync( cacheFilename, JSON.stringify( [...cache] ) );

			util.log( '[notice] ' + logContext + 'updated the cache (now contains partition keys for ' + cache.size + ' entries).' );
		}
	}
}

module.exports = ChunkWriter;
