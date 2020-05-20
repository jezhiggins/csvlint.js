class Column {
  constructor () {
  }

  validate () { }
} // class Column

module.exports = (...args) => new Column(...args)
module.exports.fromJson = json => { }
