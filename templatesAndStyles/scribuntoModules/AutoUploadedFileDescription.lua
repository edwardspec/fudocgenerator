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
	filename = string.gsub( filename, ' ', '_' ) -- For IDs with underscore
	filename = string.gsub( filename, '%.', ':' ) -- For pseudo-items like "prototyper:3"

	local itemId = string.match( filename, 'Item_icon_(.*).png' )
	if itemId then
		-- Inventory icon.
		return frame:expandTemplate{ title = 'Inventory icon description', args = { itemId } }
	end

	itemId = string.match( filename, 'Item_image_(.*).png' )
	if itemId then
		-- Image of placeable object (e.g. furniture).
		return frame:expandTemplate{ title = 'Placeable image description', args = { itemId } }
	end

	-- TODO: here we can later add icons of research nodes, etc.

	return ''
end

return p
