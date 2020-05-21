function metadataError (path, msg = '') {
  const fullMsg = `${p} ${msg}`
  const err = new Error(fullMsg)
  err.name = 'Metadata Error'
  throw err
}

module.exports = metadataError
