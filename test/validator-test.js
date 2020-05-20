/* eslint-env mocha */

const expect = require('chai').expect
const nock = require('nock')
const path = require('path')

const CsvlintValidator = require('../lib/csvlint/validator')

const exampleUrlHost = 'http://example.com'
const exampleUrlPath = '/example.csv'

function stubUrl (urlPath = exampleUrlPath, headers = { }) {
  const files = {
    [exampleUrlPath]: 'valid.csv',
    '/crlf.csv': 'windows-line-endings.csv'
  }
  const file = files[urlPath]

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'text/csv'
  }

  nock(exampleUrlHost)
    .get(urlPath)
    .replyWithFile(
      200,
      path.join(__dirname, 'fixtures', file),
      headers
    )
}

function loadFromUrl (urlPath = exampleUrlPath, headers = { }) {
  stubUrl(urlPath, headers)
  return `${exampleUrlHost}${urlPath}`
}

describe('Csvlint::Validator', () => {
  before(() => {
    nock(exampleUrlHost).get('/.well-known/csvm').reply(404)
    nock(exampleUrlHost).get('/example.csv-metadata.json').reply(404)
    nock(exampleUrlHost).get('/csv-metadata.json').reply(404)
  })

  it('should validate from a URL', async () => {
    const validator = await CsvlintValidator(loadFromUrl())

    expect(validator.isValid).to.eql(true)
    expect(validator.data.length).to.eql(3)
    expect(validator.expectedColumns_).to.eql(3)
    expect(validator.colCounts_.length).to.eql(3)
  })

  it('should validate from a file path', async () => {
    const validator = await CsvlintValidator(
      path.join(__dirname, 'fixtures', 'valid.csv')
    )

    expect(validator.isValid).to.eql(true)
    expect(validator.data.length).to.eql(3)
    expect(validator.expectedColumns_).to.eql(3)
    expect(validator.colCounts_.length).to.eql(3)
  })

  it('should validate from a file path including whitespace', async () => {
    const validator = await CsvlintValidator(
      path.join(__dirname, 'fixtures', 'white space in filename.csv')
    )

    expect(validator.isValid).to.eql(true)
  })

  xdescribe('multi line CSV validation with included schema', () => {

  })

  xdescribe('single line row validation with included schema', () => {

  })

  describe('validation with multiple lines: ', () => {
    // TODO multiple lines permits testing of warnings
    // TODO need more assertions in each test IE @formats
    // TODO the phrasing of col_counts if only consulting specs might be confusing
    // TODO ^-> col_counts and data.length should be equivalent, but only data is populated outside of if row.nil?
    // TODO ^- -> and its less the size of col_counts than the homogeneity of its contents which is important

    it('validates a well formed CSV', async () => {
      // when invoking parse contents
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1"'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(true)
      expect(validator.expectedColumns_).to.eql(3)
      expect(validator.colCounts_.length).to.eql(4)
      expect(validator.data.length).to.eql(4)
    })

    it('parses malformed CSV and catches unclosed quote', async () => {
      // doesn"t build warnings because check_consistency isn"t invoked
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('unclosedQuote')
    })

    it('parses malformed CSV and catches stray quote', async () => {
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1""'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      // expect(validator.errors[0].type).to.eql('stray_quote')
      // can't exactly replicate csvlint.rb behaviour here -
      // error is detected, but error code is different
      expect(validator.errors[0].type).to.eql('unclosedQuote')
      expect(validator.errors.length).to.eql(1)
    })

    it('parses malformed CSV and catches whitespace and edge case', async () => {
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1" '
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      // expect(validator.errors[0].type).to.eql('whitespace')
      // can't exactly replicate csvlint.rb behaviour here -
      // error is detected, but error code is different
      expect(validator.errors.length).to.eql(2)
      const errorTypes = validator.errors.map(e => e.type)
      expect(errorTypes).to.contain('trailingCharacters')
      expect(errorTypes).to.contain('unclosedQuote')
    })

    it('handles line breaks within a cell', async () => {
      const data = '"a","b","c"\r\n"d","e","this is\r\nvalid"\r\n"a","b","c"'
      const validator = await CsvlintValidator(data)
      expect(validator.isValid).to.eql(true)
    })

    it('handles multiple line breaks within a cell', async () => {
      const data = '"a","b","c"\r\n"d","this is\r\n valid","as is this\r\n too"'
      const validator = await CsvlintValidator(data)
      expect(validator.isValid).to.eql(true)
    })
  })

  describe('csv dialect', () => {
    it('should provide sensible defaults for CSV parsing', async () => {
      const validator = await CsvlintValidator(loadFromUrl())

      const opts = validator.csvOptions
      expect(opts).to.include({
        col_sep: ',',
        row_sep: 'auto',
        quote_char: '"',
        skip_blanks: false
      })
    })

    it('should map CSV DDF to correct values', async () => {
      const validator = await CsvlintValidator(loadFromUrl())

      const opts = validator.dialectToCsvOptions({
        lineTerminator: '\n',
        delimiter: '\t',
        quoteChar: '"'
      })
      expect(opts).to.include({
        col_sep: '\t',
        row_sep: '\n',
        quote_char: '"',
        skip_blanks: false
      })
    })

    it('`validate` to pass input in streaming fashion', async () => {
      // warnings are built when validate is used to call all three methods
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1"'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(true)
      expect(validator.expectedColumns_).to.eql(3)
      expect(validator.colCounts_.length).to.eql(4)
      expect(validator.data.length).to.eql(4)
      expect(validator.infoMessages.length).to.eql(1)
    })

    it('`validate` parses malformed CSV, populates errors, warnings & info_msgs,invokes finish()', async () => {
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"1","two","3"\r\n"3","2",   "1"'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      expect(validator.expectedColumns_).to.eql(3)
      expect(validator.colCounts_.length).to.eql(4)
      expect(validator.data.length).to.eql(5)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('invalidOpeningQuote') // .rb has whitespace
      expect(validator.warnings.length).to.eql(1)
      expect(validator.warnings[0].type).to.eql('inconsistent_values')
    })

    it('`validate` passes a valid csv', async () => {
      const filename = path.join(__dirname, 'fixtures', 'valid_many_rows.csv')
      const validator = await CsvlintValidator(filename)

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.infoMessages[0].type).to.eql('assumed_header')
      expect(validator.infoMessages[0].category).to.eql('structure')
    })
  })

  describe('with a single row', async () => {
    it('validates correctly', async () => {
      const data = '"a","b","c"\r\n'
      const validator = await CsvlintValidator(data, { header: false })

      expect(validator.isValid).to.eql(true)
    })

    it('checks for non rfc line breaks', async () => {
      const data = '"a","b","c"\n'
      const validator = await CsvlintValidator(data, { header: false })

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.infoMessages[0].type).to.eql('nonrfc_line_breaks')
    })

    it('checks for blank rows', async () => {
      const data = '"","",\r\n'
      const validator = await CsvlintValidator(data, { header: false })

      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('blank_rows')
    })

    it('returns the content of the string with the error', async () => {
      const data = '"","",""\r\n'
      const validator = await CsvlintValidator(data, { header: false })
      expect(validator.errors[0].content).to.eql(data)
    })

    it('should presume a header unless told otherwise', async () => {
      const data = '1,2,3\r\n'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.infoMessages[0].type).to.eql('assumed_header')
      expect(validator.infoMessages[0].category).to.eql('structure')
    })

    it('should evaluate the row as "row 2" when stipulated', async () => {
      const data = '1,2,3\r\n'
      const validator = await CsvlintValidator(data, { header: false })

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(0)
    })
  })

  describe('it returns the correct error from ERROR_MATCHES', async () => {
    it('checks for unclosed quotes', async () => {
      const data = '"a,"b","c"\n'
      const validator = await CsvlintValidator(data)
      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      // expect(validator.errors[0].type).to.eql('unclosed_quote')
      expect(validator.errors[0].type).to.eql('trailingCharacters')
    })

    // TODO stray quotes is not covered in any spec in this library
    it('checks for stray quotes', async () => {
      const data = '"a","b","c" "\r\n'
      const validator = await CsvlintValidator(data)
      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('stray_quote')
    })

    it('checks for whitespace', async () => {
      const data = ' "a","b","c"\r\n'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      // expect(validator.errors[0].type).to.eql('whitespace')
      expect(validator.errors[0].type).to.eql('invalidOpeningQuote')
    })

    it('returns line break errors if incorrectly specified', async () => {
      // TODO the logic for catching this error message is very esoteric
      const data = '"a","b","c"\n'
      const validator = await CsvlintValidator(data, { lineTerminator: '\r\n' })
      expect(validator.isValid).to.eql(false)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('line_breaks')
    })
  })

  describe('when validating headers', () => {
    it("should warn if column names aren't unique", async () => {
      const data = 'minimum,minimum\n'
      const validator = await CsvlintValidator(data)

      expect(validator.warnings.length).to.eql(1)
      expect(validator.warnings[0].type).to.eql('duplicate_column_name')
      expect(validator.warnings[0].category).to.eql('schema')
    })

    it('should warn if column names are blank', async () => {
      const data = 'minimum,\n'
      const validator = await CsvlintValidator(data)

      expect(validator.warnings.length).to.eql(1)
      expect(validator.warnings[0].type).to.eql('empty_column_name')
      expect(validator.warnings[0].category).to.eql('schema')
    })

    it('should include info message about missing header when we have assumed a header', async () => {
      const data = '1,2,3\r\n'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.infoMessages[0].type).to.eql('assumed_header')
      expect(validator.infoMessages[0].category).to.eql('structure')
    })

    it('should not include info message about missing header when we are told about the header', async () => {
      const data = '1,2,3\r\n'
      const validator = await CsvlintValidator(data, { header: false })

      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(0)
    })

    it("should not be an error if we have assumed a header, there is no dialect and content-type doesn't declare header, as we assume header=present", async () => {
      const validator = await CsvlintValidator(loadFromUrl())

      expect(validator.isValid).to.eql(true)
    })

    it('should be valid if we have a dialect and the data is from the web', async () => {
      // header defaults to true in csv dialect, so this is valid
      let validator = await CsvlintValidator(loadFromUrl(), {})
      expect(validator.isValid).to.eql(true)

      validator = await CsvlintValidator(loadFromUrl(), { header: true })
      expect(validator.isValid).to.eql(true)

      validator = await CsvlintValidator(loadFromUrl(), { header: false })
      expect(validator.isValid).to.eql(true)
    })
  })

  describe('build formats', () => {
    const formats = {
      string: 'foo',
      numeric: '1',
      uri: 'http://www.example.com',
      dateTime_iso8601: '2013-01-01T13:00:00Z',
      date_db: '2013-01-01',
      dateTime_hms: '13:00:00'
    }

    for (const [type, content] of Object.entries(formats)) {
      it(`should return the format of ${type} correctly`, async () => {
        const row = [content]

        const validator = await CsvlintValidator(loadFromUrl())
        validator.buildFormats(row)
        const formats = validator.formats_

        expect(formats[0].keys[0]).to.eql(type)
      })
    }

    it('treats floats and ints the same', async () => {
      const row = ['12', '3.1476']

      const validator = await CsvlintValidator(loadFromUrl())
      validator.buildFormats(row)
      const formats = validator.formats_

      expect(formats[0].keys[0]).to.eql('numeric')
      expect(formats[1].keys[0]).to.eql('numeric')
    })

    it('should ignore blank arrays', async () => {
      const row = []

      const validator = await CsvlintValidator(loadFromUrl())
      validator.buildFormats(row)
      const formats = validator.formats_

      expect(formats).to.eql([])
    })

    it('should work correctly for single columns', async () => {
      const rows = [
        ['foo'],
        ['bar'],
        ['baz']
      ]
      const validator = await CsvlintValidator(loadFromUrl())
      for (const row of rows) {
        validator.buildFormats(row)
      }

      const formats = validator.formats_
      expect(formats).to.eql([{ string: 3 }])
    })

    it('should return formats correctly if a row is blank', async () => {
      const rows = [
        [],
        ['foo', '1', '$2345']
      ]
      const validator = await CsvlintValidator(loadFromUrl())
      for (const row of rows) {
        validator.buildFormats(row)
      }

      const formats = validator.formats_

      expect(formats).to.eql([
        { string: 1 },
        { numeric: 1 },
        { string: 1 }
      ])
    })
  })

  describe('check consistency', async () => {
    it('should return a warning if columns have inconsistent values', async () => {
      const formats = [
        { string: 3 },
        { string: 2, numeric: 1 },
        { numeric: 3 }
      ]

      const validator = await CsvlintValidator(loadFromUrl())
      validator.formats_ = formats
      validator.checkConsistency()

      const warnings = validator.warnings
        .filter(w => w.type === 'inconsistent_values')

      expect(warnings.length).to.eql(1)
    })
  })

  describe('when detecting headers', () => {
    it('should default to expecting a header', async () => {
      const validator = await CsvlintValidator(loadFromUrl())

      expect(validator.hasHeader).to.eql(true)
    })

    it('should look in CSV options to detect header', async () => {
      let validator = await CsvlintValidator(loadFromUrl(), { header: true })

      expect(validator.hasHeader).to.eql(true)

      validator = await CsvlintValidator(loadFromUrl(), { header: false })
      expect(validator.hasHeader).to.eql(false)
    })

    it('should look in content-type for header=absent', async () => {
      const validator = await CsvlintValidator(loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/csv; header=absent' }))

      expect(validator.hasHeader).to.eql(false)
      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(0)
    })

    it('should look in content-type for header=present', async () => {
      const validator = await CsvlintValidator(loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/csv; header=present' }))

      expect(validator.hasHeader).to.eql(true)
      expect(validator.isValid).to.eql(true)
      expect(validator.infoMessages.length).to.eql(0)
    })

    it('assume header present if not specified in content type', async () => {
      const validator = await CsvlintValidator(loadFromUrl())

      expect(validator.hasHeader).to.eql(true)
      expect(validator.isValide).to.eql(true)
      expect(validator.infoMessages.length).to.eql(1)
      expect(validator.infoMessages[0].type).to.eql('assumed_header')
    })

    it('give wrong content type error if content type is wrong', async () => {
      const validator = await CsvlintValidator(loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/html' }))

      expect(validator.hasHeader).to.eql(true)
      expect(validator.errors.length).to.eql(1)
      expect(validator.errors[0].type).to.eql('wrong_content_type')
    })
  })

  describe('accessing metadata', () => {
    // before :all do
    //  stub_request(:get, "http://example.com/crlf.csv").to_return(:status => 200, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","windows-line-})ings.csv")))
    // stub_request(:get, "http://example.com/crlf.csv-metadata.json").to_return(:status => 404)

    it('can get line break symbol', async () => {
      const validator = await CsvlintValidator(loadFromUrl('/crlf.csv'))

      expect(validator.lineBreaks).to.eql('\r\n')
    })

    it('should give access to the complete CSV data file', async () => {
      const validator = await CsvlintValidator(
        loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/csv; header=present' })
      )

      expect(validator.isValid).to.eql(true)
      const data = validator.data
      expect(data.length).to.eql(3)
      expect(data[0]).to.eql(['Foo', 'Bar', 'Baz'])
      expect(data[2]).to.eql(['3', '2', '1'])
    })

    it('should count the total number of rows read', async () => {
      const validator = await CsvlintValidator(
        loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/csv; header=present' })
      )

      expect(validator.rowCount).to.eql(3)
    })

    it('should limit number of lines read', async () => {
      const validator = await CsvlintValidator(
        loadFromUrl(exampleUrlPath, { 'Content-Type': 'text/csv; header=present' }),
        {},
        null,
        { limitLines: 2 }
      )

      expect(validator.isValid).to.eql(true)
      const data = validator.data
      expect(data.length).to.eql(2)
      expect(data[0]).to.eql(['Foo', 'Bar', 'Baz'])
    })
  })

  describe('with a lambda', () => {
    it('should call a lambda for each line', async () => {
      let count = 0
      const lambda = row => ++count
      await CsvlintValidator(path.join(__dirname, 'fixtures', 'valid.csv'), {}, null, { lambda })

      expect(count).to.eql(3)
    })

    it('reports back the status of each line', async () => {
      const results = []
      const lambda = (row, currentLine) => results.push(currentLine)
      await CsvlintValidator(path.join(__dirname, 'fixtures', 'valid.csv'), {}, null, { lambda })

      expect(results.length).to.eql(3)
      expect(results[0]).to.eql(1)
      expect(results[1]).to.eql(2)
      expect(results[2]).to.eql(3)
    })
  })

  /*
  // Commented out because there is currently no way to mock redirects with Typhoeus and WebMock - see https://github.com/bblimke/webmock/issues/237
  // it("should follow redirects to SSL", () => {
  //   stub_request(:get, "http://example.com/redirect").to_return(:status => 301, :headers=>{"Location" => "https://example.com/example.csv"})
  //   stub_request(:get, "https://example.com/example.csv").to_return(:status => 200,
  //       :headers=>{"Content-Type" => "text/csv; header=present"},
  //       :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  //
  //   const validator = await CsvlintValidator("http://example.com/redirect")
  //   expect( validator.isValid ).to.eql(true)
  // })
  */
})
