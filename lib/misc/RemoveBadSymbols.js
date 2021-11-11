/**
 * Functions to sanitize wikipage names, item names, monster names, item descriptions, etc.
 */

'use strict';

const { util } = require( '..' );

class RemoveBadSymbols {
	/**
	 * Remove color codes (such as ^yellow; or ^reset;).
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	removeColors( origString ) {
		return origString.replace( /\^[^;^]+;/g, '' );
	}

	/**
	 * Replace color codes (such as ^yellow; or ^reset;) with HTML that applies these colors.
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	replaceColorsWithHtml( origString ) {
		return origString.replace( /\^([^;^]+);/g, function ( fullMatch, color ) {
			if ( color === 'reset' ) {
				return '</span>';
			}

			var sanitizedColor = color.replace( /[^a-z0-9#]/ig, '' );
			return '<span style="color:' + sanitizedColor + '">';
		} );
	}

	/**
	 * Replace "unordered list" markup with UTF8 symbols.
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	replaceBullets( origString ) {
		return origString.replace( /\s*/g, '\n• ' ).trim();
	}

	/**
	 * Clean the multiline description (such as scan text of placeable object).
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	fromDescription( origString ) {
		return this.replaceColorsWithHtml( this.replaceBullets( origString ) );
	}

	/**
	 * Clean the single-line name (e.g. item name or monster name).
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	fromName( origString ) {
		var withoutNewLinesOrLists = origString.replace( //g, '' )
			.replace( /[\r\n]+/g, ' ' )
			.replace( /\s+/g, ' ' );
		return this.removeColors( this.replaceBullets( withoutNewLinesOrLists ) );
	}

	/**
	 * Normalize the title of MediaWiki page, e.g. "cat Ship  Door" -> "Cat Ship Door",
	 * removing any symbols that are not allowed in MediaWiki titles.
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	fromPageName( origString ) {
		var cleanPageName = this.fromName( origString ).replace( /#/g, 'N' )
			.replace( /\[/g, '(' )
			.replace( /\]/g, ')' );

		return util.ucfirst( cleanPageName );
	}
}

module.exports = new RemoveBadSymbols();
