This script:
- reads the source code of Frackin' Universe mod ( https://github.com/sayterdarkwynd/FrackinUniverse ),
- generates human-readable documentation of all found materials (e.g. *Iodine* or *Gold Bar*) (in MediaWiki markup format).

Usage:
- have the sources of Frackin' Universe in some directory on the local computer.
- edit `config.json`: 1) setting `pathToMod` should be the full path to the directory with FU, 2) setting `pathToVanilla` should be the full path to unpacked Starbound assets (see https://starbounder.org/Modding:Modding_Basics for how to obtain them).
- install Node.js dependencies of this script: run `npm install`.
- run the script itself: `node generate.js`.

### Using with pywikibot to automatically create/update pages

`generate.py` creates an import file for Pywikibot (see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py for details): RESULT/pywikibot.import.txt

You can use Pywikibot in the following way to autocreate pages:
```bash
python3 pwb.py pagefromfile -log -notitle -force -file:/path/to/RESULT/pywikibot/cargoDatabase.import.txt
python3 pwb.py pagefromfile -log -notitle -file:/path/to/RESULT/pywikibot/precreateArticles.import.txt
```

The first command will overwrite "Template:Automatic item info/..." pages, which are only meant to be edited by bot.
Second command will precreate the articles for items (infobox + inclusion of above-mentioned template), but only if the article doesn't exist. **You can skip the second command if no new items were recently added into the game.**

### TODO (things to improve)

- improve handling of situations when multiple items have the same visible name (e.g. "Ancient Artifact"). They should have separate articles (how to name these pages?).
- add images (can we do it, given the way images are stored in the mod)?
- support color cores in descriptions, etc. (like "^green;Some green text^reset;")
- guess maxStack for items that don't have it listed, but which have understandable maxStack? (e.g. 1000 for all blocks and liquids)
- add item tags into the database? (can possibly be used for wiki categories)
- sort the recipes in pywikibot.import.txt alphabetically? (to more clearly see the progress when using pywikibot)
- output format of results: add XML file for Special:Import? (may be much faster than pywikibot, but can't have rules like "don't overwrite the page if it already has the words "Automatic item info")
- gather "Unlocked by" and "What it unlocks" lists for items.

- IMPORTANT: Cargo database for recipes. (not necessarily the full database structure, the recipe can be an already formatted wikitext, maybe just Station+AffectedItem+Wikitext?)
- IMPORTANT: place all Cargo databases on several pages (100-200k chunks?) to make updates very quick (there would be no need to modify thousands of templates). Note: don't place everything on 1 page, because MediaWiki doesn't handle huge pages very well.
