const ErrorMessage = require('./error-message')

class ErrorCollector {
  constructor (initial = null) {
    this.reset()

    if (initial) {
      this.errors_.push(...initial.errors)
      this.warnings_.push(...initial.warnings)
      this.infoMessages_.push(...initial.infoMessages)
    }
  } // constructor

  get errors () { return this.errors_ }
  get warnings () { return this.warnings_ }
  get infoMessages () { return this.infoMessages_ }
  get isValid () { return this.errors_.length === 0 }

  buildError (
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.errors_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildError

  buildWarning (
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.warnings_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildWarning

  buildInfoMessage (
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.infoMessages_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildError

  reset () {
    this.errors_ = []
    this.warnings_ = []
    this.infoMessages_ = []
  } // reset
} // ErrorCollector

module.exports = ErrorCollector
