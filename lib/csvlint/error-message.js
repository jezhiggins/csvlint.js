class ErrorMessage extends Error {
  constructor(
    type,
    category,
    row,
    column,
    content,
    constraints
  ) {
    super()
    this.name = "CSVList Error"

    this.type_ = type
    this.category_ = category
    this.row_ = row
    this.column_ = column
    this.content_ = content
    this.constraints_ = constraints
  } // constructor

  get type() { return this.type_ }
  get category() { return this.category_ }
  get row() { return this.row_ }
  get column() { return this.column_ }
  get content() { return this.content_ }
  get constraints() { return this.constraints_ }
} // class ErrorMessage

module.exports = ErrorMessage
