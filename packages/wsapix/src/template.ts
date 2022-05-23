export const html = (path: string, title?: string) => `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta name="theme-color" content="#000000">

  <title>${title || "Websocket documentation"}</title>
</head>

<body>
  <noscript>
    You need to enable JavaScript to run this app.
  </noscript>
  <script src="https://unpkg.com/@webcomponents/webcomponentsjs@2.5.0/webcomponents-bundle.js"></script>
  <script src="https://unpkg.com/@asyncapi/web-component@0.19.0/lib/asyncapi-web-component.js" defer></script>

  <asyncapi-component
    schemaUrl="${path}"
    cssImportPath="https://unpkg.com/@asyncapi/react-component@0.19.0/lib/styles/fiori.css">
  </asyncapi-component></body>

</html>
`