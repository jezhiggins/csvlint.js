function metadataError (path, msg = '') {
  const fullMsg = `${path} ${msg}`
  const err = new Error(fullMsg)
  err.name = 'Metadata Error'
  throw err
}

module.exports = metadataError
