const config = {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  tabWidth: 2,
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro'
      }
    }
  ]
}

export default config
