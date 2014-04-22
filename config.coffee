exports.config =
  # See http://brunch.io/#documentation for docs.
  modules:
    wrapper: false # AGGGGGGGGGGGGGGG
  files:
    javascripts:
      joinTo:
        'app.js': /^app/
        'vendor.js': /^vendor/
      order:
        before: [
          'vendor/js/jquery-1.7.2.min.js'
          'vendor/js/jquery-ui-1.8.19.custom.min.js'
          'vendor/js/colorpicker.js'
          'vendor/js/cjson.js'
        ]
      pluginHelpers: 'vendor.js'
    stylesheets:
      joinTo:
        'app.css': /^app/
        'vendor.css': /^vendor/
    templates:
      joinTo: 'app.js'
