### Work In Progress (not ready yet)

This script:
- reads the source code of Frackin' Universe mod ( https://github.com/sayterdarkwynd/FrackinUniverse ),
- generates human-readable documentation of all found materials (e.g. *Iodine* or *Gold Bar*) (in MediaWiki markup format).

Usage:
- have the sources of Frackin' Universe in some directory on the local computer.
- edit `config.json`: 1) setting `pathToMod` should be the full path to the directory with FU, 2) setting `pathToVanilla` should be the full path to unpacked Starbound assets (see https://starbounder.org/Modding:Modding_Basics for how to obtain them).
- install Node.js dependencies of this script: run `npm install`.
- run the script itself: `node generate.js`.

***This tool is in the early stages of development and is not ready yet.***

### Using with pywikibot to automatically create/update pages

`generate.py` creates an import file for Pywikibot (see https://www.mediawiki.org/wiki/Manual:Pywikibot/pagefromfile.py for details): RESULT/pywikibot.import.txt

You can use Pywikibot in the following way to autocreate pages:
```bash
python3 pwb.py pagefromfile -log -file:/home/edward/TEST/fudocgenerator/RESULT/pywikibot.import.txt -force -notitle -nocontent:'Automatic item info'
```

Note that `-force` means that this will overwrite the pages about items if they don't have "Automatic item info" included (normally 99,9% of item pages should have it, and the rest can just add `<!-- Automatic item info -->` into their wikitext to become excluded from being overwritten).
