local p = {}
local cargo = mw.ext.cargo

-- Print the "Items crafted here" section for a crafting station. (based on [[Special:CargoTables/recipe]])
-- Usage: {{#invoke: ListRecipes|RecipesCraftedAt|Human-readable name of crafting station}}
-- Optional parameters:
-- @param {string} header Text of the header that will be prepended to results (default: "Items crafted here").
function p.RecipesCraftedAt( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local stationName = args[1]
	if not stationName then
		return ''
	end

	-- Perform a SQL query to the Cargo database.
	local rows = cargo.query( 'recipe', 'wikitext', {
		where = 'station="' .. stationName .. '"',
		limit = 5000
	} ) or {}
	if not rows[1] then
		-- No recipes found.
		return ''
	end

	local ret = '<h2>' .. ( args['header'] or 'Items crafted here' ) .. '</h2>'
	for _, row in ipairs( rows ) do
		ret = ret .. row.wikitext
	end
	return ret
end

return p
