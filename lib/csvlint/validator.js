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
    this.lineBreaksReported_ = false
    this.lineBreaks_ = new Set()

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
  get csvOptions () { return this.csvOptions_ }
  get schema () { return this.schema_ }
  get data () { return this.data_ }
  get rowCount () { return this.data_.length }
  get errors () { return this.errors_.errors }
  get warnings () { return this.errors_.warnings }
  get infoMessages () { return this.errors_.infoMessages }
  get isValid () { return this.errors_.isValid }
  get lineBreaksReports() { return this.lineBreaksReported_ }

  async validate () {
    // excel warning

    this.locateSchema()
    this.setDialect()

    const [headers, sourceStream] =
      await this.openSourceStream(this.source_)

    this.validateMetaData(headers)

    await this.validateStream(sourceStream)

    this.finish()
  } // validate

  async validateStream (sourceStream) {
    const parser = csvparse({
      skip_lines_with_error: true,
      on_record: (record, ctx) => {
        this.validateLine(record, ctx.lines, currentLine)
        this.data_.push(record)
        if (this.lambda_) this.lambda_(record, ctx.lines)
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

  validateLine (record, lineNumber = null, lineContents) {
    this.reportLineBreaks(lineContents)

    const colCount = record.filter(col => col).length
    this.colCounts_.push(colCount)

    if (lineNumber <= 1 && this.csvHeader_) {
      this.validateHeader(record)
      return
    }

    this.buildFormats (record)
    this.expectedColumns_ = this.expectedColumns_ || record.length

    if (colCount === 0) {
      this.buildError('blank_rows', 'structure', lineNumber, null, lineContents)
    }

    // Builds errors and warnings related to the provided schema file
    if (this.schema_) {
      this.schema_.validateRow(record, lineNumber, [], this.source_, this.validate_) // not entirely sure what allErrors is doing here
      this.errors_.errors.push(...this.schema_.errors)
      this.errors_.warnings.push(...this.schema_.warnings)
    } else {
      if (record.length !== this.expectedColumns_) {
        this.buildError('ragged_rows', 'structure', lineNumber, null, lineContents)
      }
    }
  } // validateLine

  reportLineBreaks (lineContents) {
    const l = lineContents.length
    if ((l === 0) || (lineContents.substring(l-1) !== '\n')) return
    // Return straight away if there's no newline character - i.e. we're on the last line

    const lineBreak = getLineBreak(lineContents)
    this.lineBreaks_.add(lineBreak)
    if (!this.lineBreaksReported_) {
      if (this.csvOptions_.rowSep !== 'auto' && !lineContents.endsWith(this.csvOptions_.rowSep))
        this.buildError('line_breaks', 'structure')
      if (lineBreak !== '\r\n') {
        this.buildInfoMessage('nonrfc_line_breaks', 'structure')
        this.lineBreaksReported_ = true
      }
    }
  } // reportLineBreaks

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
    this.validateContentTypeMetadata(headers)

    this.validateLinkHeaders(headers)
  } // validateMetadata

  validateContentTypeMetadata (headers) {
    let assumedHeader = !this.suppliedDialect_

    if (Object.keys(headers).length) {
      const { contentType, isTextCsv, headerPresent } =
        crackContentType(headers)
      this.contentType_ = contentType
      if (isTextCsv) {
        this.csvHeader_ = this.csvHeader_ && true
        assumedHeader = this.assumedHeader_
      }
      if (headerPresent) {
        if (headerPresent === 'present') this.csvHeader_ = true
        if (headerPresent === 'absent') this.csvHeader_ = false
        assumedHeader = false
      }
      if (!this.contentType_) {
        this.buildWarning('no_content_type', 'context')
      }
      if (this.contentType_ && !isTextCsv) {
        this.buildError('wrong_content_type', 'context')
      }
    } // if (headers.length)

    if (assumedHeader) {
      this.buildInfoMessage('assumed_header', 'structure')
    }
  } // validateContentTypeMetadata

  validateLinkHeaders (headers) {
    /*
      @link_headers = @headers["link"].split(",") rescue nil
      @link_headers.each do |link_header|
        match = LINK_HEADER_REGEXP.match(link_header)
        uri = match["uri"].gsub(/(^\<|\>$)/, "") rescue nil
        rel = match["rel-relationship"].gsub(/(^\"|\"$)/, "") rescue nil
        param = match["param"]
        param_value = match["param-value"].gsub(/(^\"|\"$)/, "") rescue nil
        if rel == "describedby" && param == "type" && ["application/csvm+json", "application/ld+json", "application/json"].include?(param_value)
          begin
            url = URI.join(@source_url, uri)
            schema = Schema.load_from_uri(url)
            if schema.instance_of? Csvlint::Csvw::TableGroup
              if schema.tables[@source_url]
                @schema = schema
              else
                warn_if_unsuccessful = true
                build_warnings(:schema_mismatch, :context, nil, nil, @source_url, schema)
              end
            end
          rescue OpenURI::HTTPError
          end
        end
      end if @link_headers

 */
  } // validateLinkHeaders

  finish () {
    //  sum = @col_counts.inject(:+)
    //  unless sum.nil?
    //    build_warnings(:title_row, :structure) if @col_counts.first < (sum / @col_counts.size.to_f)
    //  end
    //  # return expected_columns to calling class
    //  build_warnings(:check_options, :structure) if @expected_columns == 1
    this.checkConsistency()
    //  check_foreign_keys if @validate
    this.checkMixedLinebreaks()
    //  validate_encoding
  } // finish

  locateSchema () {
    if (this.schema_) return
    /*
          @source_url = nil
      warn_if_unsuccessful = false
      case @source
        when StringIO
          return
        when File
          @source_url = "file:#{URI.encode(File.expand_path(@source))}"
        else
          @source_url = @source
      end
      unless @schema.nil?
        if @schema.tables[@source_url]
          return
        else
          @schema = nil
        end
      end
      paths = []
      if @source_url =~ /^http(s)?/
        begin
          well_known_uri = URI.join(@source_url, "/.well-known/csvm")
          paths = open(well_known_uri).read.split("\n")
        rescue OpenURI::HTTPError, URI::BadURIError
        end
      end
      paths = ["{+url}-metadata.json", "csv-metadata.json"] if paths.empty?
      paths.each do |template|
        begin
          template = URITemplate.new(template)
          path = template.expand('url' => @source_url)
          url = URI.join(@source_url, path)
          url = File.new(url.to_s.sub(/^file:/, "")) if url.to_s =~ /^file:/
          schema = Schema.load_from_uri(url)
          if schema.instance_of? Csvlint::Csvw::TableGroup
            if schema.tables[@source_url]
              @schema = schema
              return
            else
              warn_if_unsuccessful = true
              build_warnings(:schema_mismatch, :context, nil, nil, @source_url, schema)
            end
          end
        rescue Errno::ENOENT
        rescue OpenURI::HTTPError, URI::BadURIError, ArgumentError
        rescue => e
          raise e
        end
      end
      build_warnings(:schema_mismatch, :context, nil, nil, @source_url, schema) if warn_if_unsuccessful
      @schema = nil
     */
  } // locateSchema

  setDialect () {
    this.assumedHeader_ = !this.dialect_.header
    this.suppliedDialect_ = Object.keys(this.dialect_).length !== 0

    const schemaDialect = { }

    this.dialect_ = buildDialect(schemaDialect, this.dialect_)

    this.csvHeader_ = this.csvHeader_ && this.dialect_.header
    this.csvOptions_ = this.dialectToCsvOptions(this.dialect_)
  } // setDialect

  dialectToCsvOptions (dialect) {
    const skipInitialSpace = dialect.skipInitialSpace || true
    const delimiter = dialect.delimiter + (!skipInitialSpace ? ' ' : '')
    const rowSep = dialect.lineTerminator
    const quoteChar = dialect.quoteChar

    return {
      colSep: delimiter,
      rowSep: rowSep,
      quoteChar: quoteChar,
      skipBlanks: false
    }
  } // dialectToCsvOptions

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

  buildFormats (record) {
    record.forEach((col, i) => {
      if (col === null) return

      this.formats_[i] = this.formats_[i] || { }

      const format = columnFormat(col)
      this.formats_[i][format] = this.formats_[i][format] || 0
      this.formats_[i][format] += 1
    })
  } // buildFormats

  checkConsistency () {
    this.formats_.forEach((format, i) => {
      const counts = Object.values(format).filter(c => c).length
      if (counts > 1)
        this.buildWarning('inconsistentValues', 'schema', null, i+1)
    })
  } // checkConsistency

  checkMixedLinebreaks () {
    if (this.lineBreaks_.size > 1) {
      this.buildLinebreakError();
    }
  } // checkMixedLinebreaks

  buildLinebreakError () {
    const hasLineBreakErrors = this.errors.some(e => e.type === 'lineBreaks')
    if (!hasLineBreakErrors)
      this.buildErrors('lineBreaks', 'structure')
  } // buildLinebreakError

  buildInfoMessage (type, category) {
    this.errors_.buildInfoMessage(type, category)
  } // buildInfoMessage

  buildWarning (type, category, row, column) {
    this.errors_.buildWarning(type, category, row, column)
  } // buildWarning

  buildError (type, category, row, column, content) {
    this.errors_.buildError(type, category, row, column, content)
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

function columnFormat (col) {
  const c = col.trim()
  if (FORMATS.numeric.test(c))
    return "numeric"
  if (isUri(c))
    return "uri"
  if (possibleDate(c))
    return dateFormat(c)
  return "string"
} // columnFormat

function isUri (col) {
  try {
    if (FORMATS.uri.test(col)) {
      const u = new URL(col)
      return ['http:', 'https:'].includes(u.protocol)
    }
  } catch (e) {
    return false
  }
} // isUri

function possibleDate(col) {
  return POSSIBLE_DATE_REGEXP.test(col)
} // possibleDate

function dateFormat(col) {

} // dateFormat

const MONTHNAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].join('|')
const ABBR_MONTHNAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].join('|')

const FORMATS = {
  "string": null,
  "numeric": /^\d*\.?\d+(?:[eE][-+]?\d+)?$/,
  "uri": /^https?:/,
  "date_db": /^\d{4,}-\d\d-\d\d$/,
  // "12345-01-01"
  "date_long": new RegExp(`^(?://${MONTHNAMES}) [ \\d]\\d, \\d{4,}$`),
  // "January  1, 12345"
  "date_rfc822": new RegExp(`^[ \\d]\\d (?://${ABBR_MONTHNAMES}) \\d{4,}$`),
  // " 1 Jan 12345"
  "date_short": new RegExp(`^[ \\d]\\d (?://${ABBR_MONTHNAMES})$`),
  // "1 Jan"
  "dateTime_db": /^\d{4,}-\d\d-\d\d \d\d:\d\d:\d\d$/,
  // "12345-01-01 00:00:00"
  "dateTime_hms": /^\d\d:\d\d:\d\d$/,
  // "00:00:00"
  "dateTime_iso8601": /^\d{4,}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/,
  // "12345-01-01T00:00:00Z"
  "dateTime_long": new RegExp(`^(?://${MONTHNAMES}) \\d\\d, \\d{4,} \\d\\d:\\d\\d$`), // "January 01, 12345 00:00"
  "dateTime_short": new RegExp(`^\\d\\d (?://${ABBR_MONTHNAMES}) \\d\\d:\\d\\d$`),   // "01 Jan 00:00"
  "dateTime_time": /^\d\d:\d\d$/,
  // "00:00"
}

const POSSIBLE_DATE_REGEXP = new RegExp(`^(\\d|\\s\\d${ABBR_MONTHNAMES}${MONTHNAMES})`)

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

const textCsv = /text\/csv/
const presentOrAbsent = /header=(present|absent)/g
function crackContentType (headers) {
  const [contentType] = headers['content-type']
  const isTextCsv = textCsv.test(contentType)
  const headerPresent = contentType.matchAll(presentOrAbsent).next().value // this is not a normal way to use an iterator

  return {
    contentType,
    isTextCsv,
    headerPresent: (headerPresent ? headerPresent[1] : null)
  }
}

function getLineBreak (line) {
  const eol = line.substring(line.length-2)
  return (eol[0] === '\r') ? '\r\n' : '\n'
} // getLineBreak

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
