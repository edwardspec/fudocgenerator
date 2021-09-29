local p = {}
local cargo = mw.ext.cargo

-- Print the list of all tenants in the game. (based on [[Special:CargoTables/tenant]])
-- Usage: {{#invoke: ListTenants|ListAllTenants}}
-- or {{#invoke: ListTenants|ListAllTenants|SomeColonyTag}}
function p.ListAllTenants( frame )
	local colonyTag = frame.args[1]

	-- Perform a SQL query to the Cargo database.
	local tables = 'tenant'
	local fields = 'name,tagsWikitext,rentPool'
	local queryOpt = {
		limit = 5000,
		orderBy = 'name'
	}

	if colonyTag then
		queryOpt.where = 'tags HOLDS "' .. colonyTag .. '"'
	end

	local rows = cargo.query( tables, fields, queryOpt ) or {}
	if #rows == 0 then
		-- No tenants require this colony tag.
		return ''
	end

	-- Show a table of all tenants
	-- Resistances must be in the same order as displayed in-game.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Tenant !! Requirements !! Rent\n'

	for _, row in ipairs( rows ) do
		ret = ret .. '|-\n|' .. row.name .. '||' .. row.tagsWikitext ..
			'|| [[TreasurePool:' .. row.rentPool .. '|' .. row.rentPool .. ']]\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
