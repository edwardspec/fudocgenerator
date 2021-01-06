local p = {}
local cargo = mw.ext.cargo

-- Perform a SQL query to "armorset" table in the Cargo database (see Special:CargoTables/armorset).
-- @param {string} armorSetId
-- @return {table} Database row.
local function queryArmorSet( armorSetId )
	local tables = 'armorset'
	local fields = 'tier,rarity,headPage,chestPage,legsPage,damage,protection,energy,health,setBonus,price,physical,radioactive,poison,electric,fire,ice,cosmic,shadow,id'
	local queryOpt = {
		where = 'id="' .. armorSetId .. '"',
		limit = 1
	}
	return ( cargo.query( tables, fields, queryOpt ) or {} )[1]
end

-- Print the automatic information about armor set. (based on [[Special:CargoTables/armorset]])
-- Usage: {{#invoke: AutomaticInfoboxMonster|Main|ff_slime}}
-- First parameter: armor set ID: can be one of two strings:
------  1): the name of bonus status effect without "setbonus" suffix (if such status effect exists and is not "fusetbonusmanager"),
------- 2) common part of item ID, e.g. "ff_slime" for items ff_slimehead, ff_slimechest, ff_slimelegs.
-- Optional parameter: nocat=1 - if present, this template won't add any categories to the current article. (can used in examples, help pages, etc.)
function p.Main( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local id = args[1] or 'ff_slime'
	local nocat = args['nocat'] or false

	-- Perform a SQL query to the Cargo database (see Special:CargoTables/armorset).
	local row = queryArmorSet( id )
	if not row then
		-- Armor set not found in the database.
		if nocat then
			return ''
		end
		return '[[Category:Armor pages with broken automatic template]]'
	end

	local ret = ''
	if not nocat then
		ret = ret .. '[[Category:Armor sets]]\n'
	end

	-- We use template {{Armor set}} to format the resulting page.
	-- All we have to do here is to calculate its parameters.
	local params = {
		tier = row.tier,
		rarity = row.rarity,
		price = row.price,
		head_id = this.
	}


{{Armor set
| name =
| tier =
| rarity =
| price =
| obtained_by = Crafted
| head_id =
| chest_id =
| legs_id =
| head =
| chest =
| legs =
| head_damage =
| chest_damage =
| legs_damage =
| head_armor =
| chest_armor =
| legs_armor =
| head_energy =
| chest_energy =
| legs_energy =
| head_health =
| chest_health =
| legs_health =
| head_effects =
| chest_effects =
| legs_effects =
| bonus =
}}

	-- Format "row" (information about monster: row.name, row.description, etc.) as wikitext.
	ret = ret .. '{| class="infobox"\n'

	-- Find the image, if any.
	local imageTitle = mw.title.new( image or ( 'Monster body ' .. id .. '.png' ), 6 )
	if imageTitle.fileExists then
		local imageParams = { imageTitle.text }
		if args['image_size'] then
			imageParams['width'] = args['image_size']
		end
		ret = ret .. frame:expandTemplate{ title = 'infobox/image', args = imageParams }
	elseif not nocat then
		ret = ret .. '\n[[Category:Monster pages without image]]\n'
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/title', args = { row.name } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/line', args = { row.description } }

	local captureStatus
	if row.capturable == '1' then
		captureStatus = 'Yes [[File:Capturable icon.png|18px|link=|alt=]]'
	else
		captureStatus = 'No [[File:Not capturable icon3.png|18px|link=|alt=]]'
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Capturable?', captureStatus } }

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
		'[[File:Health icon.png|24px|left|link=|alt=]] Health',
		row.health
	} }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
		'[[File:Defence icon.png|24px|left|link=|alt=]] Defense',
		row.protection
	} }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
		'[[File:Damage icon.png|24px|left|link=|alt=]] Touch damage',
		row.damage
	} }

	-- TODO: move inline CSS into TemplateStyles or something
	local resistBegin = '<span class="infobox-resist" style="display: inline-block; width: 40%;">'
	local resistEnd = '</span> '

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Resistances',
		resistBegin .. '[[File:Physical (Attack).png|24px|link=|Physical resistance|alt=Physical]]&nbsp;' .. row.physical .. resistEnd ..
		resistBegin .. '[[File:Radioactive (Attack).png|24px|link=|Radioactive resistance|alt=Radioactive]]&nbsp;' .. row.radioactive .. resistEnd ..
		resistBegin .. '[[File:Poison (Attack).png|24px|link=|Poison resistance|alt=Poison]]&nbsp;' .. row.poison .. resistEnd ..
		resistBegin .. '[[File:Electric (Attack).png|24px|link=|Electric resistance|alt=Electric]]&nbsp;' .. row.electric .. resistEnd ..
		resistBegin .. '[[File:Fire (Attack).png|24px|link=|Fire resistance|alt=Fire]]&nbsp;' .. row.fire .. resistEnd ..
		resistBegin .. '[[File:Frost (Attack).png|24px|link=|Ice resistance|alt=Ice]]&nbsp;' .. row.ice .. resistEnd ..
		resistBegin .. '[[File:Cosmic (Attack).png|24px|link=|Cosmic resistance|alt=Cosmic]]&nbsp;' .. row.cosmic .. resistEnd ..
		resistBegin .. '[[File:Shadow (Attack).png|24px|link=|Shadow resistance|alt=Shadow]]&nbsp;' .. row.shadow .. resistEnd
	} }

	-- Monster ID is last, because very few people need it
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'ID', row.id } }

	ret = ret .. '\n|}\n'
	return ret
end

return p
