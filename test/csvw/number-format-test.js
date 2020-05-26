/* eslint-env mocha */

const expect = require('chai').expect

const CsvlintCsvwNumberFormat = require('../../lib/csvlint/csvw/number-format')

describe('Csvlint::Csvw::NumberFormat', () => {
  describe("parse format", () => {
    it('#,##0.##', () => {
      const format = CsvlintCsvwNumberFormat('#,##0.##')
      expect(format.pattern).to.eql('#,##0.##')
      expect(format.prefix).to.eql('')
      expect(format.numericPart).to.eql('#,##0.##')
      expect(format.suffix).to.eql('')
      expect(format.groupingSeparator).to.eql(',')
      expect(format.decimalSeparator).to.eql('.')
      expect(format.primaryGroupingSize).to.eql(3)
      expect(format.secondaryGroupingSize).to.eql(3)
      expect(format.fractionalGroupingSize).to.eql(0)
    })

    it('###0.#####', () => {
      const format = CsvlintCsvwNumberFormat('###0.#####')
      expect(format.primaryGroupingSize).to.eql(0)
      expect(format.secondaryGroupingSize).to.eql(0)
      expect(format.fractionalGroupingSize).to.eql(0)
    })

    it('###0.0000#', () => {
      const format = CsvlintCsvwNumberFormat('###0.0000#')
      expect(format.primaryGroupingSize).to.eql(0)
      expect(format.secondaryGroupingSize).to.eql(0)
      expect(format.fractionalGroupingSize).to.eql(0)
    })

    it('#,##,###,####', () => {
      const format = CsvlintCsvwNumberFormat('#,##,###,####')
      expect(format.primaryGroupingSize).to.eql(4)
      expect(format.secondaryGroupingSize).to.eql(3)
      expect(format.fractionalGroupingSize).to.eql(0)
    })

    it('#,##0.###,#', () => {
      const format = CsvlintCsvwNumberFormat('#,##0.###,#')
      expect(format.primaryGroupingSize).to.eql(3)
      expect(format.secondaryGroupingSize).to.eql(3)
      expect(format.fractionalGroupingSize).to.eql(3)
    })

    it('#0.###E#0', () => {
      const format = CsvlintCsvwNumberFormat('#0.###E#0')
      expect(format.prefix).to.eql('')
      expect(format.numericPart).to.eql('#0.###E#0')
      expect(format.suffix).to.eql('')
    })
  })

  describe('match number against pattern', () => {
    const testsuite = {
      '##0': {
        pass: ['1', '12', '123', '1234'],
        fail: ['1,234', '123.4']
      },
      '#,#00': {
        pass: ['12', '123', '1,234', '1,234,568'],
        fail: ['1', '1234', '12,34,568', '12,34', '123.4']
      },
      '#,000': {
        pass: ['123', '1,234', '1,234,568'],
        fail: ['1','12','1234', '12,34,568', '12,34', '123.4']
      },
      '#0,000': {
        pass: ['1,234','1,234,568'],
        fail: ['1','12','123','1234','12,34,568','12,34','123.4']
      },
      '#,##,#00': {
        pass: ['12','123','1,234','12,34,568'],
        fail: ['1','1234','1,234,568','12.34','123.4']
      },
      '#0.#': {
        pass: ['1', '12', '12.3', '1234.5'],
        fail: ['12.34','1,234.5']
      },
      '#0.0': {
        pass: ['12.3','1234.5'],
        fail: ['1','12','12.34','1,234.5']
      },
      '#0.0#': {
        pass: ['12.3','12.34'],
        fail: ['1','12','12.345']
      },
      '#0.0#,#': {
        pass: ['12.3','12.34','12.34,5'],
        fail: ['1','12.345','12.34,56','12.34,567','12.34,56,7']
      },
      '#0.###E#0': {
        pass: ['12.3E4','12.3E45','12.34E5'],
        fail: ['1','12.3','12.34']
      }
    }

    for (const [pattern, tests] of Object.entries(testsuite)) {
      describe(pattern, () => {
        const format = CsvlintCsvwNumberFormat(pattern)
        for (const t of ['pass', 'fail']) {
          for (const v of tests[t]) {
            it (`${v} ${t}`, () => {
              expect(format.match(v)).to.eql(t === 'pass')
            })
          }
        }
      })
    }
  })

  describe('parse number using pattern', () => {
    const testsuite = {
      '##0': [
        ['-1', -1],
        ['1', 1],
        ['12', 12],
        ['123', 123],
        ['1234', 1234],
        ['1,234', null],
        ['123.4', null]
      ],
      '#,#00': [
        ['1', null],
        ['12', 12],
        ['123', 123],
        ['1234', null],
        ['1,234', 1234],
        ['1,234,568', 1234568],
        ['12,34,568', null],
        ['12,34', null],
        ['123.4', null]
      ],
      '#,000': [
        ['1', null],
        ['12', null],
        ['123', 123],
        ['1234', null],
        ['1,234', 1234],
        ['1,234,568', 1234568],
        ['12,34,568', null],
        ['12,34', null],
        ['123.4', null]
      ],
      '#0,000': [
        ['1', null],
        ['12', null],
        ['123', null],
        ['1234', null],
        ['1,234', 1234],
        ['1,234,568', 1234568],
        ['12,34,568', null],
        ['12,34', null],
        ['123.4', null]
      ],
      '#,##,#00': [
        ['1', null],
        ['12', 12],
        ['123', 123],
        ['1234', null],
        ['1,234', 1234],
        ['12,345', 12345],
        ['1,234,568', null],
        ['12,34,568', 1234568],
        ['12,34', null],
        ['123.4', null]
      ],
      '#,00,000': [
        ['1', null],
        ['12', null],
        ['123', null],
        ['1234', null],
        ['1,234', null],
        ['12,345', 12345],
        ['1,234,568', null],
        ['1,34,568', 134568],
        ['12,34,568', 1234568],
        ['1,23,45,678', 12345678],
        ['12,34', null],
        ['123.4', null],
      ],
      '0,00,000': [
        ['1', null],
        ['12', null],
        ['123', null],
        ['1234', null],
        ['1,234', null],
        ['12,345', null],
        ['1,234,568', null],
        ['1,34,568', 134568],
        ['12,34,568', 1234568],
        ['1,23,45,678', 12345678],
        ['12,34', null],
        ['123.4', null],
      ],
      '#0.#': [
        ['1', 1.0],
        ['12', 12.0],
        ['12.3', 12.3],
        ['12.34', null],
        ['1234.5', 1234.5],
        ['1,234.5', null],
      ],
      '#0.0': [
        ['1', null],
        ['12', null],
        ['12.3', 12.3],
        ['12.34', null],
        ['1234.5', 1234.5],
        ['1,234.5', null],
      ],
      '#0.0#': [
        ['1', null],
        ['12', null],
        ['12.3', 12.3],
        ['12.34', 12.34],
        ['12.345', null],
      ],
      '#0.0#,#': [
        ['1', null],
        ['12.3', 12.3],
        ['12.34', 12.34],
        ['12.345', null],
        ['12.34,5', 12.345],
        ['12.34,56', null],
        ['12.34,567', null],
        ['12.34,56,7', null],
      ],
      '0.0##,###': [
        ['1', null],
        ['12.3', 12.3],
        ['12.34', 12.34],
        ['12.345', 12.345],
        ['12.3456', null],
        ['12.345,6', 12.3456],
        ['12.34,56', null],
        ['12.345,67', 12.34567],
        ['12.345,678', 12.345678],
        ['12.345,67,8', null],
      ],
      '0.###,###': [
        ['1', 1],
        ['12.3', 12.3],
        ['12.34', 12.34],
        ['12.345', 12.345],
        ['12.3456', null],
        ['12.345,6', 12.3456],
        ['12.34,56', null],
        ['12.345,67', 12.34567],
        ['12.345,678', 12.345678],
        ['12.345,67,8', null],
      ],
      '0.000,###': [
        ['1', null],
        ['12.3', null],
        ['12.34', null],
        ['12.345', 12.345],
        ['12.3456', null],
        ['12.345,6', 12.3456],
        ['12.34,56', null],
        ['12.345,67', 12.34567],
        ['12.345,678', 12.345678],
        ['12.345,67,8', null],
      ],
      '0.000,0#': [
        ['1', null],
        ['12.3', null],
        ['12.34', null],
        ['12.345', null],
        ['12.3456', null],
        ['12.345,6', 12.3456],
        ['12.34,56', null],
        ['12.345,67', 12.34567],
        ['12.345,678', null],
        ['12.345,67,8', null],
      ],
      '0.000,0##': [
        ['1', null],
        ['12.3', null],
        ['12.34', null],
        ['12.345', null],
        ['12.3456', null],
        ['12.345,6', 12.3456],
        ['12.34,56', null],
        ['12.345,67', 12.34567],
        ['12.345,678', 12.345678],
        ['12.345,67,8', null],
      ],
      '0.000,000': [
        ['1', null],
        ['12.3', null],
        ['12.34', null],
        ['12.345', null],
        ['12.3456', null],
        ['12.345,6', null],
        ['12.34,56', null],
        ['12.345,67', null],
        ['12.345,678', 12.345678],
        ['12.345,67,8', null],
      ],
      '#0.###E#0': [
        ['1', null],
        ['12.3', null],
        ['12.34', null],
        ['12.3E4', 12.3E4],
        ['12.3E45', 12.3E45],
        ['12.34E5', 12.34E5],
      ],
      '%000': [
        ['%001', 0.01],
        ['%012', 0.12],
        ['%123', 1.23],
        ['%1234', 12.34],
      ],
      '-0': [
        ['1', null],
        ['-1', -1],
        ['-12', -12]
      ]
    }

    for (const [pattern, tests] of Object.entries(testsuite)) {
      describe(pattern, () => {
        const format = CsvlintCsvwNumberFormat(pattern)
        for (const [input, expected] of tests) {
          it(`'${input}' is ${expected ? 'good' : 'bad'}`, () => {
            expect(format.parse(input)).to.eql(expected)
          })
        }
      })
    }

    describe('no pattern provided', () => {
      it('should parse numbers normally when there is no pattern', () => {
        const format = CsvlintCsvwNumberFormat()
        expect(format.parse('1')).to.eql(1)
        expect(format.parse('-1')).to.eql(-1)
        expect(format.parse('12.3')).to.eql(12.3)
        expect(format.parse('12.34')).to.eql(12.34)
        expect(format.parse('12.3E4')).to.eql(12.3E4)
        expect(format.parse('12.3E45')).to.eql(12.3E45)
        expect(format.parse('12.34E5')).to.eql(12.34E5)
        expect(format.parse('12.34e5')).to.eql(12.34E5)
        expect(format.parse('-12.34')).to.eql(-12.34)
        expect(format.parse('1,234')).to.eql(null)
        expect(format.parse('NaN')).to.be.NaN
        expect(format.parse('INF')).to.eql(Infinity)
        expect(format.parse('-INF')).to.eql(-Infinity)
        expect(format.parse('123456.789F10')).to.eql(null)
      })

      it('should parse numbers including grouping separators when they are specified', () => {
        const format = CsvlintCsvwNumberFormat(null, ',')
        expect(format.parse('1')).to.eql(1)
        expect(format.parse('12.3')).to.eql(12.3)
        expect(format.parse('12.34')).to.eql(12.34)
        expect(format.parse('12.3E4')).to.eql(12.3E4)
        expect(format.parse('12.3E45')).to.eql(12.3E45)
        expect(format.parse('12.34E5')).to.eql(12.34E5)
        expect(format.parse('1,234')).to.eql(1234)
        expect(format.parse('1,234,567')).to.eql(1234567)
        expect(format.parse('1,,234')).to.eql(null)
        expect(format.parse('NaN')).to.be.NaN
        expect(format.parse('INF')).to.eql(Infinity)
        expect(format.parse('-INF')).to.eql(-Infinity)
      })

      it('should parse numbers including decimal separators when they are specified', () => {
        const format = CsvlintCsvwNumberFormat(null, ' ', ',')
        expect(format.parse('1')).to.eql(1)
        expect(format.parse('12,3')).to.eql(12.3)
        expect(format.parse('12,34')).to.eql(12.34)
        expect(format.parse('12,3E4')).to.eql(12.3E4)
        expect(format.parse('12,3E45')).to.eql(12.3E45)
        expect(format.parse('12,34E5')).to.eql(12.34E5)
        expect(format.parse('1 234')).to.eql(1234)
        expect(format.parse('1 234 567')).to.eql(1234567)
        expect(format.parse('1  234')).to.eql(null)
      })
    })
  })
})
