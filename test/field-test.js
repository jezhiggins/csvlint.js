/* eslint-env mocha */

const expect = require('chai').expect

const CsvlintField = require('../lib/csvlint/field')

describe('Csvlint::Field', () => {
  it('should validate required fields', () => {
    const field = new CsvlintField('test', { required: true })
    expect(field.validate_column(null)).to.eql(false)
    expect(field.errors.first.category).to.eql('schema')
    expect(field.validate_column('')).to.eql(false)
    expect(field.validate_column('data')).to.eql(true)
  })

  it('should include the failed constraints', () => {
    const field = new CsvlintField('test', { required: true })
    expect(field.validate_column(null)).to.eql(false)
    expect(field.errors.first.constraints).to.eql({ required: true })
  })

  it('should validate minimum length', () => {
    const field = new CsvlintField('test', { minLength: 3 })
    expect(field.validate_column(null)).to.eql(false)
    expect(field.validate_column('')).to.eql(false)
    expect(field.validate_column('ab')).to.eql(false)
    expect(field.validate_column('abc')).to.eql(true)
    expect(field.validate_column('abcd')).to.eql(true)
  })

  it('should validate maximum length', () => {
    const field = new CsvlintField('test', { maxLength: 3 })
    expect(field.validate_column(null)).to.eql(true)
    expect(field.validate_column('')).to.eql(true)
    expect(field.validate_column('ab')).to.eql(true)
    expect(field.validate_column('abc')).to.eql(true)
    expect(field.validate_column('abcd')).to.eql(false)
  })

  it('should validate against regex', () => {
    const field = new CsvlintField('test', { pattern: '\\{[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\\}' })
    expect(field.validate_column('abc')).to.eql(false)
    expect(field.validate_column('{3B0DA29C-C89A-4FAA-918A-0000074FA0E0}')).to.eql(true)
  })

  it('should apply combinations of constraints', () => {
    const field = new CsvlintField('test', {
      required: true,
      pattern: '\\{[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\\}'
    })
    expect(field.validate_column('abc')).to.eql(false)
    expect(field.errors.first.constraints).to.eql({ pattern: '\\{[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\\}' })

    expect(field.validate_column(null)).to.eql(false)
    expect(field.errors.first.constraints).to.eql({ required: true })

    expect(field.validate_column('{3B0DA29C-C89A-4FAA-918A-0000074FA0E0}')).to.eql(true)
  })

  it('should enforce uniqueness for a column', () => {
    const field = new CsvlintField('test', { unique: true })
    expect(field.validate_column('abc')).to.eql(true)
    expect(field.validate_column('abc')).to.eql(false)
    expect(field.errors.first.category).to.eql('schema')
    expect(field.errors.first.type).to.eql('unique')
  })

  describe('it(should validate correct types', () => {
    it('skips empty fields', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#int' })
      expect(field.validate_column('')).to.eql(true)
    })

    it('validates strings', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#string' })
      expect(field.validate_column('42')).to.eql(true)
      expect(field.validate_column('forty-two')).to.eql(true)
    })

    it('validates ints', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#int' })
      expect(field.validate_column('42')).to.eql(true)
      expect(field.validate_column('forty-two')).to.eql(false)
    })

    it('validates integers', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#integer' })
      expect(field.validate_column('42')).to.eql(true)
      expect(field.validate_column('forty-two')).to.eql(false)
    })

    it('validates floats', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#float' })
      expect(field.validate_column('42.0')).to.eql(true)
      expect(field.validate_column('42')).to.eql(true)
      expect(field.validate_column('forty-two')).to.eql(false)
    })

    it('validates URIs', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#anyURI' })
      expect(field.validate_column('http://theodi.org/team')).to.eql(true)
      expect(field.validate_column('https://theodi.org/team')).to.eql(true)
      expect(field.validate_column('42.0')).to.eql(false)
    })

    it('works with invalid URIs', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#anyURI' })
      expect(field.validate_column('£123')).to.eql(false)
    })

    it('validates booleans', () => {
      const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#boolean' })
      expect(field.validate_column('true')).to.eql(true)
      expect(field.validate_column('1')).to.eql(true)
      expect(field.validate_column('false')).to.eql(true)
      expect(field.validate_column('0')).to.eql(true)
      expect(field.validate_column('derp')).to.eql(false)
    })

    describe('it(should validate all kinds of integers', () => {
      it('validates a non-positive integer', () => {
        const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#nonPositiveInteger' })
        expect(field.validate_column('0')).to.eql(true)
        expect(field.validate_column('-1')).to.eql(true)
        expect(field.validate_column('1')).to.eql(false)
      })

      it('validates a negative integer', () => {
        const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#negativeInteger' })
        expect(field.validate_column('0')).to.eql(false)
        expect(field.validate_column('-1')).to.eql(true)
        expect(field.validate_column('1')).to.eql(false)
      })

      it('validates a non-negative integer', () => {
        const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' })
        expect(field.validate_column('0')).to.eql(true)
        expect(field.validate_column('-1')).to.eql(false)
        expect(field.validate_column('1')).to.eql(true)
      })

      it('validates a positive integer', () => {
        const field = new CsvlintField('test', { type: 'http://www.w3.org/2001/XMLSchema#positiveInteger' })
        expect(field.validate_column('0')).to.eql(false)
        expect(field.validate_column('-1')).to.eql(false)
        expect(field.errors.first.constraints).to.eql({ type: 'http://www.w3.org/2001/XMLSchema#positiveInteger' })
        expect(field.validate_column('1')).to.eql(true)
      })
    })

    describe('when validating ranges', () => {
      it('should enforce minimum values', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#int',
          minimum: '40'
        })
        expect(field.validate_column('42')).to.eql(true)
        expect(field.validate_column('39')).to.eql(false)
        expect(field.errors.first.type).to.eql('below_minimum')
      })

      it('should enforce maximum values', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#int',
          maximum: '40'
        })
        expect(field.validate_column('39')).to.eql(true)
        expect(field.validate_column('41')).to.eql(false)
        expect(field.errors.first.type).to.eql('above_maximum')
      })
    })

    describe('when validating dates', () => {
      it('should validate a date time', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#dateTime'
        })
        expect(field.validate_column('2014-02-17T11:09:00Z')).to.eql(true)
        expect(field.validate_column('invalid-date')).to.eql(false)
        expect(field.validate_column('2014-02-17')).to.eql(false)
      })
      it('should validate a date', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#date'
        })
        expect(field.validate_column('2014-02-17T11:09:00Z')).to.eql(false)
        expect(field.validate_column('invalid-date')).to.eql(false)
        expect(field.validate_column('2014-02-17')).to.eql(true)
      })
      it('should validate a time', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#time'
        })
        expect(field.validate_column('11:09:00')).to.eql(true)
        expect(field.validate_column('2014-02-17T11:09:00Z')).to.eql(false)
        expect(field.validate_column('not-a-time')).to.eql(false)
        expect(field.validate_column('27:97:00')).to.eql(false)
      })
      it('should validate a year', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#gYear'
        })
        expect(field.validate_column('1999')).to.eql(true)
        expect(field.validate_column('2525')).to.eql(true)
        expect(field.validate_column('0001')).to.eql(true)
        expect(field.validate_column('2014-02-17T11:09:00Z')).to.eql(false)
        expect(field.validate_column('not-a-time')).to.eql(false)
        expect(field.validate_column('27:97:00')).to.eql(false)
      })
      it('should validate a year-month', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#gYearMonth'
        })
        expect(field.validate_column('1999-12')).to.eql(true)
        expect(field.validate_column('2525-01')).to.eql(true)
        expect(field.validate_column('2014-02-17T11:09:00Z')).to.eql(false)
        expect(field.validate_column('not-a-time')).to.eql(false)
        expect(field.validate_column('27:97:00')).to.eql(false)
      })
      it('should allow user to specify custom date time pattern', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#dateTime',
          datePattern: '%Y-%m-%d %H:%M:%S'
        })
        expect(field.validate_column('1999-12-01 10:00:00')).to.eql(true)
        expect(field.validate_column('invalid-date')).to.eql(false)
        expect(field.validate_column('2014-02-17')).to.eql(false)
        expect(field.errors.first.constraints).to.eql({
          type: 'http://www.w3.org/2001/XMLSchema#dateTime',
          datePattern: '%Y-%m-%d %H:%M:%S'
        })
      })
      it('should allow user to compare dates', () => {
        const field = new CsvlintField('test', {
          type: 'http://www.w3.org/2001/XMLSchema#dateTime',
          datePattern: '%Y-%m-%d %H:%M:%S',
          minimum: '1990-01-01 10:00:00'
        })
        expect(field.validate_column('1999-12-01 10:00:00')).to.eql(true)
        expect(field.validate_column('1989-12-01 10:00:00')).to.eql(false)
      })
    })
  })
})
