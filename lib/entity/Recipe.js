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
		return 'recipe-' + this.getSomewhatUniqueId();
	}

	/**
	 * Attempt to generate an ID (string) that is unique to this Recipe.
	 * This is not always successful (returned ID can be shared by several Recipe objects).
	 *
	 * @return {string}
	 */
	getSomewhatUniqueId() {
		switch ( this.type ) {
			case Recipe.Type.Crafting:
				// All native crafting recipes have different filenames.
				return this.filename;

			// Extractions are uniquely identified by "station + input IDs".
			// Some other recipes (such as Fuel or TreeDrops) can get their unique ID the same way.
			case Recipe.Type.Centrifuge:
			case Recipe.Type.Extraction:
			case Recipe.Type.Mixing:
			case Recipe.Type.Smelter:
			case Recipe.Type.Evolution:
			case Recipe.Type.Fuel:
			case Recipe.Type.Harvest:
			case Recipe.Type.Incubator:
			case Recipe.Type.Lootbox:
			case Recipe.Type.MonsterDrops:
			case Recipe.Type.MonsterSpawner:
			case Recipe.Type.ResourceGenerator:
			case Recipe.Type.TenantRent:
			case Recipe.Type.Terraformer:
			case Recipe.Type.TreeDrops:
			case Recipe.Type.UpgradeItem:
				return this.station + '-' + this.inputs.getAllCodes().sort().join( ',' );

			case Recipe.Type.TreasurePool:
				// RecipeComponent of treasure pools can have non-unique id (shared by several tiered pools),
				// but its "code" is unique (e.g. "money:2" and "money:5" for tier 2+ and tier 5+ pool "money").
				return this.station + '-' + this.inputs.getAllComponents()[0].code;

			case Recipe.Type.LiquidCollector:
				return this.station + '-' + this.inputs.getAllComponents()[0].quantity.planets.join( ',' );

			case Recipe.Type.Well:
				// Wells don't have inputs.
				return this.station;

			case Recipe.Type.UpgradeStation:
				// First input code is the station to upgrade, which is unique.
				return this.inputs.getAllCodes()[0];

			case Recipe.Type.Apiary:
			case Recipe.Type.BiomeContents:
				// These recipes have only 1 input (either biomeCode or itemCode of the queen),
				// but they often use "subtype" quantity to make this RecipeComponent more unique.
				var biomeComponent = this.inputs.getAllComponents()[0];
				return this.station + '-' + biomeComponent.id + '-' + biomeComponent.quantity.subtype;

			case Recipe.Type.Shop:
			case Recipe.Type.Tech:
				// Shop recipes are identified by their output (item that is bought).
				return this.station + '-' + this.outputs.getAllCodes()[0];

			case Recipe.Type.AnimalWaste:
				// Animal waste recipes have constant outputs.
				return this.outputs.getAllCodes();
		}

		throw new Error( 'getSomewhatUniqueId(): not yet implemented for recipe type: ', this.type );
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
