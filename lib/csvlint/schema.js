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
} // class Schema

module.exports = Schema
