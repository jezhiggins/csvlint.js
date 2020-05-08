const ErrorCollector = require('./error-collector')

class Schema {
  constructor(
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

  get uri() { return this.uri_ }
  get fields() { return this.fields_ }
  get title() { return this.title_ }
  get description() { return this.description_ }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }

  validateRow (
    values,
    row = null,
    allErrors = [],
    sourceUrl = null,
    validate = true
  ) {
    this.reset()

    this.fields_.forEach((field, index) => {
      const value = values[index] || ""
      field.validateColumn(value, row, index+1, allErrors)
      this.errors.push(...field.errors)
      this.warnings.push(...field.errors)
    })

    return this.isValid
  } // validateRow

  reset () { this.errors_.reset() }
  get isValid () { return this.errors_.isValid }
} // class Schema

module.exports = Schema
