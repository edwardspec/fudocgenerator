'use strict';

const { util } = require( '..' );

/**
 * Represents colored light with the light level that is directly dependent on the color.
 */
class LightColor {
	/**
	 * @param {int} red Number between 0 and 255.
	 * @param {int} green Number between 0 and 255.
	 * @param {int} blue Number between 0 and 255.
	 */
	constructor( red, green, blue ) {
		this.red = red;
		this.green = green;
		this.blue = blue;
	}

	/**
	 * Get light level: number between 0 (complete darkness) and 1 (maximum light).
	 *
	 * @return {number}
	 */
	getLevel() {
		if ( !this.level ) {
			const averageColor = ( this.red + this.green + this.blue ) / 3;
			this.level = util.trimFloatNumber( averageColor / 256, 2 );
		}

		return this.level;
	}

	/**
	 * Get valid CSS color of this light, e.g. rgb(100,0,200) or #aa11bb.
	 *
	 * @return {string}
	 */
	getCssColor() {
		return 'rgb(' + this.red + ',' + this.green + ',' + this.blue + ')';
	}
}

module.exports = LightColor;
