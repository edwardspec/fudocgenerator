local p = {}
local cargo = mw.ext.cargo

-- Print the list of all tenants in the game. (based on [[Special:CargoTables/tenant]])
-- Usage: {{#invoke: ListTenants|ListAllTenants}}
function p.ListAllTenants()
	-- Perform a SQL query to the Cargo database.
	local tables = 'tenant'
	local fields = 'name,tagsWikitext'
	local queryOpt = {
		limit = 5000,
		orderBy = 'name'
	}
	local rows = cargo.query( tables, fields, queryOpt ) or {}

	-- Show a table of all tenants
	-- Resistances must be in the same order as displayed in-game.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Tenant !! Requirements\n'

	for _, row in ipairs( rows ) do
		ret = ret .. '|-\n|' .. row.name .. '||' .. row.tagsWikitext .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
