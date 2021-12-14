local p = {}
local cargo = mw.ext.cargo

-- Print the list of all tenants in the game. (based on [[Special:CargoTables/tenant]])
-- Usage: {{#invoke: ListTenants|ListLights}} - everything except blocks and liquids
-- or {{#invoke: ListTenants|ListLights|block}}, or {{#invoke: ListTenants|liquid}}
function p.ListLights( frame )
	local itemCategory = frame.args[1]

	local where = 'category NOT IN ("block", "liquid")'
	local itemHeader = 'Item'

	if itemCategory == "block" or itemCategory == "liquid" then
		where = 'category="' .. itemCategory .. '"'
		itemHeader = mw.getContentLanguage():ucfirst( itemCategory )
	end

	where = where .. ' AND lightLevel.prop="lightLevel" AND lightColor.prop="lightColor"'

	-- Perform a SQL query to the Cargo database.
	local tables = 'item_metadata=lightLevel,item_metadata=lightColor,item'
	local fields = 'name,wikiPage,lightLevel.value=level,lightColor.value=color'
	local queryOpt = {
		limit = 5000,
		where = where,
		orderBy = '(0+level) DESC',
		join = 'lightColor.id=item.id, lightColor.id=lightLevel.id'
	}

	local rows = cargo.query( tables, fields, queryOpt ) or {}
	if #rows == 0 then
		-- Nothing found.
		return ''
	end


	-- Show a table of all light sources.
	-- Resistances must be in the same order as displayed in-game.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! ' .. itemHeader .. ' !! Light level !! class="unsortable"| Light color\n'

	for _, row in ipairs( rows ) do
		ret = ret .. '|-\n| [[' .. row.wikiPage .. '|' .. row.name .. ']] ||' .. row.level ..
			'||' ..  frame:expandTemplate{ title = 'LightColor', args = { row.color } } .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
