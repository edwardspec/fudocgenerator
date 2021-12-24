'use strict';

const { CargoRow } = require( '..' );

/**
 * Extra options that are passed to RecipeSide.toWikitext() for some crafting stations.
 */
const stationRenderParameters = {
	'Gas Centrifuge': { rarityFlag: 'onlyGasCentrifuge=1' },
	Sifter: { rarityFlag: 'sifter=1' },
	'Rock Crusher': { rarityFlag: 'rock=1' }
};

/**
 * Represents one Recipe: rule like "A and B are converted into C and D at crafting Station E".
 * This can be used for anything: crafting, mixing, extraction, smelting, cooking, etc.
 */
class Recipe {
	static Type = Object.freeze( {
		Unknown: -1,
		AnimalWaste: Symbol( 'AnimalWaste' ),
		Apiary: Symbol( 'Apiary' ),
		BiomeContents: Symbol( 'BiomeContents' ),
		Centrifuge: Symbol( 'Centrifuge' ),
		Crafting: Symbol( 'Crafting' ),
		Evolution: Symbol( 'Evolution' ),
		Extraction: Symbol( 'Extraction' ),
		Fuel: Symbol( 'Fuel' ),
		Harvest: Symbol( 'Harvest' ),
		Incubator: Symbol( 'Incubator' ),
		LiquidCollector: Symbol( 'LiquidCollector' ),
		Lootbox: Symbol( 'Lootbox' ),
		Mixing: Symbol( 'Mixing' ),
		MonsterDrops: Symbol( 'MonsterDrops' ),
		MonsterSpawner: Symbol( 'MonsterSpawner' ),
		ResourceGenerator: Symbol( 'ResourceGenerator' ),
		Shop: Symbol( 'Shop' ),
		Smelter: Symbol( 'Smelter' ),
		Tech: Symbol( 'Tech' ),
		TenantRent: Symbol( 'TenantRent' ),
		Terraformer: Symbol( 'Terraformer' ),
		TreasurePool: Symbol( 'TreasurePool' ),
		TreeDrops: Symbol( 'TreeDrops' ),
		UpgradeItem: Symbol( 'UpgradeItem' ),
		UpgradeStation: Symbol( 'UpgradeStation' ),
		Well: Symbol( 'Well' )
	} );

	/**
	 * @param {string} station Name of crafting Station (e.g. "Powder Sifter").
	 * @param {RecipeSide} inputs Input materials.
	 * @param {RecipeSide} outputs output materials.
	 * @param {Object} context Arbitrary information like filename, type, etc.
	 */
	constructor( station, inputs, outputs, context = {} ) {
		// Mandatory fields.
		this.station = station;
		this.inputs = inputs;
		this.outputs = outputs;

		// Optional fields: for logging, sorting, etc.
		this.filename = context.filename;
		this.type = context.type;

		if ( !this.type ) {
			throw new Error( 'Recipe object without a type: ' + JSON.stringify( this ) );
		}
	}

	/**
	 * Return true if this recipe is correct, false otherwise.
	 * Used in sanity checks to prevent incorrect Recipe objects from being in the database.
	 *
	 * @return {boolean}
	 */
	isValid() {
		if ( typeof ( this.station ) !== 'string' ) {
			return false;
		}

		if ( !this.inputs.isValid() || !this.outputs.isValid() ) {
			return false;
		}

		// Seems valid.
		return true;
	}

	/**
	 * Get wikitext representation of this recipe.
	 *
	 * @return {string}
	 */
	toWikitext() {
		var renderParameters = stationRenderParameters[this.station] || {},
			inputsWikitext = this.inputs.toWikitext( renderParameters ),
			outputsWikitext = this.outputs.toWikitext( renderParameters );

		if ( !inputsWikitext || !outputsWikitext ) {
			// Recipe refers to unknown item, etc.
			return '';
		}

		return '{{Recipe|inputs=\n' + inputsWikitext + '|outputs=\n' + outputsWikitext + '}}\n';
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		// We split the recipes into chunks by the ID of the first item in "outputs",
		// because "inputs" has a higher chance to have only pseudo-items, such as "Air (on Desert planets)".
		// The only situation when "outputs" has them are "reactor fuel -> power output" recipes.
		return 'recipe-' + this.outputs.getAllCodes()[0];
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Recipe into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		var wikitext = this.toWikitext().trim();
		if ( !wikitext ) {
			// Recipe is invalid (refers to unknown item), not recording into the Cargo database.
			return [];
		}

		return new CargoRow( 'recipe', {
			station: this.station,
			inputs: this.inputs.getAllCodes(),
			outputs: this.outputs.getAllCodes(),
			wikitext: wikitext
		} );
	}
}

module.exports = Recipe;
