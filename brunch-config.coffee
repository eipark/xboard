exports.config =
  # See http://brunch.io/#documentation for docs.
  files:
    javascripts:
      joinTo:
        'app.js': /^app/
        'vendor.js' /^vendor/
      order:
        before: [
          'vendor'
        ]
      pluginHelpers: 'vendor.js'
    stylesheets:
      joinTo: 'app.css'
    templates:
      joinTo: 'app.js'
