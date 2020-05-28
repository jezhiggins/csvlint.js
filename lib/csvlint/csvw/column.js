const ErrorCollector = require('../error-collector')
const CsvwPropertyChecker = require('./property-checker')
const metadataError = require('./metadata-error')
const ErrorMessage = require('../error-message')

class Column {
  get id() { return this.id_ }
  get about_url() { return this.about_url_ }
  get datetype() { return this.datatype_ }
  get default_value() { return this.default_value_ }
  get lang() { return this.lang_ }
  get name() { return this.name_ }
  get nulls() { return this.nulls_ }
  get number() { return this.number_ }
  get ordered() { return this.ordered_ }
  get property_url() { return this.property_url_ }
  get required() { return this.required_ }
  get separator() { return this.separator_ }
  get source_number() { return this.source_number_ }
  get suppress_output() { return this.suppress_output_ }
  get text_direction() { return this.text_direction_ }
  get default_name() { return this.default_name_ }
  get titles() { return this.titles_ }
  get value_url() { return this.value_url_ }
  get virtual() { return this.virtual_ }
  get annotations() { return this.annotations_ }

  constructor (
    number,
    name,
    {
      id = null,
      about_url = null,
      datatype = { '@id': 'http://www.w3.org/2001/XMLSchema#string' },
      default_value = '',
      lang = 'und',
      nulls = [''],
      ordered = false,
      property_url = null,
      required = false,
      separator = null,
      source_number = null,
      suppress_output = false,
      text_direction = 'inherit',
      default_name = null,
      titles = {},
      value_url = null,
      virtual = false,
      annotations = {},
      warnings = []
    } = {}
  ) {
    this.number_ = number
    this.name_ = name
    this.id_ = id
    this.about_url_ = about_url
    this.datatype_ = datatype
    this.default_value_ = default_value
    this.lang_ = lang
    this.nulls_ = nulls
    this.ordered_ = ordered
    this.property_url_ = property_url
    this.required_ = required
    this.separator_ = separator
    this.source_number_ = source_number || number
    this.suppress_output_ = suppress_output
    this.text_direction_ = text_direction
    this.default_name_ = default_name
    this.titles_ = titles
    this.value_url_ = value_url
    this.virtual_ = virtual
    this.annotations_ = annotations

    this.errors_ = new ErrorCollector()
    this.errors_.warnings.push(...warnings)
  } // constructor

  get warnings () { return this.errors_.warnings }

  static fromJson (number, column_desc, base_url = null, lang = 'und', inherited_properties = {}) {
    const annotations = {}
    const warnings = []
    const column_properties = {}
    inherited_properties = Object.assign({}, inherited_properties)

    const addWarning = (type, category, content, constraint) => {
      warnings.push(new ErrorMessage(type, category, null, null, content, constraint))
    } // warning

    for (const [property, value] of Object.entries(column_desc)) {
      if (property === '@type') {
        if (value !== 'Column') {
          metadataError(`columns[${number}].@type`, "@type of column is not 'Column'")
        }
      } else {
        const [v, warning, type] = CsvwPropertyChecker(property, value, base_url, lang)
        warning.forEach(w => addWarning(w, 'metadata', `${property}: ${value}`))

        if (type === 'annotation') annotations[property] = v
        else if (type === 'common' || type === 'column') column_properties[property] = v
        else if (type === 'inherited') inherited_properties[property] = v
        else addWarning('invalid_property', 'metadata', `column: ${property}`, null)
      }
    } // for ...

    return new Column(
      number,
      column_properties.name,
      {
        id: column_properties['@id'],
        datatype: inherited_properties.datatype || { '@id': 'http://www.w3.org/2001/XMLSchema#string' },
        lang: inherited_properties.lang || 'und',
        nulls: inherited_properties.null || [''],
        default_values: inherited_properties.default || '',
        about_url: inherited_properties.aboutUrl,
        property_url: inherited_properties.propertyUrl,
        value_url: inherited_properties.valueUrl,
        required: inherited_properties.required || false,
        separator: inherited_properties.separator,
        ordered: inherited_properties.ordered || false,
        default_name: column_properties.titles && column_properties.titles[lang] ? column_properties.titles[lang][0] : null,
        titles: column_properties.titles || null,
        suppress_output: column_properties.suppressOutput ? column_properties.suppressOutput : false,
        virtual: column_properties.virtual || false,
        annotations: annotations,
        warnings: warnings
      }
    )
  } // fromJson

  validate (stringValue = null, row = null) {
    stringValue = stringValue || this.default_value_
    if (this.nulls.includes(stringValue)) {
      this.validateRequired(null, row)
      return null
    }

    const stringValues = this.separator_
      ? stringValue.split(this.separator_)
      : [ stringValue ]

    const baseType = this.datatype_["base"]
    const idType = this.datatype_["@id"]
    const dataTypeParser = DATATYPE_PARSER[baseType || idType]
    const formatType = this.datetype_["format"]
    const parseString = s => dataTypeParser(s, formatType)

    const values = []
    for (const s of stringValues) {
      const [value, warning] = parseString(s)
      if (!warning) {
        this.validateRequired(value, row)

        const valid = this.validateFormat(value, row) &&
          this.validateLength(value, row) &&
          this.validateValue(value, row)
        values.push(valid ? value :  { invalid: s })
      } else {
        this.errors(warning, row, this.number_, s, this.datatype_)
        values.push({ invalid: s })
      }
    } // for ...

    return this.separator_
      ? values
      : values[0]
  } // validate

  validateRequired (value, row) {
    if (this.required_ && value === null) {
      this.error('required', row, this.number_, value, { required: this.required_ })
      return false
    }
    return true
  } // validateRequired

  validateFormat (value, row) {
  } // validateFormat

  validateLength (value, row) {
  } // validateLength

  validateValue (value, row) {
  } // validateValue

  warning (type, category, content, constraint) {
    this.errors_.buildWarning(type, category, null, null, content, constraint)
  } // warning

  error (type, row, column, content, constraint) {
    this.errors_.buildError(type, 'schema', row, column, content, constraint)
  } // error
} // class Column

module.exports = (...args) => new Column(...args)
module.exports.fromJson = Column.fromJson
