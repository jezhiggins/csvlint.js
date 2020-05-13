const Schema = require('./schema')
const ErrorCollector = require('./error-collector')
const fs = require('fs')
const csvparse = require('csv-parse/lib/sync')

class Validator {
  constructor (
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

    this.limitLines_ = options.limit_lines
    // this.extension_ = parseExtension(source)

    this.expectedColumns_ = 0
    this.colCounts_ = []
    this.lineBreaks_ = []

    this.errors_ = new ErrorCollector(schema)

    this.currentLine_ = 0
    this.data_ = []
  } // constructor

  get encoding () { return this.encoding_ }
  get contentType () { return this.contentType_ }
  get extension () { return this.extension_ }
  get headers () { return this.headers_ }
  get linkHeaders () { return this.linkHeaders_ }
  get dialect () { return this.dialect_ }
  get csvHeader () { return this.csvHeader_ }
  get schema () { return this.schema_ }
  get data () { return this.data_ }
  get currentLine () { return this.currentLine_ }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }
  get isValid () { return this.errors_.isValid }

  async validate () {
    // excel warning

    // if (!this.schema_) this.locateSchema()
    // this.setDialect()

    const [headers, sourceStream] =
      await this.openSourceStream(this.source_)

    // this.validateMetaData(headers)

    await this.validateStream(sourceStream)

    // this.finish()
  } // validate

  async validateStream (sourceStream) {
    for await (const line of chunksToLines(sourceStream)) {
      ++this.currentLine_

      const record = csvparse(line)

      this.validateLine(record, this.currentLine_)

      this.data.push(record)
    }
  } // parseLine

  validateLine (record, index = null) {

  } // validateLine

  openSourceStream (source) {
    if (source.indexOf('\n') !== -1) { // multiline text
      return [ {}, [source] ]
    }
    return [ {}, fs.createReadStream(source) ]
  } // openSourceStream
} // class Validator

async function * chunksToLines (chunksGen) {
  let previous = ''
  for await (const chunk of chunksGen) {
    previous += chunk
    let eolIndex
    while ((eolIndex = previous.indexOf('\n')) >= 0) {
      const line = previous.slice(0, eolIndex + 1)
      yield line
      previous = previous.slice(eolIndex + 1)
    }
  }
  if (previous.length > 0) {
    yield previous
  }
} // chunksToLines

async function validate (
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
