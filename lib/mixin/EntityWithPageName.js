'use strict';

const { PageNameRegistry } = require( '..' );

/**
 * Mixin for objects that have (or might have) their own wikipage.
 * Conventions:
 * 1) any object that uses this mixin must have "displayName" property (string),
 * 2) for any object that needs these methods, PageNameRegistry.add( this ) must be called early.
 * 3) calls to .wikiPageName, getWikiPageLink(), etc. can only be made after ALL objects did (2).
 */
const EntityWithPageName = {
	/**
	 * Get PageName assigned to this entity by PageNameRegistry, or empty string if none was assigned.
	 * Warning: this method can't be used until all needed PageNameRegistry.add() calls are completed.
	 *
	 * @return {string}
	 */
	get wikiPageName() {
		return PageNameRegistry.getTitleFor( this );
	},

	/**
	 * Make MediaWiki link: either [[NameOfObject]] or [[NameOfPage|NameOfObject]] (if they are named differently).
	 *
	 * @param {string} optionalPrefix If specified, this string is prepended to the text of the link.
	 * @param {string} optionalSuffix If specified, this string is appended to the text of the link.
	 * @return {string}
	 */
	getWikiPageLink( optionalPrefix = '', optionalSuffix = '' ) {
		let displayName = this.displayName + optionalSuffix;
		if ( optionalPrefix ) {
			displayName = optionalPrefix + displayName;
		}

		if ( this.isNameless ) {
			// For nameless monsters. They are still shown in recipes, but don't have an article.
			return displayName;
		}

		let wikitext = '[[';
		if ( displayName !== this.wikiPageName ) {
			wikitext += this.wikiPageName + '|';
		}
		wikitext += displayName + ']]';

		return wikitext;
	}
};

module.exports = EntityWithPageName;
