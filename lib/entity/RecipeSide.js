'use strict';

const { util } = require( '..' );

/**
 * Represents the list of Inputs or Outputs of the Recipe.
 */
class RecipeSide {
	/**
	 * @param {object} rawList Map of input materials,
	 * e.g. { "ironore": { count: 3 }, "copperbar": { count: 2 } }.
	 */
	constructor( rawList ) {
		// Copy all key/value pairs into this RecipeSide object.
		Object.assign( this, rawList );
	}


	/**
	* Returns true if this RecipeSide has correct format. (This is used in sanity checks)
	* Valid values are: {} (unknown/any quantity), { count: Integer }, { chance: Float }.
	*/
	isValid() {
		for ( var [ key, value ] of Object.entries( this ) ) {
			if ( typeof( key ) !== 'string' || key === 'undefined' ) {
				return false;
			}

			if ( value.count && value.count != parseInt( value.count ) ) {
				// Not a valid integer.
				return false;
			}

			if ( value.chance && value.chance != parseFloat( value.chance ) ) {
				// Not a valid number.
				return false;
			}

			// TODO: check value.rarity too (for Centrifuge recipes).
		}

		return true;
	}

	/**
	 * Get wikitext representation of this RecipeSide.
	 * @param {string} craftingStation
	 * @return {string}
	 */
	toWikitext( craftingStation ) {
		var { ItemDatabase, AssetDatabase } = require( '..' );
		var wikitext = '';

		for ( var [ itemName, amount ] of Object.entries( this ) ) {
			// Human-readable string that can be used to mention this item, e.g. "[[Carbon Dioxide]]".
			// This can be provided as wikitext (e.g. pseudo-item "Air (on Desert planets)" for the
			// outputs of Atmospheric Condenser, but in most cases it will be a normal item.
			var displayNameWikitext = amount.displayNameWikitext;
			if ( !displayNameWikitext ) {
				// Normal item.
				var data = ItemDatabase.find( itemName );
				if ( !data ) {
					util.warnAboutUnknownItem( itemName );
					return '';
				}

				// Link to the article about this item.
				displayNameWikitext = '[[';
				if ( data.displayName != data.wikiPageName ) {
					displayNameWikitext += data.wikiPageName + '|';
				}
				displayNameWikitext += data.displayName + ']]';
			}

			wikitext += '* ';
			if ( amount.count ) {
				wikitext += "'''" + amount.count + "x''' ";
			}

			wikitext += displayNameWikitext;

			if ( amount.chance ) {
				// Round to 2 digits.
				wikitext += " '''" + util.trimFloatNumber( amount.chance, 2 ) + "%'''";
			}

			if ( amount.rarity ) {
				// Note: we use MediaWiki templates (Template:CentrifugeRarity and its subtemplates
				// such as Template:CentrifugeChange/IronCentrifuge) to display actual values.
				// See "templatesAndStyles/" directory for examples.
				var [ rarity, chanceDivisor ] = amount.rarity;
				wikitext += " ''({{CentrifugeRarity|" + rarity + '|' + chanceDivisor;

				if ( craftingStation === 'Gas Centrifuge' ) {
					wikitext += '|onlyGasCentrifuge=1';
				} else if ( craftingStation === 'Sifter' ) {
					wikitext += '|sifter=1';
				} else if ( craftingStation === 'Rock Crusher' ) {
					wikitext += '|rock=1';
				}

				wikitext += "}})''";
			}

			if ( amount.subtype ) {
				// For bees, saplings, etc. (inputs that can have different outputs depending of subtype)
				wikitext += " ''(" + amount.subtype + ")''";
			}

			if ( amount.infrequency ) {
				// NOTE: this value is somewhat hard to display in understandable format.
				// Notation "1/123" is imperfect, but what else can we show?
				// Meaning of "infrequency": the larger is this number, the less frequently is the item produced.
				// But we can't display the exact chance and/or needed time, because it gets multiplied
				// by other factors (such as Bee Production stat) and is therefore not constant.
				wikitext += " ''(1/" + amount.infrequency + ")''";
			}

			if ( amount.averageCount ) {
				// Unlike "count" (which is the strict number of items of required input or guaranteed output),
				// averageCount represents an average number of items that will be obtained from 1 drop
				// (e.g. from defeating 1 monster, or from harvesting 1 plant).
				// If only 1 monster out of 5 drops 2 some item, then this value will be 2/5=0.4.
				wikitext += ' ~' + util.trimFloatNumber( amount.averageCount, 2 ) + 'x';
			}

			if ( amount.secondsToCraft ) {
				// How many seconds does it take for this output to be generated.
				// NOTE: this is exclusively for Liquid Collector and Erchius Converter.
				// Do NOT add this to crafting recipes (where it is irrelevant, as everyone who cares about it
				// is using Instant Crafting) or to recipes from Extraction Lab (it has fixed extraction time).
				wikitext += ' (' + amount.secondsToCraft + 's)';
			}

			if ( amount.planets ) {
				// For pseudo-items like "Air (Desert, Savannah planets)".
				var planetTypeNames = AssetDatabase.get( 'interface/cockpit/cockpit.config' ).data.planetTypeNames;

				var allPlanetNames = amount.planets.map( ( thisPlanetCode ) => planetTypeNames[thisPlanetCode] ),
					uniquePlanetNames = Array.from( new Set( allPlanetNames ) ),
					allPlanetLinks = uniquePlanetNames.map( ( planetName ) => {
						return ( planetName ? ( '[[' + planetName + ']]' ) : 'normal' );
					} );

				wikitext += ' (' + allPlanetLinks.join( ', ' ) + ' planets)';
			}

			wikitext += '\n';
		}

		return wikitext;
	}
}

module.exports = RecipeSide;
