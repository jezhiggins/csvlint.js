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

module.exports = Field
