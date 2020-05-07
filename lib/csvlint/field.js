const ErrorCollector = require('./error-collector')

class Field {
  constructor (
    name,
    constraints = {},
    title = null,
    description = null
  ) {
    this.name_ = name
    this.constraints_ = constraints
    this.title_ = title
    this.description_ = description

    this.uniques_ = new Set()

    this.errors_ = new ErrorCollector()
    this.regexErrorExists_ = false
  } // constructor

  get name() { return this.name_ }
  get constraints() { return this.constraints_ }
  get title() { return this.title_ }
  get description() { return this.description_ }
  get errors() { return this.errors_.errors }
  get warnings() { return this.errors_.warnings }
  get infoMessages() { return this.errors_.infoMessages }

  validateColumn (
    value,
    row = null,
    column = null,
    allErrors = []
  ) {
    this.reset()

    if (!allErrors.some(error =>
      error.type === "invalid_regex" && error.column === column)
    ) {
      this.validateRegex(value, row, column)
    }
    this.validateLength(value, row, column)
    this.validateValues(value, row, column)
    const parsed = this.validateType(value, row, column)

    return this.isValid
  } // validateColumn

  reset() { this.errors_.reset() }
  get isValid() { return this.errors_.isValid }

  validateLength (value, row, column) {
    const { required, minLength, maxLength } = this.constraints

    if (required === true) {
      if (!value || value.length === 0) {
        this.error("missing_value", "schema", row, column, value, { required: true })
      }
    }
    if (minLength) {
      if (!value || value.length < minLength) {
        this.error("min_length", "schema", row, column, value, { minLength: minLength })
      }
    }
    if (maxLength) {
      if (value && value.length > maxLength) {
        this.error("max_length", "schema", row, column, value, { maxLength: maxLength })
      }
    }
  } // validateLength

  validateRegex (value, row, column) {
    const pattern = this.constraints.pattern
    if (!pattern) return

    try {
      const regex = new RegExp(pattern)
      if (value && !regex.test(value)) {
        this.error("pattern", "schema", row, column, value, { pattern: pattern })
      }
    } catch (e) {
      this.regexError(value, row, column, pattern)
    }
  } // validateRegex

  validateValues (value, row, column) {
    if (this.constraints.unique === true) {
      if (this.uniques_.has(value)) {
        this.error("unique", "schema", row, column, value, { unique: true })
      } else {
        this.uniques_.add(value)
      }
    }
  } // validateValues

  validateType (value, row, column) {
    const { type, datePattern } = this.constraints

    if (type && value !== "") {
      const parsed = this.convertToType(value)
      if (parsed !== null && !Number.isNaN(parsed)) {
        return parsed
      }

      const failed = { type: type }
      if (datePattern) failed.datePattern = datePattern
      this.error("invalid_type", "schema", row, column, value, failed)
    }
    return null
  } // validateType

  convertToType (value) {
    const validator = TypeValidators[this.constraints.type]
    if (validator) {
      try {
        return validator(value, this.constraints)
      } catch (e) { }
    }
    return null
  } // convertToType

  error(type, category, row, column, content, constraint) {
    this.errors_.buildError(type, category, row, column, content, constraint)
  } // error

  regexError(value, row, column, pattern) {
    if (this.regexErrorExists_) return
    this.error(
      "invalid_regex",
      "schema",
      null,
      column,
      `${this.name}: Constraints: Pattern: ${pattern}`,
      { pattern: pattern }
    )
    this.regexErrorExists_ = true
  }
} // class Field

function toString (value) { return value }
const isInteger = /^[-+]?\d+$/
function toInteger (value) {
  if (!isInteger.test(value)) throw new TypeError()
  return Number.parseInt(value)
}
const isFloat = /^[-+]?\d+\.?\d+$/
function toFloat (value) {
  if (!isFloat.test(value)) throw new TypeError()
  return Number.parseFloat(value)
}
function toUrl (value) {
  const u = new URL(value)
  if (['http:', 'https:'].includes(u.protocol)) return u
  throw new TypeError()
}
function toBoolean (value) {
  if (['true', '1'].includes(value)) return true
  if (['false', '0'].includes(value)) return false
  throw new TypeError()
}

function constrainedInteger (value, test) {
  const n = toInteger(value)
  if (test(n)) return n
  throw new TypeError()
}
const isNonPositive = value => value <= 0
const isNegative = value => value < 0
const isNonNegative = value => value >= 0
const isPositive = value => value > 0
const toNonPositiveInteger = value => constrainedInteger(value, isNonPositive)
const toNegativeInteger = value => constrainedInteger(value, isNegative)
const toNonNegativeInteger = value => constrainedInteger(value, isNonNegative)
const toPositiveInteger = value => constrainedInteger(value, isPositive)

const TypeValidators = {
  'http://www.w3.org/2001/XMLSchema#string': toString,
  'http://www.w3.org/2001/XMLSchema#int': toInteger,
  'http://www.w3.org/2001/XMLSchema#integer': toInteger,
  'http://www.w3.org/2001/XMLSchema#float': toFloat,
  'http://www.w3.org/2001/XMLSchema#double': toFloat,
  'http://www.w3.org/2001/XMLSchema#anyURI': toUrl,
  'http://www.w3.org/2001/XMLSchema#boolean': toBoolean,
  'http://www.w3.org/2001/XMLSchema#nonPositiveInteger': toNonPositiveInteger,
  'http://www.w3.org/2001/XMLSchema#negativeInteger': toNegativeInteger,
  'http://www.w3.org/2001/XMLSchema#nonNegativeInteger': toNonNegativeInteger,
  'http://www.w3.org/2001/XMLSchema#positiveInteger': toPositiveInteger,
}

module.exports = Field
