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
		// Format: { "Article title 1": true, "File:Name of file2.png": true }
		this._pageExists = {};

		// Pages in the following namespaces will be checked:
		// articles (NS_MAIN=0), files (NS_FILE=6), categories (NS_CATEGORY=14).
		this.namespaces = [ 0, 6, 14 ];

		this.cacheFilename = util.tmpdir + '/pageExists.cache';
		if ( fs.existsSync( this.cacheFilename ) ) {
			this._pageExists = JSON.parse( fs.readFileSync( this.cacheFilename ).toString() );
		}
	}

	/**
	 * True if page exists, false otherwise.
	 * @param {string} title
	 * @return bool
	 */
	pageExists( title ) {
		title = title.replace( /_/g, ' ' );
		return !!this._pageExists[title];
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

		this._pageExists = {};

		var bot = new MWBot( { apiUrl: config.mediawikiApiUrl } );
		for ( var namespace of this.namespaces ) {
			// We are not doing this in parallel to reduce the load on server.
			await this.updateExistenceCache( bot, namespace );
		}

		console.log( 'updateCache(): found ' + Object.keys( this._pageExists ).length + ' existing pages.' );

		// Persist the cache to disk.
		fs.mkdirSync( path.dirname( this.cacheFilename ), { recursive: true } );
		fs.writeFileSync( this.cacheFilename, JSON.stringify( this._pageExists ) );
	}

	/**
	 * Update this._pageExists for all pages in one namespace.
	 * @param {MWBot} bot
	 * @param {int} namespace
	 */
	async updateExistenceCache( bot, namespace ) {
		var apcontinue, listOfPages;
		do {
			[ apcontinue, listOfPages ] = await this.loadListOfPages( bot, namespace, apcontinue );

			for ( var title of listOfPages ) {
				this._pageExists[title] = true;
			}
		} while( apcontinue );
	}

	/**
	 * Query the MediaWiki API for the list of all pages in namespace, starting with "apcontinue".
	 * @param {MWBot} bot
	 * @param {int} namespace
	 * @param {string|undefined} apcontinue Value returned by the previous call of loadListOfPages().
	 * @return array Format: { nextApcontinueToken, [ "pageTitle1", "pageTitle2", ... ] }
	 */
	async loadListOfPages( bot, namespace, apcontinue ) {
		var q = {
			action: 'query',
			formatversion: 2,
			list: 'allpages',
			aplimit: 500,
			apfilterredir: 'nonredirects',
			apnamespace: namespace
		};
		if ( apcontinue ) {
			q.apcontinue = apcontinue;
		}

		return bot.request( q ).then( ( ret ) => {
			return [
				ret.continue ? ret.continue.apcontinue : undefined,
				ret.query.allpages.map( ( pageinfo ) => pageinfo.title )
			];
		} );
	}
}

module.exports = new WikiStatusCache();
