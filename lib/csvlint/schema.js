const ErrorCollector = require('./error-collector')
const Field = require('./field')
const http = require('http')
const https = require('https')

class Schema {
  constructor (
    uri,
    fields = [],
    title = null,
    description = null
  ) {
    this.uri_ = uri
    this.fields_ = fields
    this.title_ = title
    this.description_ = description

    this.errors_ = new ErrorCollector()
  } // constructor

  get uri () { return this.uri_ }
  get fields () { return this.fields_ }
  get title () { return this.title_ }
  get description () { return this.description_ }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }

  static fromJsonTable (uri, json) {
    const fields = Array.isArray(json.fields)
      ? json.fields.map(field => new Field(
        field.name,
        field.constraints,
        field.title,
        field.description
      ))
      : []
    return new Schema(uri, fields, json.title, json.description)
  } // fromJsonTable

  static async loadFromUri (uri, outputErrors = true) {
    return Schema.loadFromString(uri, await getUri(uri), outputErrors)
  } // loadFromUri

  static loadFromString (uri, string, outputErrors = true) {
    const json = JSON.parse(string)
    return Schema.fromJsonTable(uri, json)
  } // loadFromString

  validateHeader (
    header,
    sourceUrl = null,
    validate = true
  ) {
    this.reset()

    const foundHeader = header.join()
    const expectedHeader = this.fields_.map(field => field.name).join()

    if (foundHeader !== expectedHeader) {
      this.warning('malformed_header', 1, null, foundHeader, { expectedHeader: expectedHeader })
    }

    return this.isValid
  } // validateHeader

  validateRow (
    values,
    row = null,
    allErrors = [],
    sourceUrl = null,
    validate = true
  ) {
    this.reset()

    if (values.length < this.fields_.length) {
      this.fields_.slice(values.length).forEach((field, index) => {
        this.warning('missing_column', row, values.length + index + 1)
      })
    }
    if (values.length > this.fields_.length) {
      values.slice(this.fields_.length).forEach((value, index) => {
        this.warning('extra_column', row, this.fields_.length + index + 1)
      })
    }

    this.fields_.forEach((field, index) => {
      const value = values[index] || ''
      field.validateColumn(value, row, index + 1, allErrors)
      this.errors.push(...field.errors)
      this.warnings.push(...field.errors)
    })

    return this.isValid
  } // validateRow

  reset () { this.errors_.reset() }
  get isValid () { return this.errors_.isValid }

  warning (type, row, column, content, constraint) {
    this.errors_.buildWarning(type, 'schema', row, column, content, constraint)
  } // error
} // class Schema

function getUri (uri) {
  return new Promise((resolve, reject) => {
    http.get(uri, resp => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => resolve(data))
      resp.on('error', err => reject(err))
    })
  })
} // getUri

module.exports = Schema
