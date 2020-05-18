/* eslint-env mocha */

const expect = require('chai').expect
const nock = require('nock')
const path = require('path')

const CsvlintValidator = require('../lib/csvlint/validator')

describe('Csvlint::Validator', () => {
  before(() => {
    nock('http://example.com').get('/example.csv').reply(200, '')
    nock('http://example.com').get('/.well-known/csvm').reply(404)
    nock('http://example.com').get('/example.csv-metadata.json').reply(404)
    nock('http://example.com').get('/csv-metadata.json').reply(404)
  })

  it('should validate from a URL', async () => {
    nock('http://example.com')
      .get('/example.csv')
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures', 'valid.csv'),
        { 'Content-Type': 'text/csv' }
      )
    const validator = await CsvlintValidator('http://example.com/example.csv')

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
      // TODO would be beneficial to know how formats functions WRT to headers - check_format.feature:17 returns 3 rows total
      // TODO in its formats object but is provided with 5 rows (with one nil row) [uses validation_warnings_steps.rb]
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
      // cannot make Ruby generate a stray quote error
      // doesn"t build warnings because check_consistency isn"t invoked
      // TODO below is trailing whitespace but is interpreted as a stray quote
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1""'
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      //expect(validator.errors[0].type).to.eql('stray_quote')
      //can't exactly replicate csvlint.rb behaviour here -
      //error is detected, but code is different
      expect(validator.errors[0].type).to.eql('unclosedQuote')
      expect(validator.errors.length).to.eql(1)
    })

    it('parses malformed CSV and catches whitespace and edge case', async () => {
      // when this data gets passed the header it rescues a whitespace error, resulting in the header row being discarded
      // TODO - check if this is an edge case, currently passing because it requires advice on how to specify
      const data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1" '
      const validator = await CsvlintValidator(data)

      expect(validator.isValid).to.eql(false)
      //expect(validator.errors[0].type).to.eql('whitespace')
      //can't exactly replicate csvlint.rb behaviour here -
      //error is detected, but code is different
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
  /*

    describe("csv dialect", () => {
      it("should provide sensible defaults for CSV parsing", () => {
        const validator = await CsvlintValidator("http://example.com/example.csv")
        opts = validator.instance_variable_get("@csv_options")
        expect(opts).to include({
      :col_sep => ",",
      :row_sep => :auto,
      :quote_char => """,
      :skip_blanks => false
      })
      })

      it("should map CSV DDF to correct values", () => {
        const validator = await CsvlintValidator("http://example.com/example.csv")
        opts = validator.dialect_to_csv_options( {
          "lineTerminator" => "\n",
          "delimiter" => "\t",
          "quoteChar" => """
      })
        expect(opts).to.include({
      col_sep: "\t",
      row_sep: "\n",
      quote_char: """,
      skip_blanks: false
      })
      })

      it(".each() -> `validate` to pass input in streaming fashion", () => {
        // warnings are built when validate is used to call all three methods
        data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"3","2","1"})
        const validator = await CsvlintValidator(data)

        expect(validator.isValid).to.eql(true)
        expect(validator.expectedColumns_).to.eql(3)
        expect(validator.colCounts_.length).to.eql(4)
        expect(validator.data.length).to.eql(4)
        expect(validator.info_messages.count).to.eql(1)
      })

      it(".each() -> `validate` parses malformed CSV, populates errors, warnings & info_msgs,invokes finish()", () => {
        data = '"Foo","Bar","Baz"\r\n"1","2","3"\r\n"1","2","3"\r\n"1","two","3"\r\n"3","2",   "1"})

        const validator = await CsvlintValidator(data)

        expect(validator.isValid).to.eql(false)
        expect(validator.expectedColumns_).to.eql(3)
        expect(validator.colCounts_.length).to.eql(4)
        expect(validator.data.length).to.eql(5)
        expect(validator.info_messages.count).to.eql(1)
        expect(validator.errors.length).to.eql(1)
        expect(validator.errors[0].type).to.eql(:whitespace)
        expect(validator.warnings.count).to.eql(1)
        expect(validator.warnings.first.type).to.eql(:inconsistent_values)
      })

      it("File.open.each_line -> `validate` passes a valid csv", () => {
        filename = "valid_many_rows.csv"
        file = File.join(File.expand_path(Dir.pwd), "features", "fixtures", filename)
        const validator = await CsvlintValidator(File.new(file))

        expect(validator.isValid).to.eql(true)
        expect(validator.info_messages.length).to.eql(1)
        expect(validator.info_messages.first.type).to.eql(:assumed_header)
        expect(validator.info_messages.first.category).to.eql(:structure)
      })

    })

    describe("with a single row", () => {

      it("validates correctly", () => {
        stream = "\"a\",\"b\",\"c\"\r\n"
        const validator = await CsvlintValidator(StringIO.new(stream), "header" => false)
        expect(validator.isValid).to.eql(true)
      })

      it("checks for non rfc line breaks", () => {
        stream = "\"a\",\"b\",\"c\"\n"
        const validator = await CsvlintValidator(StringIO.new(stream), {"header" => false})
        expect(validator.isValid).to.eql(true)
        expect(validator.info_messages.count).to eq(1)
        expect(validator.info_messages.first.type).to.eql(:nonrfc_line_breaks)
      })

      it("checks for blank rows", () => {
        data = StringIO.new(""","",")
        const validator = await CsvlintValidator(data, "header" => false)

        expect(validator.isValid).to.eql(false)
        expect(validator.errors.length).to eq(1)
        expect(validator.errors[0].type).to.eql(:blank_rows)
      })

      it("returns the content of the string with the error", () => {
        stream = "\"\",\"\",\"\"\r\n"
        const validator = await CsvlintValidator(StringIO.new(stream), "header" => false)
        expect(validator.errors[0].content).to.eql("\"\",\"\",\"\"\r\n")
      })

      it("should presume a header unless told otherwise", () => {
        stream = "1,2,3\r\n"
        const validator = await CsvlintValidator(StringIO.new(stream))

        expect( validator.isValid ).to.eql(true)
        expect( validator.info_messages.length ).to.eql(1)
        expect( validator.info_messages.first.type).to.eql(:assumed_header)
        expect( validator.info_messages.first.category).to.eql(:structure)
      })

      it("should evaluate the row as "row 2" when stipulated", () => {
        stream = "1,2,3\r\n"
        const validator = await CsvlintValidator(StringIO.new(stream), "header" => false)
        validator.validate
        expect(validator.isValid).to.eql(true)
        expect(validator.info_messages.length).to.eql(0)
      })

    })

    describe("it returns the correct error from ERROR_MATCHES", () => {

      it("checks for unclosed quotes", () => {
        stream = "\"a,\"b\",\"c\"\n"
        const validator = await CsvlintValidator(StringIO.new(stream))
        expect(validator.isValid).to.eql(false)
        expect(validator.errors.length).to eq(1)
        expect(validator.errors[0].type).to.eql(:unclosed_quote)
      })

// TODO stray quotes is not covered in any spec in this library
// it("checks for stray quotes", () => {
//   stream = "\"a\",“b“,\"c\"" "\r\n"
//   const validator = await CsvlintValidator(stream)
//   validator.validate // implicitly invokes parse_contents(stream)
//   expect(validator.isValid).to.eql(false)
//   expect(validator.errors.length).to eq(1)
//   expect(validator.errors[0].type).to.eql(:stray_quote)
// })

      it("checks for whitespace", () => {
        stream = " \"a\",\"b\",\"c\"\r\n"
        const validator = await CsvlintValidator(StringIO.new(stream))

        expect(validator.isValid).to.eql(false)
        expect(validator.errors.length).to eq(1)
        expect(validator.errors[0].type).to.eql(:whitespace)
      })

      it("returns line break errors if incorrectly specified", () => {
        // TODO the logic for catching this error message is very esoteric
        stream = "\"a\",\"b\",\"c\"\n"
        const validator = await CsvlintValidator(StringIO.new(stream), {"lineTerminator" => "\r\n"})
        expect(validator.isValid).to.eql(false)
        expect(validator.errors.length).to eq(1)
        expect(validator.errors[0].type).to.eql(:line_breaks)
      })

    })

    describe("when validating headers", () => {

      it("should warn if column names aren"t unique", () => {
      data = StringIO.new( "minimum, minimum" )
      const validator = await CsvlintValidator(data)
      validator.reset
      expect( validator.validate_header(["minimum", "minimum"]) ).to.eql(true)
      expect( validator.warnings.length ).to.eql(1)
      expect( validator.warnings.first.type).to.eql(:duplicate_column_name)
      expect( validator.warnings.first.category).to.eql(:schema)
    })

    it("should warn if column names are blank", () => {
      data = StringIO.new( "minimum," )
      const validator = await CsvlintValidator(data)

      expect( validator.validate_header(["minimum", ""]) ).to.eql(true)
      expect( validator.warnings.length ).to.eql(1)
      expect( validator.warnings.first.type).to.eql(:empty_column_name)
      expect( validator.warnings.first.category).to.eql(:schema)
    })

    it("should include info message about missing header when we have assumed a header", () => {
      data = StringIO.new( "1,2,3\r\n" )
      const validator = await CsvlintValidator(data)
      expect( validator.isValid ).to.eql(true)
      expect( validator.info_messages.length ).to.eql(1)
      expect( validator.info_messages.first.type).to.eql(:assumed_header)
      expect( validator.info_messages.first.category).to.eql(:structure)
    })

    it("should not include info message about missing header when we are told about the header", () => {
      data = StringIO.new( "1,2,3\r\n" )
      const validator = await CsvlintValidator(data, "header" => false)
      expect( validator.isValid ).to.eql(true)
      expect( validator.info_messages.length ).to.eql(0)
    })
  })

  describe("build_formats", () => {

    {
    :string => "foo",
    :numeric => "1",
    :uri => "http://www.example.com",
    :dateTime_iso8601 => "2013-01-01T13:00:00Z",
    :date_db => "2013-01-01",
    :dateTime_hms => "13:00:00"
    }.each do |type, content|
    it("should return the format of #{type} correctly", () => {
      row = [content]

      const validator = await CsvlintValidator("http://example.com/example.csv")
      validator.build_formats(row)
      formats = validator.instance_variable_get("@formats")

      expect(formats[0].keys.first).to.eql type
    })
  })

  it("treats floats and ints the same", () => {
    row = ["12", "3.1476"]

    const validator = await CsvlintValidator("http://example.com/example.csv")
    validator.build_formats(row)
    formats = validator.instance_variable_get("@formats")

    expect(formats[0].keys.first).to.eql :numeric
    expect(formats[1].keys.first).to.eql :numeric
  })

  it("should ignore blank arrays", () => {
    row = []

    const validator = await CsvlintValidator("http://example.com/example.csv")
    validator.build_formats(row)

    formats = validator.instance_variable_get("@formats")
    expect(formats).to.eql []
  })

  it("should work correctly for single columns", () => {
    rows = [
      ["foo"],
      ["bar"],
      ["baz"]
    ]

    const validator = await CsvlintValidator("http://example.com/example.csv")

    rows.each_with_index do |row, i|
    validator.build_formats(row)
  })

  formats = validator.instance_variable_get("@formats")
  expect(formats).to.eql [{:string => 3}]
})

it("should return formats correctly if a row is blank", () => {
  rows = [
    [],
    ["foo", "1", "$2345"]
  ]

  const validator = await CsvlintValidator("http://example.com/example.csv")

  rows.each_with_index do |row, i|
  validator.build_formats(row)
})

formats = validator.instance_variable_get("@formats")

expect(formats).to.eql [
  {:string => 1},
{:numeric => 1},
{:string => 1},
]
})

})

describe("csv dialect", () => {
  it("should provide sensible defaults for CSV parsing", () => {
    const validator = await CsvlintValidator("http://example.com/example.csv")
    opts = validator.instance_variable_get("@csv_options")
    expect(opts).to include({
  :col_sep => ",",
  :row_sep => :auto,
  :quote_char => """,
  :skip_blanks => false
  })
  })

  it("should map CSV DDF to correct values", () => {
    const validator = await CsvlintValidator("http://example.com/example.csv")
    opts = validator.dialect_to_csv_options({
      "lineTerminator" => "\n",
      "delimiter" => "\t",
      "quoteChar" => """
  })
    expect(opts).to include({
  :col_sep => "\t",
  :row_sep => "\n",
  :quote_char => """,
  :skip_blanks => false
  })
  })

})

describe("check_consistency", () => {

  it("should return a warning if columns have inconsistent values", () => {
    formats = [
      {:string => 3},
    {:string => 2, :numeric => 1},
    {:numeric => 3},
  ]

    const validator = await CsvlintValidator("http://example.com/example.csv")
    validator.instance_variable_set("@formats", formats)
    validator.check_consistency

    warnings = validator.instance_variable_get("@warnings")
    warnings.delete_if { |h| h.type != :inconsistent_values }

    expect(warnings.count).to.eql 1
  })

})

#TODO the below tests are all the remaining tests from validator_spec.rb, annotations indicate their status HOWEVER these tests may be best refactored into client specs
describe("when detecting headers", () => {
  it("should default to expecting a header", () => {
    const validator = await CsvlintValidator("http://example.com/example.csv")
    expect( validator.header? ).to.eql(true)
  })

  it("should look in CSV options to detect header", () => {
    opts = {
      "header" => true
  }
    const validator = await CsvlintValidator("http://example.com/example.csv", opts)
    expect( validator.header? ).to.eql(true)
    opts = {
      "header" => false
  }
    const validator = await CsvlintValidator("http://example.com/example.csv", opts)
    expect( validator.header? ).to.eql(false)
  })

  it("should look in content-type for header=absent", () => {
    stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv; header=absent"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
    const validator = await CsvlintValidator("http://example.com/example.csv")
    expect( validator.header? ).to.eql(false)
    expect( validator.errors.length ).to.eql(0)
  })

  it("should look in content-type for header=present", () => {
    stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv; header=present"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
    const validator = await CsvlintValidator("http://example.com/example.csv")
    expect( validator.header? ).to.eql(true)
    expect( validator.errors.length ).to.eql(0)
  })

  it("assume header present if not specified in content type", () => {
    stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
    const validator = await CsvlintValidator("http://example.com/example.csv")
    expect( validator.header? ).to.eql(true)
    expect( validator.errors.length ).to.eql(0)
    expect( validator.info_messages.length ).to.eql(1)
    expect( validator.info_messages.first.type).to.eql(:assumed_header)
  })

  it("give wrong content type error if content type is wrong", () => {
    stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/html"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
    const validator = await CsvlintValidator("http://example.com/example.csv")
    expect( validator.header? ).to.eql(true)
    expect( validator.errors.length ).to.eql(1)
    expect( validator.errors[0].type).to.eql(:wrong_content_type)
  })

})

describe("when validating headers", () => {
  it("should warn if column names aren"t unique", () => {
  data = StringIO.new( "minimum, minimum" )
  const validator = await CsvlintValidator(data)
  expect( validator.warnings.length ).to.eql(1)
  expect( validator.warnings.first.type).to.eql(:duplicate_column_name)
  expect( validator.warnings.first.category).to.eql(:schema)
})

it("should warn if column names are blank", () => {
  data = StringIO.new( "minimum," )
  const validator = await CsvlintValidator(data)

  expect( validator.validate_header(["minimum", ""]) ).to.eql(true)
  expect( validator.warnings.length ).to.eql(1)
  expect( validator.warnings.first.type).to.eql(:empty_column_name)
  expect( validator.warnings.first.category).to.eql(:schema)
})

it("should include info message about missing header when we have assumed a header", () => {
  data = StringIO.new( "1,2,3\r\n" )
  const validator = await CsvlintValidator(data)

  expect( validator.isValid ).to.eql(true)
  expect( validator.info_messages.length ).to.eql(1)
  expect( validator.info_messages.first.type).to.eql(:assumed_header)
  expect( validator.info_messages.first.category).to.eql(:structure)
})

it("should not include info message about missing header when we are told about the header", () => {
  data = StringIO.new( "1,2,3\r\n" )
  const validator = await CsvlintValidator(data, "header"=>false)
  expect( validator.isValid ).to.eql(true)
  expect( validator.info_messages.length ).to.eql(0)
})

it("should not be an error if we have assumed a header, there is no dialect and content-type doesn"t declare header, as we assume header=present", () => {
stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
const validator = await CsvlintValidator("http://example.com/example.csv")
expect( validator.isValid ).to.eql(true)
})

it("should be valid if we have a dialect and the data is from the web", () => {
  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  #header defaults to true in csv dialect, so this is valid
  const validator = await CsvlintValidator("http://example.com/example.csv", {})
  expect( validator.isValid ).to.eql(true)

  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  const validator = await CsvlintValidator("http://example.com/example.csv", {"header"=>true})
  expect( validator.isValid ).to.eql(true)

  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200, :headers=>{"Content-Type" => "text/csv"}, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  const validator = await CsvlintValidator("http://example.com/example.csv", {"header"=>false})
  expect( validator.isValid ).to.eql(true)
})

})

describe("accessing metadata", () => {

  before :all do
    stub_request(:get, "http://example.com/crlf.csv").to_return(:status => 200, :body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","windows-line-})ings.csv")))
  stub_request(:get, "http://example.com/crlf.csv-metadata.json").to_return(:status => 404)
})

it("can get line break symbol", () => {
  const validator = await CsvlintValidator("http://example.com/crlf.csv")
  expect(validator.line_breaks).to.eql "\r\n"
})

})

it("should give access to the complete CSV data file", () => {
  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200,
:headers=>{"Content-Type" => "text/csv; header=present"},
:body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  const validator = await CsvlintValidator("http://example.com/example.csv")
  expect( validator.isValid ).to.eql(true)
  data = validator.data

  expect( data.count ).to.eql 3
  expect( data[0] ).to.eql ["Foo","Bar","Baz"]
  expect( data[2] ).to.eql ["3","2","1"]
})

it("should count the total number of rows read", () => {
  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200,
:headers=>{"Content-Type" => "text/csv; header=present"},
:body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  const validator = await CsvlintValidator("http://example.com/example.csv")
  expect(validator.row_count).to eq(3)
})

it("should limit number of lines read", () => {
  stub_request(:get, "http://example.com/example.csv").to_return(:status => 200,
:headers=>{"Content-Type" => "text/csv; header=present"},
:body => File.read(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")))
  const validator = await CsvlintValidator("http://example.com/example.csv", {}, nil, limit_lines: 2)
  expect( validator.isValid ).to.eql(true)
  data = validator.data
  expect( data.count ).to.eql 2
  expect( data[0] ).to.eql ["Foo","Bar","Baz"]
})

describe("with a lambda", () => {

  it("should call a lambda for each line", () => {
  @count = 0
    mylambda = lambda { |row| @count = @count + 1 }
    const validator = await CsvlintValidator(File.new(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")), {}, nil, { lambda: mylambda })
    expect(@count).to eq(3)
  })

  it("reports back the status of each line", () => {
  @results = []
    mylambda = lambda { |row| @results << row.current_line }
    const validator = await CsvlintValidator(File.new(File.join(File.dirname(__FILE__),"..","features","fixtures","valid.csv")), {}, nil, { lambda: mylambda })
    expect(@results.count).to eq(3)
    expect(@results[0]).to eq(1)
    expect(@results[1]).to eq(2)
    expect(@results[2]).to eq(3)
  })

})

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
