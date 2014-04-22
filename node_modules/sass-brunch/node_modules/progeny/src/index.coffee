'use strict'

sysPath = require 'path'
fs = require 'fs'
each = require 'async-each'

defaultSettings = (extname) ->
  switch extname
    when 'jade'
      regexp: /^\s*(?:include|extends)\s+(.+)/
    when 'styl'
      regexp: /^\s*@import\s+['"]?([^'"]+)['"]?/
      exclusion: 'nib'
    when 'less'
      regexp: /^\s*@import\s+['"]([^'"]+)['"]/
    when 'scss', 'sass'
      regexp: /^\s*@import\s+['"]?([^'"]+)['"]?/
      prefix: '_'
      exclusion: /^compass/
      extensionsList: ['scss', 'sass']

module.exports =
({rootPath, extension, regexp, prefix, exclusion, extensionsList}={}) ->
  parseDeps = (data, path, depsList, callback) ->
    parent = sysPath.dirname path if path
    deps = data
      .toString()
      .split('\n')
      .map (line) ->
        line.match regexp
      .filter (match) ->
        match?.length > 0
      .map (match) ->
        match[1]
      .filter (path) ->
        !!path and not switch
          when exclusion instanceof RegExp
            exclusion.test path
          when exclusion instanceof String
            exclusion is path
          else false
      .map (path) ->
        if extension and ".#{extension}" isnt sysPath.extname path
          "#{path}.#{extension}"
        else
          path
      .map (path) ->
        if path[0] is '/' or not parent
          sysPath.join rootPath, path[1..]
        else
          sysPath.join parent, path

    if prefix?
      prefixed = []
      deps.forEach (path) ->
        dir = sysPath.dirname path
        file = sysPath.basename path
        if 0 isnt file.indexOf prefix
          prefixed.push sysPath.join dir, "#{prefix}#{file}"
      deps = deps.concat prefixed

    if extensionsList.length
      altExts = []
      deps.forEach (path) ->
        dir = sysPath.dirname path
        extensionsList.forEach (ext) ->
          if ".#{ext}" isnt sysPath.extname path
            base = sysPath.basename path, ".#{extension}"
            altExts.push sysPath.join dir, "#{base}.#{ext}"
      deps = deps.concat altExts

    if deps.length
      each deps, (path, callback) ->
        if path in depsList
          callback()
        else
          depsList.push path
          fs.readFile path, encoding: 'utf8', (err, data) ->
            return callback() if err
            parseDeps data, path, depsList, callback
      , callback
    else
      callback()

  (data, path, callback) ->
    depsList = []

    extension ?= sysPath.extname(path)[1..]
    def = defaultSettings extension
    regexp ?= def.regexp
    prefix ?= def.prefix
    exclusion ?= def.exclusion
    extensionsList ?= def.extensionsList or []

    run = ->
      parseDeps data, path, depsList, ->
        callback null, depsList
    if data?
      do run
    else
      fs.readFile path, encoding: 'utf8', (err, fileContents) ->
        return callback err if err
        data = fileContents
        do run

