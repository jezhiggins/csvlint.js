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
  } // constructor

  get name() { return this.name_ }
  get constraints() { return this.constraints_ }
  get title() { return this.title_ }
  get description() { return this.description_ }

  validateColumn (
    value,
    row = null,
    column = null,
    allErrors = []
  ) {
    this.reset()

    return this.isValid
  } // validateColumn

  reset() { this.errors_.reset() }
  get isValid() { return this.errors_.isValid }
} // class Field

module.exports = Field
