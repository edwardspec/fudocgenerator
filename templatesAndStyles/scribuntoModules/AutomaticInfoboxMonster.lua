local p = {}
local cargo = mw.ext.cargo

local statDefaults = {
	health = 1,
	protection = 0,
	damage = 0,
	physical = 0,
	radioactive = 0,
	poison = 0,
	electric = 0,
	fire = 0,
	ice = 0,
	cosmic = 0,
	shadow = 0
}

-- Perform a SQL query to "monster" table in the Cargo database (see Special:CargoTables/monster).
-- @param {string} monsterId
-- @return {table} Database row.
local function queryMonster( monsterId )
	local tables = 'monster'
	local fields = 'name,description,capturable,health,protection,damage,physical,radioactive,poison,electric,fire,ice,cosmic,shadow,id'
	local queryOpt = {
		where = 'id="' .. monsterId .. '"',
		limit = 1
	}
	local row = ( cargo.query( tables, fields, queryOpt ) or {} )[1]
	if not row then
		return nil
	end

	-- Add default values for stats.
	for fieldName, defaultValue in pairs( statDefaults ) do
		if row[fieldName] == '' then
			row[fieldName] = defaultValue
		end
	end

	return row
end

-- Print the automatic infobox of monster. (based on [[Special:CargoTables/monster]])
-- Usage: {{#invoke: AutomaticInfoboxMonster|Main|adultpoptopfire}}
-- First parameter: monster ID, e.g. "adultpoptopfire".
-- Optional parameter: nocat=1 - if present, this infobox won't add any categories to the current article. (can used in examples, help pages, etc.)
-- Optional parameter: image=Something.png - if present, will be used as infobox image (replaces the default image, which is image of the monster's body).
-- Optional parameter: image_size=150px - if present, sets the width of image.
function p.Main( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local id = args[1] or 'adultpoptopfire'
	local nocat = args['nocat'] or false
	local image = args['image']

	-- Perform a SQL query to the Cargo database (see Special:CargoTables/monster).
	local row = queryMonster( id )
	if not row then
		-- Monster not found in the database.
		if nocat then
			return ''
		end
		return '[[Category:Monster pages with broken automatic infobox]]'
	end

	local ret = ''
	if not nocat then
		ret = ret .. '[[Category:Monsters]]\n'
	end

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
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/title', args = { row.name } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/line', args = { row.description } }

	local captureStatus
	if row.capturable == '1' then
		captureStatus = 'Yes [[File:Filled capture pod.png|32px|link=|alt=]]'
	else
		captureStatus = 'No [[File:Dead capture pod.png|32px|link=|alt=]]'
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
