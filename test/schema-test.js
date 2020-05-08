/* eslint-env mocha */

const expect = require('chai').expect

const CsvlintField = require('../lib/csvlint/field')
const CsvlintSchema = require('../lib/csvlint/schema')

describe('Csvlint::Schema', () => {

  it('should tolerate missing fields', () => {
    const schema = CsvlintSchema.from_json_table("http://example.org", {})
    expect(schema).to.not.be(null)
    expect(schema.fields.length).to.eql(0)
  })

  it('should tolerate fields with no constraints', () => {
    const schema = CsvlintSchema.from_json_table("http://example.org", {
      "fields": [ { "name": "test" } ]
    })
    expect(schema).to.not.be(null)
    expect(schema.fields[0].name).to.eql("test")
    expect(schema.fields[0].constraints).to.eql({})
  })

  it('should validate against the schema', () => {
    const field = new CsvlintField("test", { "required": true })
    const field2 = new CsvlintField("test", { "minLength": 3 })
    const schema = new CsvlintSchema("http://example.org", [field, field2])

    expect(schema.validateRow(["", "x"])).to.eql(false)
    expect(schema.errors.length).to.eql(2)
    expect(schema.errors[0].type).to.eql('missing_value')
    expect(schema.errors[0].category).to.eql('schema')
    expect(schema.errors[0].column).to.eql(1)
    expect(schema.validateRow(["abc", "1234"])).to.eql(true)
  })

  it('should include validations for missing columns', () => {
    const minimum = new CsvlintField("test", { "minLength": 3 })
    const required = new CsvlintField("test2", { "required": true })

    const minReq = new CsvlintSchema("http://example.org", [minimum, required])
    expect(minReq.validateRow( ["abc", "x"])).to.eql(true)
    expect(minReq.validateRow( ["abc"])).to.eql(false)
    expect(minReq.errors.length).to.eql(1)
    expect(minReq.errors[0].type).to.eql('missing_value')

    const reqMin = new CsvlintSchema("http://example.org", [required, minimum])
    expect(reqMin.validateRow( ["x", "abc"])).to.eql(true)
    expect(reqMin.validateRow( ["abc"])).to.eql(false)
    expect(reqMin.errors.length).to.eql(1)
    expect(reqMin.errors[0].type).to.eql('min_length')
  })

  it('should warn if the data has fewer columns', () => {
    const minimum = new CsvlintField("test", { "minLength": 3 })
    const required = new CsvlintField("test2", { "maxLength": 5 })
    const schema = new CsvlintSchema("http://example.org", [minimum, required])

    expect(schema.validateRow( ["abc"], 1)).to.eql(true)
    expect(schema.warnings.length).to.eql(1)
    expect(schema.warnings[0].type).to.eql('missing_column')
    expect(schema.warnings[0].category).to.eql('schema')
    expect(schema.warnings[0].row).to.eql(1)
    expect(schema.warnings[0].column).to.eql(2)

    // no ragged row error
    expect(schema.errors.length).to.eql(0)
  })

  it('should warn if the data has additional columns', () => {
    const minimum = new CsvlintField("test", { "minLength": 3 })
    const required = new CsvlintField("test2", { "required": true })
    const schema = new CsvlintSchema("http://example.org", [minimum, required])

    expect(schema.validateRow( ["abc", "x", "more", "columns"], 1)).to.eql(true)
    expect(schema.warnings.length).to.eql(2)
    expect(schema.warnings[0].type).to.eql('extra_column')
    expect(schema.warnings[0].category).to.eql('schema')
    expect(schema.warnings[0].row).to.eql(1)
    expect(schema.warnings[0].column).to.eql(3)

    expect(schema.warnings[1].type).to.eql('extra_column')
    expect(schema.warnings[1].column).to.eql(4)

    // no ragged row error
    expect(schema.errors.length).to.eql(0)
  })

  describe('when validating header', () => {
    it('should warn if column names are different to field names', () => {
      const minimum = new CsvlintField("minimum", { "minLength": 3 })
      const required = new CsvlintField("required", { "required": true })
      const schema = new CsvlintSchema("http://example.org", [minimum, required])

      expect(schema.validateHeader(["minimum", "required"])).to.eql(true)
      expect(schema.warnings.length).to.eql(0)

      expect(schema.validateHeader(["wrong", "required"])).to.eql(true)
      expect(schema.warnings.length).to.eql(1)
      expect(schema.warnings[0].row).to.eql(1)
      expect(schema.warnings[0].type).to.eql('malformed_header')
      expect(schema.warnings[0].content).to.eql('wrong,required')
      expect(schema.warnings[0].column).to.eql(null)
      expect(schema.warnings[0].category).to.eql('schema')
      expect(schema.warnings[0].constraints).to.have.property('expectedHeader', 'minimum,required')
      expect(schema.validateHeader(["minimum", "Required"])).to.eql(true)
      expect(schema.warnings.length).to.eql(1)
    })

    it('should warn if column count is less than field count', () => {
      const minimum = new CsvlintField("minimum", { "minLength": 3 })
      const required = new CsvlintField("required", { "required": true })
      const schema = new CsvlintSchema("http://example.org", [minimum, required])

      expect(schema.validateHeader(["minimum"])).to.eql(true)
      expect(schema.warnings.length).to.eql(1)
      expect(schema.warnings[0].row).to.eql(1)
      expect(schema.warnings[0].type).to.eql('malformed_header')
      expect(schema.warnings[0].content).to.eql("minimum")
      expect(schema.warnings[0].column).to.eql(null)
      expect(schema.warnings[0].category).to.eql('schema')
      expect(schema.warnings[0].constraints).to.have.property('expectedHeader', 'minimum,required')
    })

    it('should warn if column count is more than field count', () => {
      const minimum = new CsvlintField("minimum", { "minLength": 3 })
      const schema = new CsvlintSchema("http://example.org", [minimum])

      expect(schema.validateHeader(["wrong", "required"])).to.eql(true)
      expect(schema.warnings.length).to.eql(1)
      expect(schema.warnings[0].row).to.eql(1)
      expect(schema.warnings[0].type).to.eql('malformed_header')
      expect(schema.warnings[0].content).to.eql("wrong,required")
      expect(schema.warnings[0].column).to.eql(null)
      expect(schema.warnings[0].category).to.eql('schema')
      expect(schema.warnings[0].constraints).to.have.property('expectedHeader', 'minimum')
    })
  })

  describe('when parsing JSON Tables', () => {
    const example = `{
  "title": "Schema title",
  "description": "schema",
  "fields": [
  { "name": "ID", "constraints": { "required": true }, "title": "id", "description": "house identifier" },
  { "name": "Price", "constraints": { "required": true, "minLength": 1 } },
  { "name": "Postcode", "constraints": { "required": true, "pattern": "[A-Z]{1,2}[0-9][0-9A-Z]? ?[0-9][A-Z]{2}" } }
]
}
`
    /* EOL
    stub_request(:get, "http://example.com/example.json").to_return(:status => 200, :body => @example)
    })
    */

    it('should create a schema from a pre-parsed JSON table', () => {
      const json = JSON.parse( example)
      const schema = CsvlintSchema.from_json_table("http://example.org", json)

      expect(schema.uri).to.eql("http://example.org")
      expect(schema.title).to.eql("Schema title")
      expect(schema.description).to.eql("schema")
      expect(schema.fields.length).to.eql(3)
      expect(schema.fields[0].name).to.eql("ID")
      expect(schema.fields[0].constraints["required"]).to.eql(true)
      expect(schema.fields[0].title).to.eql("id")
      expect(schema.fields[0].description).to.eql("house identifier")
      expect(schema.fields[2].constraints["pattern"]).to.eql("[A-Z]{1,2}[0-9][0-9A-Z]? ?[0-9][A-Z]{2}")
    })

    it('should create a schema from a JSON Table URL', () => {
      const schema = CsvlintSchema.load_from_uri("http://example.com/example.json")
      expect(schema.uri).to.eql("http://example.com/example.json")
      expect(schema.fields.length).to.eql(3)
      expect(schema.fields[0].name).to.eql("ID")
      expect(schema.fields[0].constraints["required"]).to.eql(true)
    })
  })

  xdescribe('when parsing CSVW metadata', () => {
    const example = `
    {
      "@context": "http://www.w3.org/ns/csvw",
      "url": "http://example.com/example1.csv",
      "tableSchema": {
      "columns": [
        { "name": "Name", "required": true, "datatype": { "base": "string", "format": ".+" } },
        { "name": "Id", "required": true, "datatype": { "base": "string", "minLength": 3 } },
        { "name": "Email", "required": true }
      ]
    }
    }
    `
    //stub_request(:get, "http://example.com/metadata.json").to_return(:status => 200, :body => @example)
    xit('should create a table group from a CSVW metadata URL', () => {
      //const schema = CsvlintSchema.load_from_uri("http://example.com/metadata.json")
      //expect(schema.class).to.eql(Csvlint::Csvw::TableGroup)
    })
  })
})
