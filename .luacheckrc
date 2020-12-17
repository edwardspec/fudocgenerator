-- Luacheck configuration for Scrinbuto modules (MediaWiki templates implemented in Lua).
-- See https://www.mediawiki.org/wiki/Extension:Scribunto/Lua_reference_manual for details.

include_files = {
	"templatesAndStyles/scribuntoModules/**.lua"
}

std = "lua53"
max_line_length = false
codes = true -- Show luacheck's error/warning codes.

-- Globals from Scrinbuto API:
read_globals = {
	"mw",
	"unpack", -- No table.unpack() in Scribunto, see https://www.mediawiki.org/wiki/Extension:Scribunto/Lua_reference_manual#unpack
}

