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
- automatically gather information of which biomes have which plants, seeds, ores, etc.
- improve handling of situations when multiple items have the same visible name (e.g. "Ancient Artifact"). They should have separate articles, but the challenge is that auto-detecting "how to name these pages?" heavily depends on type of item. Such logic already exists for certain types of items (like decorative foods).
- support color cores in descriptions, etc. (like "^green;Some green text^reset;")
- guess maxStack for items that don't have it listed, but which have understandable maxStack? (e.g. 1000 for all blocks and liquids)
- all templates/styles in "templatesAndStyles" category should be a Pywikibot import file. Reasons: 1) it's becoming increasingly inconvenient to keep them in sync in-wiki and in the Git repository, 2) some templates have "/" in their name, which can't be a part of filename (and is currently substrituted by "_"), meaning that pagename and filename are not always the same.
- explore the use of Lua modules (from Extension:Scribunto) in templates that use {{#cargo_query:...|format=template}} syntax - this can greatly simplify the formatting of fields with comma-separated values (such as item.colonyTags), which would otherwise require a separate Cargo template (and sometimes even additional SQL queries) due to limitations of "format=template".
