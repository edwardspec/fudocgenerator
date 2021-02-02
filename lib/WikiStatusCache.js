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
		// List of pages that exist, e.g. [ "Article title 1", "File:Name of file2.png", ... ]
		this.existingPages = new Set();

		this.cacheFilename = util.tmpdir + '/pageExists.cache';
		if ( fs.existsSync( this.cacheFilename ) ) {
			this.existingPages = new Set( JSON.parse( fs.readFileSync( this.cacheFilename ).toString() ) );
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

		var bot = new MWBot( { apiUrl: config.mediawikiApiUrl } );
		for ( var namespace of config.namespacesForPageExistsCache ) {
			// We are not doing this in parallel to reduce the load on server.
			await this.updateExistenceCache( bot, namespace );
		}

		console.log( 'updateCache(): found ' + this.existingPages.size + ' existing pages.' );

		// Persist the cache to disk.
		fs.mkdirSync( path.dirname( this.cacheFilename ), { recursive: true } );
		fs.writeFileSync( this.cacheFilename, JSON.stringify( [...this.existingPages] ) );
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

			for ( var title of listOfPages ) {
				this.existingPages.add( title );
			}

			console.log( '\t... ' + listOfPages[0] + ' ... ' + listOfPages[listOfPages.length - 1] );
		} while ( apcontinue );
	}

	/**
	 * Query the MediaWiki API for the list of all pages in namespace, starting with "apcontinue".
	 *
	 * @param {MWBot} bot
	 * @param {int} namespace
	 * @param {string|undefined} apcontinue Value returned by the previous call of loadListOfPages().
	 * @return {Array} Format: { nextApcontinueToken, [ "pageTitle1", "pageTitle2", ... ] }
	 */
	async loadListOfPages( bot, namespace, apcontinue ) {
		var q = {
			action: 'query',
			formatversion: 2,
			generator: 'allpages',
			gaplimit: 500,
			gapfilterredir: 'nonredirects',
			gapnamespace: namespace,
			prop: 'revisions',
			rvprop: 'sha1'
		};
		if ( apcontinue ) {
			q.gapcontinue = apcontinue;
		}

		return bot.request( q ).then( ( ret ) => {
			return [
				ret.continue ? ret.continue.gapcontinue : undefined,
				ret.query.pages.map( ( pageinfo ) => pageinfo.title )
			];
		} );
	}
}

module.exports = new WikiStatusCache();
