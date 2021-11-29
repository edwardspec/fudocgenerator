'use strict';

const { config, util } = require( '.' ),
	fs = require( 'fs' ),
	path = require( 'path' ),
	MWBot = require( 'mwbot' );

/**
 * Cache of information like "does page A exist in the wiki?".
 * This is used by ResultsWriter to create .onlynew files for Pywikibot.
 *
 * Note that this cache is only updated when updateCache() is called explicitly.
 * It's intentional that it being up-to-date is never checked and is exclusively up to the user.
 * This means that generate.js (which shouldn't call updateCache()) can work entirely offline.
 */

class WikiStatusCache {
	constructor() {
		// List of pages that exist.
		// Format: { "Article title 1": "SHA1 of contents", "File:Name of file2.png": "SHA1 of page contents", ... }
		this.existingPages = new Map();

		// List of files that exist.
		// Format: { "File:Image 1.png": "filesize in bytes", ... }
		// We are NOT using SHA1 here, because PNG files include timestamps,
		// and SHA1 may be different even if meaningful contents of two PNG files are identical.
		this.existingFiles = new Map();

		this.cacheFilename = util.tmpdir + '/pageExists.cache';
		if ( fs.existsSync( this.cacheFilename ) ) {
			var cache = JSON.parse( fs.readFileSync( this.cacheFilename ).toString() );

			this.existingPages = new Map( cache.pages );
			this.existingFiles = new Map( cache.files );
		}
	}

	/**
	 * True if page exists, false otherwise.
	 *
	 * @param {string} title
	 * @return {boolean}
	 */
	pageExists( title ) {
		title = title.replace( /_/g, ' ' );
		return this.existingPages.has( title );
	}

	/**
	 * True if page exists and has expected SHA1 checksum, false otherwise.
	 *
	 * @param {string} title
	 * @param {string} expectedChecksum
	 * @return {boolean}
	 */
	pageHasChecksum( title, expectedChecksum ) {
		title = title.replace( /_/g, ' ' );
		return this.existingPages.get( title ) === expectedChecksum;
	}

	/**
	 * True if image exists and has expected size (in bytes), false otherwise.
	 *
	 * @param {string} filename
	 * @param {string} expectedSize
	 * @return {boolean}
	 */
	fileHasChecksum( filename, expectedSize ) {
		filename = filename.replace( /_/g, ' ' );
		return this.existingFiles.get( filename ) === expectedSize;
	}

	/**
	 * Contact the MediaWiki API at config.mediawikiApiUrl and populate this cache with information
	 * that generate.js will eventually need.
	 * Note: irrelevant/unused information must not be requested.
	 */
	async updateCache() {
		if ( !config.mediawikiApiUrl ) {
			console.log( 'updateCache(): config.mediawikiApiUrl is not defined, nothing to do.' );
			return;
		}

		this.existingPages.clear();
		this.existingFiles.clear();

		var bot = new MWBot( { apiUrl: config.mediawikiApiUrl } );
		for ( var namespace of config.namespacesForPageExistsCache ) {
			// We are not doing this in parallel to reduce the load on server.
			await this.updateExistenceCache( bot, namespace );
		}

		console.log( 'updateCache(): found ' + this.existingPages.size + ' existing pages and ' +
			this.existingFiles.size + ' existing files.' );

		// Persist the cache to disk.
		fs.mkdirSync( path.dirname( this.cacheFilename ), { recursive: true } );
		fs.writeFileSync( this.cacheFilename, JSON.stringify( {
			pages: [ ...this.existingPages ],
			files: [ ...this.existingFiles ]
		} ) );
	}

	/**
	 * Update this.existingPages for all pages in one namespace.
	 *
	 * @param {MWBot} bot
	 * @param {int} namespace
	 */
	async updateExistenceCache( bot, namespace ) {
		var apcontinue, listOfPages;
		do {
			[ apcontinue, listOfPages ] = await this.loadListOfPages( bot, namespace, apcontinue );

			for ( var pageinfo of listOfPages ) {
				if ( pageinfo.revisions ) {
					this.existingPages.set( pageinfo.title, pageinfo.revisions[0].sha1 );
				}

				if ( pageinfo.imageinfo ) {
					var filename = pageinfo.title.replace( /^[^:]+:/, '' );
					this.existingFiles.set( filename, pageinfo.imageinfo[0].size );
				}
			}

			console.log( '\t... ' + listOfPages[0].title + ' ... ' + listOfPages[listOfPages.length - 1].title );
		} while ( apcontinue );
	}

	/**
	 * Query the MediaWiki API for the list of all pages in namespace, starting with "apcontinue".
	 *
	 * @param {MWBot} bot
	 * @param {int} namespace
	 * @param {string|undefined} apcontinue Value returned by the previous call of loadListOfPages().
	 * @param {int|undefined} retryNumber
	 * @return {Array} Format: { nextApcontinueToken, [ { title: "pageTitle1", ... }, { ... }, ... ] }
	 */
	async loadListOfPages( bot, namespace, apcontinue, retryNumber = 0 ) {
		var q = {
			action: 'query',
			formatversion: 2,
			generator: 'allpages',
			gaplimit: 500,
			gapfilterredir: 'nonredirects',
			gapnamespace: namespace
		};
		if ( apcontinue ) {
			q.gapcontinue = apcontinue;
		}

		if ( namespace == 6 ) { // NS_FILE
			q.prop = 'imageinfo';
			q.iiprop = 'size';
		} else {
			q.prop = 'revisions';
			q.rvprop = 'sha1';
		}

		return bot.request( q ).then( ( ret ) => {
			return [
				ret.continue ? ret.continue.gapcontinue : undefined,
				ret.query.pages
			];
		} ).catch( ( err ) => {
			if ( ++retryNumber > config.mwbotMaxRetries ) {
				return Promise.reject( err );
			}

			console.log( 'loadListOfPages(' + namespace + ', ' + ( apcontinue || '""' ) + '): HTTP request failed (' +
				err.code + '), attempting retry #' + retryNumber + ' (max: ' + config.mwbotMaxRetries + ')' );
			return this.loadListOfPages( bot, namespace, apcontinue, retryNumber );
		} ).delay( config.mwbotDelayBetweenRequests );
	}
}

module.exports = new WikiStatusCache();
