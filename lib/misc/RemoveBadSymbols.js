/**
 * Functions to sanitize wikipage names, item names, monster names, item descriptions, etc.
 */

'use strict';

const { config, util } = require( '..' );

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
		var previousColor = null;
		var result = origString.replace( /\^([^;^]+);/g, function ( fullMatch, color ) {
			color = color.toLowerCase().replace( /[^a-z0-9#]/g, '' );
			if ( color === 'truncate' ) {
				// Not a color: markup used in description of batteries.
				return '';
			}

			if ( color === 'reset' || color === 'white' || color === '#ffffff' ) {
				// ^reset; is an explicit command "stop applying color to text".
				// Default font color is white, so we treat ^white; as ^reset;
				if ( !previousColor ) {
					// If ^white; is the first color in the string, we just ignore it.
					return '';
				}

				previousColor = null;
				return '</span>';
			}

			var spanHtml = '';
			if ( previousColor ) {
				spanHtml += '</span>';
			}

			spanHtml += '<span style="color:' + ( config.replacedFontColors[color] || color ) + '">';
			previousColor = color;

			return spanHtml;
		} );

		if ( previousColor ) {
			// We have non-closed <span>, because last color code hasn't been followed by ^reset;
			result += '</span>';
		}

		return result;
	}

	/**
	 * Replace "unordered list" markup with UTF8 symbols.
	 *
	 * @param {string} origString
	 * @return {string}
	 */
	replaceBullets( origString ) {
		return origString.replace( /(\^yellow;\s*|)\s*(\^reset;\s*|)/g, '\n• ' ).trim();
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
		return this.replaceBullets( this.removeColors( withoutNewLinesOrLists ) );
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
