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
python3 pwb.py pagefromfile -log -notitle -force -pt:20 -file:/path/to/RESULT/pywikibot/cargoDatabase.import.txt
python3 pwb.py pagefromfile -log -notitle -file:/path/to/RESULT/pywikibot/precreateArticles.import.txt
```

The first command will overwrite the Cargo database pages ("Template:Cargo/..."), which are only meant to be edited by bot. Note that this requires a lot of processing on the server side, so we absolutely must instruct the bot to wait at least 20 seconds (`-pt:20`) between writes.

Second command will precreate the articles for items (infobox + inclusion of {{All recipes for item}}), but only if the article doesn't exist. **You can skip the second command if no new items were recently added into the game.**

### TODO (things to improve)

- gather food values, food effects, etc. for consumables.
- gather damage, elemental type and attack rate of swords, etc.
- gather Tech recipes (for things like Micro Sphere).
- gather harvests from farm beasts.
- automatically gather information of which biomes have which plants, seeds, ores, etc.
- improve handling of situations when multiple items have the same visible name (e.g. "Ancient Artifact"). They should have separate articles, but the challenge is that auto-detecting "how to name these pages?" heavily depends on type of item. Such logic already exists for certain types of items (like decorative foods).
- support color cores in descriptions, etc. (like "^green;Some green text^reset;")
- guess maxStack for items that don't have it listed, but which have understandable maxStack? (e.g. 1000 for all blocks and liquids)
- add item tags into the database? (can possibly be used for wiki categories)
- sort the recipes in pywikibot import files alphabetically? (to more clearly see the progress when using pywikibot)
- Cargo chunks: split them alphabetically or something like that (e.g. 1 chunk for items that start with "A", with "B", etc. - splitting by the second letter if necessary to not exceed the maximum chunk size), because currently a change in 1 item can cause 60 chunk pages to be unnecessarily overwritten. Also don't mix chunks with items, chunks with recipes and chunks with research nodes on the same pages.
