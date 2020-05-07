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
  } // constructor

  get name() { return this.name_ }
  get constraints() { return this.constraints_ }
  get title() { return this.title_ }
  get description() { return this.description_ }
} // class Field

module.exports = Field
