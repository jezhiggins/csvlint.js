/* eslint-env mocha */

const expect = require('chai').expect

const CsvlintCsvwColumn = require('../../lib/csvlint/csvw/column')

describe('Csvlint::Csvw::Column', () => {
  it("shouldn't generate errors for string values", () => {
    const column = CsvlintCsvwColumn(1, 'foo')
    const value = column.validate('bar', 2)
    expect(value).to.eql('bar')
  })

  it("should generate errors for string values that aren't long enough", () => {
    const column = CsvlintCsvwColumn(
      1,
      'foo',
      {
        datatype: {
          base: 'http://www.w3.org/2001/XMLSchema#string',
          minLength: 4
        }
      }
    )
    const value = column.validate('bar', 2)
    expect(value).to.eql({ invalid: 'bar' })
    expect(column.errors.length).to.eql(1)
  })

  it("shouldn't generate errors for string values that are long enough", () => {
    const column = CsvlintCsvwColumn(
      1,
      'foo',
      {
        datatype: {
          base: 'http://www.w3.org/2001/XMLSchema#string',
          minLength: 4
        }
      }
    )
    const value = column.validate('barn', 2)
    expect(value).to.eql('barn')
    expect(column.errors.length).to.eql(0)
  })

  describe('when parsing CSVW column descriptions', () => {
    it('should provide appropriate default values', () => {
      const json = {
        name: 'countryCode'
      }

      const column = CsvlintCsvwColumn.fromJson(1, json)

      expect(column.number).to.eql(1)
      expect(column.name).to.eql('countryCode')
      expect(column.about_url).to.eql(null)
      expect(column.datatype).to.eql({ '@id': 'http://www.w3.org/2001/XMLSchema#string' })
      expect(column.default).to.eql('')
      expect(column.lang).to.eql('und')
      expect(column.null).to.eql([''])
      expect(column.ordered).to.eql(false)
      expect(column.property_url).to.eql(null)
      expect(column.required).to.eql(false)
      expect(column.separator).to.eql(null)
      expect(column.source_number).to.eql(1)
      expect(column.suppress_output).to.eql(false)
      expect(column.text_direction).to.eql('inherit')
      expect(column.titles).to.eql(null)
      expect(column.value_url).to.eql(null)
      expect(column.virtual).to.eql(false)
      expect(column.annotations).to.eql({})
    })

    it('should override default values', () => {
      const json = {
        name: 'countryCode',
        titles: 'countryCode',
        propertyUrl: 'http://www.geonames.org/ontology{#_name}'
      }
      const column = CsvlintCsvwColumn.fromJson(2, json)

      expect(column.number).to.eql(2)
      expect(column.name).to.eql('countryCode')
      expect(column.about_url).to.eql(null)
      expect(column.datatype).to.eql({ '@id': 'http://www.w3.org/2001/XMLSchema#string' })
      expect(column.default).to.eql('')
      expect(column.lang).to.eql('und')
      expect(column.null).to.eql([''])
      expect(column.ordered).to.eql(false)
      expect(column.property_url).to.eql('http://www.geonames.org/ontology{#_name}')
      expect(column.required).to.eql(false)
      expect(column.separator).to.eql(null)
      expect(column.source_number).to.eql(2)
      expect(column.suppress_output).to.eql(false)
      expect(column.text_direction).to.eql('inherit')
      expect(column.titles).to.eqll({ und: ['countryCode'] })
      expect(column.value_url).to.eql(null)
      expect(column.virtual).to.eql(false)
      expect(column.annotations).to.eqll({})
    })

    it('should include the datatype', () => {
      const json = {
        name: 'Id',
        required: true,
        datatype: {
          base: 'string',
          minLength: 3
        }
      }
      const column = CsvlintCsvwColumn.fromJson(1, json)
      expect(column.name).to.eql('Id')
      expect(column.required).to.eql(true)
      expect(column.datatype).to.eqll({ base: 'http://www.w3.org/2001/XMLSchema#string', minLength: 3 })
    })

    it('should generate warnings for invalid null values', () => {
      const json = {
        name: 'countryCode',
        null: true
      }
      const column = CsvlintCsvwColumn.fromJson(1, json)
      expect(column.warnings.length).to.eql(1)
      expect(column.warnings[0].type).to.eql('invalid_value')
    })
  })
})
