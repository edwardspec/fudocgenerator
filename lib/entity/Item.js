'use strict';

const util = require( '../util' );

/**
 * Represents one item from the ItemDatabase.
 */
class Item {
	/**
	 * @param {object} loadedData Results of parsing the JSON file that describes this item.
	 */
	constructor( loadedData ) {
		Object.assign( this, loadedData );
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Item into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var wikitext = '{{#cargo_store:_table = item\n';
		wikitext += '|id=' + this.itemCode + '\n';
		wikitext += '|name=' + this.displayName + '\n';
		wikitext += '|wikiPage=' + this.wikiPageName + '\n';

		// Most of these fields are optional, because we must be tolerant to bad input.
		if ( this.category ) {
			wikitext += '|category=' + util.cleanDescription( this.category ) + '\n';
		}

		if ( this.itemTags ) {
			wikitext += '|tags=' + this.itemTags.join( ',' ) + '\n';
		}

		if ( this.colonyTags ) {
			wikitext += '|colonyTags=' + this.colonyTags.join( ',' ) + '\n';
		}

		if ( this.description ) {
			wikitext += '|description=' + util.cleanDescription( this.description ) + '\n';
		}

		if ( this.rarity ) {
			wikitext += '|rarity=' + this.rarity + '\n';
		}

		wikitext += '|price=' + ( this.price || 0 ) + '\n';

		if ( this.maxStack ) {
			wikitext += '|stackSize=' + this.maxStack + '\n';
		}

		if ( this.level ) {
			wikitext += '|tier=' + this.level + '\n';
		}

		// TODO: what is the default if this parameter is not specified? Two-handed or one-handed?
		if ( this.twoHanded !== undefined ) {
			wikitext += '|twoHanded=' + ( this.twoHanded ? 1 : 0 ) + '\n';
		}

		var isUpgradeable = false;
		if ( Array.isArray( this.itemTags ) ) {
			if ( this.itemTags.indexOf( 'upgradeableWeapon' ) !== -1 ) {
				isUpgradeable = true;
			} else if ( this.itemTags.indexOf( 'upgradeableTool' ) !== -1 ) {
				isUpgradeable = true;
			}
		}

		wikitext += '|upgradeable=' + ( isUpgradeable ? 1 : 0 ) + '\n';
		wikitext += '}} ';

		return wikitext;
	}
}

module.exports = Item;
