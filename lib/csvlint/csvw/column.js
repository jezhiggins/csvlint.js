const ErrorCollector = require('../error-collector')
const CsvwPropertyChecker = require('./property-checker')
const metadataError = require('./metadata-error')
const ErrorMessage = require('../error-message')

class Column {
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
    this.number = number
    this.name = name
    this.id = id
    this.about_url = about_url
    this.datatype = datatype
    this.default_value = default_value
    this.lang = lang
    this.nulls = nulls
    this.ordered = ordered
    this.property_url = property_url
    this.required = required
    this.separator = separator
    this.source_number = source_number || number
    this.suppress_output = suppress_output
    this.text_direction = text_direction
    this.default_name = default_name
    this.titles = titles
    this.value_url = value_url
    this.virtual = virtual
    this.annotations = annotations

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

  validate () { }

  warning (type, category, content, constraint) {
    this.errors_.buildWarning(type, category, null, null, content, constraint)
  } // error
} // class Column

module.exports = (...args) => new Column(...args)
module.exports.fromJson = Column.fromJson
