'use strict';

const { CargoRow, Query, util } = require( '..' );

/**
 * Represents one weather pool (list of possible weathers + chances) in the WeatherPoolDatabase.
 */
class WeatherPool {
	/**
	 * @param {string} poolName Unique identifier of this pool, e.g. "fugentlerainy".
	 * @param {Object} possibleWeathers Structure from weather.config that describes this weather pool.
	 */
	constructor( poolName, possibleWeathers ) {
		this.poolName = poolName;
		this.possibleWeathers = possibleWeathers;

		// Determine average production of Wind Turbine (equal to wind power, but capped at 12W)
		// for the entire weather pool.
		var sumOfDurations = 0,
			sumOfPowerMultipliedByDuration = 0;

		for ( var [ weatherWeight, weatherCode ] of this.possibleWeathers ) {
			var weather = Query.findWeather( weatherCode );
			if ( !weather ) {
				util.log( '[warning] unknown weather "' + weatherCode + '" in weather pool "' + poolName + '".' );
				continue;
			}

			var averageDuration = weatherWeight * 0.5 * ( weather.duration[0] + weather.duration[1] );

			sumOfPowerMultipliedByDuration += averageDuration * Math.min( 12, weather.maximumWind || 0 );
			sumOfDurations += averageDuration;
		}

		this.averageWindPower = sumOfDurations ? Math.round( sumOfPowerMultipliedByDuration / sumOfDurations ) : 0;
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'weather-' + this.poolName;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this WeatherPool into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		return new CargoRow( 'weatherpool', {
			id: this.poolName,
			wikitext: this.toWikitext(),
			averageWindPower: this.averageWindPower
		} );
	}

	/**
	 * Format this WeatherPool as a human-readable wikitext.
	 *
	 * @return {string}
	 */
	toWikitext() {
		// Convert weights to normalized chances (e.g. 0.2 and 0.8), sort from highest chance to lowest.
		var normalizedWeatherChances = util.normalizeWeights( this.possibleWeathers )
			.sort( ( a, b ) => b[0] - a[0] );

		var wikitext = '';
		for ( var [ chance, weatherCode ] of normalizedWeatherChances ) {
			wikitext += '\n* ';

			var weatherInfo = Query.getWeatherNameAndIcon( weatherCode );
			if ( weatherInfo && weatherInfo.icon ) {
				// The icon is uploaded by [prepare_uploads.js], not here, but we already know its name.
				wikitext += '[[File:Weather icon ' + weatherCode + '.png|32px]] ';
			}
			wikitext += weatherInfo ? weatherInfo.displayName : "''(" + weatherCode + ")''";
			wikitext += ' ' + util.trimFloatNumber( chance * 100, 2 ) + '%';
		}
		return wikitext;
	}
}

module.exports = WeatherPool;
