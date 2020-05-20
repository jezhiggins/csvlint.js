const Schema = require('./schema')
const ErrorCollector = require('./error-collector')
const fs = require('fs')
const csvparse = require('csv-parse')
const fetch = require('node-fetch')

const defaultDialect = {
  header: true,
  headerRowCount: 1,
  delimiter: ',',
  skipInitialSpace: true,
  lineTerminator: 'auto',
  quoteChar: '"',
  trim: true
}

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
    this.lambda_ = options.lambda
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
  get hasHeader () { return this.csvHeader_ && this.dialect.header }
  get schema () { return this.schema_ }
  get data () { return this.data_ }
  get rowCount () { return this.data_.length }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }
  get isValid () { return this.errors_.isValid }

  async validate () {
    // excel warning

    // if (!this.schema_) this.locateSchema()
    this.setDialect()

    const [headers, sourceStream] =
      await this.openSourceStream(this.source_)

    this.validateMetaData(headers)

    await this.validateStream(sourceStream)

    // this.finish()
  } // validate

  async validateStream (sourceStream) {
    const parser = csvparse({
      skip_lines_with_error: true,
      on_record: (record, { lines }) => {
        this.validateLine(record, lines)
        this.data_.push(record)
        if (this.lambda_) this.lambda_(record, lines)
      }
    })
    let currentLine
    parser.on('skip', err => {
      if (this.buildExceptionMessage(err, currentLine)) {
        this.data_.push(null)
      }
    })

    for await (const line of chunksToLines(sourceStream)) {
      currentLine = line
      parser.write(line)
    } // for ...

    parser.end()
  } // parseLine

  validateLine (record, currentLine = null) {
    this.colCounts_.push(record.filter(col => col).length)

    if (currentLine <= 1 && this.csvHeader_) {
      this.validateHeader(record)
      return
    }

    // this.buildFormats (record)
    this.expectedColumns_ = this.expectedColumns_ || record.length

    // build_errors(:blank_rows, :structure, current_line, nil, stream.to_s) if row.reject { |c| c.nil? || c.empty? }.size == 0
    // # Builds errors and warnings related to the provided schema file
    // if @schema
    // @schema.validate_row(row, current_line, all_errors, @source, @validate)
    // @errors += @schema.errors
    //  all_errors += @schema.errors
    //  @warnings += @schema.warnings
    // else
    //  build_errors(:ragged_rows, :structure, current_line, nil, stream.to_s) if !row.empty? && row.size != @expected_columns
    // end
  } // validateLine

  validateHeader (header) {
    const names = new Set()

    if (this.dialect.trim) {
      header = header.map(h => h.trim())
    }

    const warning = (type, index) => this.buildWarning(type, 'schema', null, index + 1)

    header.forEach((h, index) => {
      if (!h) {
        warning('empty_column_name', index)
      }

      if (names.has(h)) {
        warning('duplicate_column_name', index)
      }

      names.add(h)
    })

    return this.isValid
  } // validateHeader

  validateMetaData (headers) {
    const assumedHeader = !this.suppliedDialect_

    if (headers.length) {
      // TODO header metadata checking
    } // if (headers.length)

    if (assumedHeader) {
      this.buildInfoMessage('assumed_header', 'structure')
    }

    // TODO link header processing
  } // validateMetadata

  setDialect () {
    this.assumedHeader_ = !this.dialect_.header
    this.suppliedDialect_ = Object.keys(this.dialect_).length !== 0

    const schemaDialect = { }

    this.dialect_ = buildDialect(schemaDialect, this.dialect_)

    this.csvHeader_ = this.csvHeader_ && this.dialect_.header
  } // setDialect

  async openSourceStream (source) {
    if (source.indexOf('\n') !== -1) { // multiline text
      return [{}, [source]]
    }

    if (source.indexOf('http') === 0) {
      const response = await fetch(source)
      return [
        response.headers.raw(),
        response.body
      ]
    }

    return [{}, fs.createReadStream(source)]
  } // openSourceStream

  buildInfoMessage (type, category) {
    this.errors_.buildInfoMessage(type, category)
  } // buildInfoMessage

  buildWarning (type, category, row, column) {
    this.errors_.buildWarning(type, category, row, column)
  } // buildWarning

  buildExceptionMessage (exception, badLine) {
    const errorType = CsvParseErrors.translate(exception)
    // sometimes get the same error repeated
    const existing = this.errors_.errors.find(e =>
      e.type === errorType && e.row === exception.lines
    )
    if (existing) return false

    this.errors_.buildError(errorType, 'structure', exception.lines, null, badLine)
    return true
  } // buildExceptionMessage
} // class Validator

const CsvParseErrors = {
  INVALID_OPENING_QUOTE: 'invalidOpeningQuote',
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

function buildDialect (...dialects) {
  dialects.unshift(defaultDialect)

  const mergedDialect = { }
  for (const dialect of dialects) {
    Object.assign(mergedDialect, dialect)
  }

  return mergedDialect
} // buildDialect

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
