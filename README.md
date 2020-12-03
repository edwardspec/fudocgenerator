This script:
- reads the source code of Frackin' Universe mod ( https://github.com/sayterdarkwynd/FrackinUniverse ),
- generates human-readable documentation of all found materials (e.g. *Iodine* or *Gold Bar*) (in MediaWiki markup format).

Usage:
- have the sources of Frackin' Universe in some directory on the local computer.
- edit `config.json`: 1) setting `pathToMod` should be the full path to the directory with FU, 2) setting `pathToVanilla` should be the full path to unpacked Starbound assets (see https://starbounder.org/Modding:Modding_Basics for how to obtain them).
- install Node.js dependencies of this script: run `npm install`.
- run the script itself: `node generate.js`.

### Using with pywikibot to automatically create/update pages

`generate.py` creates an import file for Pywikibot (see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py for details).

You can use Pywikibot in the following way to autocreate pages:
```bash
python3 pwb.py pagefromfile -log -notitle -force -pt:20 -file:/path/to/RESULT/pywikibot/cargoDatabase.import.txt
python3 pwb.py pagefromfile -log -notitle -file:/path/to/RESULT/pywikibot/precreateArticles.import.txt
```

The first command will overwrite the Cargo database pages ("Template:Cargo/..."), which are only meant to be edited by bot. Note that this requires a lot of processing on the server side, so we absolutely must instruct the bot to wait at least 20 seconds (`-pt:20`) between writes.

Second command will precreate the articles for items (infobox + inclusion of {{All recipes for item}}), but only if the article doesn't exist. **You can skip the second command if no new items were recently added into the game.**

### Using with pywikibot to automatically upload icons of items

Running `prepare_uploads.js` will create directory `pywikibot/filesToUpload/all`. You can upload all these images via the following command:

`python3 pwb.py upload -always -ignorewarn -abortonwarn:exists /path/to/RESULT/pywikibot/filesToUpload/all -recursive '{{AutoUploadedFileDescription}}'`
or (see below about "only new files"):
`python3 pwb.py upload -always -ignorewarn -abortonwarn:exists /path/to/TEST/fudocgenerator/RESULT/pywikibot/filesToUpload/onlyNew -recursive '{{AutoUploadedFileDescription}}'`

This will not overwrite existing images.

### Generating "only new" files for Pywikibot

Because Pywikibot is not caching "does this page/image exist?", trying to reupload thousands of images (even though the image does exist, and the upload will be skipped) can be rather slow. To avoid this, you can run the following script:
`node update_status_cache.js`
This will query the MediaWiki API for "which articles and/or images already exist?", allowing `generate.js` and `prepare_uploads.js` to create a much smaller "onlyNew" versions of their respective outputs. For example, `RESULT/pywikibot/filesToUpload/onlyNew` is the same as `RESULT/pywikibot/filesToUpload/all`, but doesn't include any images that are already in the wiki.

Note that this cache will not be updated automatically (this is on purpose, to keep `generate.js` as offline tool); you need to manually re-run `update_status_cache.js` if a long time has passed since the last run.

### TODO (things to improve)

- gather status effects for food and other consumables.
- automatically gather information of which biomes have which plants, seeds, ores, etc.
- gather information about planets: possible biomes, daylight level, tier, gravity, etc.
- gather information about monsters and what they drop.
- improve handling of situations when multiple items have the same visible name (e.g. "Ancient Artifact"). They should have separate articles, but the challenge is that auto-detecting "how to name these pages?" heavily depends on type of item. Such logic already exists for certain types of items (like decorative foods).
- support using 1 article for 2+ items, which is useful for vertical/horizontal and compact/non-compact wires (e.g. "Compact AND Gate"), as well as for items like "Human Flag (Prop Pack)".
- support color cores in descriptions, etc. (like "^green;Some green text^reset;")
- guess maxStack for items that don't have it listed, but which have understandable maxStack? (e.g. 1000 for all blocks and liquids)
- all templates/styles in "templatesAndStyles" category should be a Pywikibot import file. Reasons: 1) it's becoming increasingly inconvenient to keep them in sync in-wiki and in the Git repository, 2) some templates have "/" in their name, which can't be a part of filename (and is currently substrituted by "_"), meaning that pagename and filename are not always the same.
