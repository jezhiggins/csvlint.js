const ErrorMessage = require('./error-message')

class ErrorCollector {
  constructor () {
    this.reset()
  } // constructor

  get errors() { return this.errors_ }
  get warnings() { return this.warnings_ }
  get infoMessages() { return this.info_messages_ }
  get isValid() { return this.errors_.length === 0}

  buildError(
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.errors_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildError

  buildWarning(
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.warnings_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildWarning

  buildInfoMessage(
    type,
    category = null,
    row = null,
    column = null,
    content = null,
    constraints = {}
  ) {
    this.info_messages_.push(new ErrorMessage(type, category, row, column, content, constraints))
  } // buildError

  reset () {
    this.errors_ = []
    this.warnings_ = []
    this.info_messages_ = []
  } // reset
} // ErrorCollector

module.exports = ErrorCollector
