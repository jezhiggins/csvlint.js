const Schema = require('./schema')
const ErrorCollector = require('./error-collector')
const fs = require('fs')
const csvparse = require('csv-parse')

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
    const parser = csvparse({
      skip_lines_with_error: true,
      on_record: (record, {lines}) => {
        this.validateLine(record, lines)
        this.data.push(record)
      }
    })
    let currentLine
    parser.on('skip', err => this.buildExceptionMessage(err, currentLine))

    for await (const line of chunksToLines(sourceStream)) {
      currentLine = line
      parser.write(line)
    } // for ...

    parser.end()
  } // parseLine

  validateLine (record, currentLine = null) {
    const row = record.filter(col => col)

    if (currentLine <= 1) {
      // header stuff
      // this.validateHeader(record)
      this.colCounts_.push(row.length)
      return
    }

    // this.buildFormats (record)
    this.colCounts_.push(row.length)
    this.expectedColumns_ = this.expectedColumns_ || row.length

    //build_errors(:blank_rows, :structure, current_line, nil, stream.to_s) if row.reject { |c| c.nil? || c.empty? }.size == 0
    //# Builds errors and warnings related to the provided schema file
    //if @schema
    //@schema.validate_row(row, current_line, all_errors, @source, @validate)
    //@errors += @schema.errors
    //  all_errors += @schema.errors
    //  @warnings += @schema.warnings
    //else
    //  build_errors(:ragged_rows, :structure, current_line, nil, stream.to_s) if !row.empty? && row.size != @expected_columns
    //end

  } // validateLine

  openSourceStream (source) {
    if (source.indexOf('\n') !== -1) { // multiline text
      return [ {}, [source] ]
    }
    return [ {}, fs.createReadStream(source) ]
  } // openSourceStream

  buildExceptionMessage (exception, badLine) {
    const error = CsvParseErrors.translate(exception)
    this.errors_.buildError(error, "structure", exception.lines, null, badLine)
  } // buildExceptionMessage
} // class Validator

const CsvParseErrors = {
  CSV_QUOTE_NOT_CLOSED: 'unclosedQuote',
  CSV_INVALID_CLOSING_QUOTE: 'trailingCharacters',

  translate (exception) {
    return CsvParseErrors[exception.code] || 'unknownError'
  }
} // CsvErrorTranslations

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
} // validate

module.exports = validate
