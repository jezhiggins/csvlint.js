const Schema = require('./schema')
const ErrorCollector = require('./error-collector')

class Validator {
  constructor(
    source,
    dialect = {},
    schema = null,
    options = {}
  ) {
    this.source_ = source
    this.formats_ = []
    this.schema_ = schema
    this.dialect_ = dialect
    this.csvHeader_ = true
    this.headers_ = {}
    this.lamdba_ = options.lambda
    this.validate_ = options.validate || true
    this.leading_ = ""

    this.limitLines_ = options.limit_lines
    // this.extension_ = parseExtension(source)

    this.expectedColumns_ = 0
    this.colCounts_ = []
    this.lineBreaks_ = []

    this.errors_ = new ErrorCollector(schema)

    this.data_ = []

    this.validate()
  } // constructor

  get encoding() { return this.encoding_ }
  get contentType() { return this.contentType_ }
  get extension() { return this.extension_ }
  get headers() { return this.headers_ }
  get linkHeaders() { return this.linkHeaders_ }
  get dialect() { return this.dialect_ }
  get csvHeader() { return this.csvHeader_ }
  get schema() { return this.schema_ }
  get data() { return this.data_ }
  get currentLine() { return this.currentLine_ }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }
  get isValid () { return this.errors_.isValid }

  validate () {

  }
} // class Validator

async function validate(
  source,
  dialect = {},
  schema = null,
  options = {}
) {
  const validator = new Validator(source, dialect, schema, options)
  await validator.validate()
  return validator
}

module.exports = validate
