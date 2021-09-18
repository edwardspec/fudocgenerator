'use strict';

const { BiomeDatabase, RecipeSide, util } = require( '..' );

/**
 * Generator for a bot-updated human-readable list of all music tracks (for every biome).
 */
class BiomeMusicPage {
	getTitle() {
		return 'Template:List of biome music';
	}

	getText() {
		var wikitext = '<noinclude><span style="font-size: 150%; font-weight: bold;">' +
			'This page is bot-updated. Don\'t edit it manually (any edits will be overwritten by the bot).</span>' +
			'\n</noinclude><includeonly>' +
			'{| class="wikitable sortable"\n! Biome !! Time !! Music tracks\n';

		BiomeDatabase.forEach( ( biome ) => {
			var biomeCode = biome.biomeCode,
				biomeLink = biome.getWikiPageLink();

			if ( !biome.musicTrack ) {
				util.log( '[info] Biome ' + biomeCode + " doesn't have any music." );
			}

			for ( var [ daytime, musicConf ] of Object.entries( biome.musicTrack || {} ) ) {
				var outputs = new RecipeSide();
				for ( var track of musicConf.tracks.sort() ) {
					outputs.addMusicTrack( track );
				}

				if ( outputs.isEmpty() ) {
					util.log( '[info] Biome ' + biomeCode + " doesn't have music for time=" + daytime + '.' );
					return;
				}

				wikitext += ' |- style="vertical-align:top;"\n | ' + biomeLink + '\n | ' + daytime + '\n |\n' + outputs.toWikitext() + '\n';
			}
		} );

		wikitext += '|}\n</includeonly>';
		return wikitext;
	}
}

module.exports = new BiomeMusicPage();
