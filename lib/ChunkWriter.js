'use strict';

var fs = require( 'fs' );

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
	/**
	 * @param int filename Name of output file. This file will be overwritten.
	 * @param string headerText Can contain "$1" (will be replaced with the number of chunk).
	 * @param string footerText
	 * @param int maxChunkSizeBytes
	 */
	constructor( filename, headerText, footerText, maxChunkSizeBytes ) {
		this.fd = fs.openSync( filename, 'w' );
		this.header = headerText;
		this.footer = footerText;
		this.maxSize = maxChunkSizeBytes;

		// Prepare to write.
		this.currentChunkNumber = 1;
		this.currentChunkSize = 0;

		this.addHeader();
	}


	write( newText ) {
		if ( this.currentChunkSize + newText.length > this.maxSize && this.currentChunkSize !== 0 ) {
			// Must start a new chunk to not exceed "maxSize".
			this.addFooter();
			this.addHeader( ++ this.currentChunkNumber );

			this.currentChunkSize = 0;
		}

		fs.writeSync( this.fd, newText );
		this.currentChunkSize += newText.length;
	}

	finalize() {
		this.addFooter();
		fs.closeSync( this.fd );
	}

	addHeader() {
		fs.writeSync( this.fd, this.header.replace( /\$1/g, this.currentChunkNumber ) );
	}

	addFooter() {
		fs.writeSync( this.fd, this.footer );
	}
}

module.exports = ChunkWriter;
