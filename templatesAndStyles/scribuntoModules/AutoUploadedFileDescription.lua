local p = {}

-- Display the standard "information about image" for images that were automatically uploaded
-- by the bot (such as [[File:Item_icon_HarvesterBeam.png]]).
-- Usage: {{#invoke: AutoUploadedFileDescription|Main}}.
-- This module doesn't need any parameters (it guesses everything from title of the page).
function p.Main( frame )
	local title = mw.title.getCurrentTitle()
	if title.namespace ~= 6 then
		-- Not in the File: namespace.
		return ''
	end

	local filename = title.text
	local iconItemId = string.match( filename, 'Item icon (.*).png' )
	if iconItemId then
		-- Inventory icon.
		iconItemId = string.gsub( iconItemId, ' ', '_' ) -- For IDs with underscore
		iconItemId = string.gsub( iconItemId, '%.', ':' ) -- For pseudo-items like "prototyper:3"
		return frame:expandTemplate{ title = 'Inventory icon description', args = { iconItemId } }
	end

	-- TODO: here we can later add icons of research nodes, etc.

	return ''
end

return p
