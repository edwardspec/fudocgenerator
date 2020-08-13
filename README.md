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
python3 pwb.py pagefromfile -log -file:/home/edward/TEST/fudocgenerator/RESULT/pywikibot.import.txt -force -notitle -nocontent:'Automatic item info'
```

Note that `-force` means that this will overwrite the pages about items if they don't have "Automatic item info" included (normally 99,9% of item pages should have it, and the rest can just add `<!-- Automatic item info -->` into their wikitext to become excluded from being overwritten).

### TODO (things to improve)

- support situation when multiple items have the same visible name (e.g. "Ancient Artifact"). They should have separate articles (how to name these pages?).
- support Erchius Converter recipes
- support items that have "[" or "]" in their name (e.g. "Kiri Fruit [FU]") - these are invalid characters for MediaWiki titles.
- add images (can we do it, given the way images are stored in the mod)?
- support color cores in descriptions, etc. (like "^green;Some green text^reset;")
- guess maxStack for items that don't have it listed, but which have understandable maxStack? (e.g. 1000 for all blocks and liquids)
- add item tags into the database? (can possibly be used for wiki categories)
- sort the recipes in pywikibot.import.txt alphabetically? (to more clearly see the progress when using pywikibot)
- output format of results: add XML file for Special:Import? (may be much faster than pywikibot, but can't have rules like "don't overwrite the page if it already has the words "Automatic item info")
- fix stations like Rustic Skath Workbench (not available to many players) taking precedence over generalized crafting stations (such as Foraging Table).
