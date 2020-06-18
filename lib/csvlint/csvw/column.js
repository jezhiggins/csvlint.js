const ErrorCollector = require('../error-collector')
const CsvwPropertyChecker = require('./property-checker')
const metadataError = require('./metadata-error')
const ErrorMessage = require('../error-message')
const NumberFormat = require('./number-format')
const DateFormat = require('./date-format')

class Column {
  get id() { return this.id_ }
  get about_url() { return this.about_url_ }
  get datatype() { return this.datatype_ }
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
    const formatType = this.datatype_["format"]
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
    const { base, format } = this.datatype_
    if (!format) return false

    const valid = DATATYPE_FORMAT_VALIDATION[base](value, format)

    if (!valid)
      this.error('format', row, this.number_, value, { format })
    return valid
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

const REGEXP_VALIDATION = (value, format) => format.test(value)

const NO_ADDITIONAL_VALIDATION = (value, format) => true

const DATATYPE_FORMAT_VALIDATION = {
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral": REGEXP_VALIDATION,
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML": REGEXP_VALIDATION,
  "http://www.w3.org/ns/csvw#JSON": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#anyAtomicType": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#anyURI": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#base64Binary": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#boolean": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#date": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#dateTime": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#dateTimeStamp": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#decimal": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#integer": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#long": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#int": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#short": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#byte": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#positiveInteger": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#unsignedLong": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#unsignedInt": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#unsignedShort": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#unsignedByte": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#nonPositiveInteger": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#negativeInteger": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#double": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#duration": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#dayTimeDuration": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#yearMonthDuration": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#float": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#gDay": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#gMonth": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#gMonthDay": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#gYear": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#gYearMonth": NO_ADDITIONAL_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#hexBinary": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#QName": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#string": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#normalizedString": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#token": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#language": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#Name": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#NMTOKEN": REGEXP_VALIDATION,
  "http://www.w3.org/2001/XMLSchema#time": NO_ADDITIONAL_VALIDATION
}

const TRIM_VALUE = (value, format) => { return [value.trim(), null] }
const ALL_VALUES_VALID = (value, format) => { return [value, null] }

function NUMERIC_PARSER(value, format, integer=false) {
  if (format === null) {
    format = NumberFormat(null, null, ".", integer)
  }

  const v = format.parse(value)
  return (v !== null) ? [v, null] : [null, 'invalid_number']
} // NUMERIC_PARSER

function createDateParser(type, warning) {
  return (value, format) => {
    if (format === null) {
      format = DateFormat(null, type)
    }
    const v = format.parse(value)
    return (v !== null) ? [v, null] : [null, warning]
  }
} // createDateParser

function createRegexpBasedParser(regexp, warning) {
  return (value, format) => {
    return (regexp.test(value)) ? [value, null] : [null, warning]
  }
} // createRegexpBasedParser

function BOOLEAN_PARSER(value, format) {
  if (format === null) {
    if (["true", "1"].includes(value)) return [true, null]
    if (["false", "0"].includes(value)) return [false, null]
  } else {
    if (value === format[0]) return [true, null]
    if (value === format[1]) return [false, null]
  }
  return [value, 'invalid_boolean']
} // BOOLEAN_PARSER

function DECIMAL_PARSER(value, format) {
  if (/(E|e|^(NaN|INF|-INF)$)/.test(value))
    return [null, 'invalid_decimal']
  return NUMERIC_PARSER(value, format)
} // DECIMAL_PARSER

function INTEGER_PARSER(value, format) {
  const [v, w] = NUMERIC_PARSER(value, format, true)
  if (w !== null) return [null, 'invalid_integer']
  if (!Number.isInteger(v)) return [null, 'invalid_integer']
  return [v, w]
} // INTEGER_PARSER

function LONG_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_long']
  if (v > 9223372036854775807 || v < -9223372036854775808) return [null, 'invalid_long']
  return [v, w]
} // LONG_PARSER

function INT_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_int']
  if (v > 2147483647 || v < -2147483648) return [null, 'invalid_int']
  return [v, w]
} // INT_PARSER

function SHORT_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_short']
  if (v > 32767 || v < -32768) return [null, 'invalid_short']
  return [v, w]
} // SHORT_PARSER

function BYTE_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_byte']
  if (v > 127 || v < -128) return [null, 'invalid_byte']
  return [v, w]
} // BYTE_PARSER

function NONNEGATIVE_INTEGER_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_nonNegativeInteger']
  if (v < 0) return [null, 'invalid_nonNegativeInteger']
  return [v, w]
} // NONNEGATIVE_INTEGER_PARSER

function POSITIVE_INTEGER_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_positiveInteger']
  if (v <= 0) return [null, 'invalid_positiveInteger']
  return [v, w]
} // POSITIVE_INTEGER_PARSER

function UNSIGNED_LONG_PARSER(value, format) {
  const [v, w] = NONNEGATIVE_INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_unsignedLong']
  if (v > 18446744073709551615) return [null, 'invalid_unsignedLong']
  return [v, w]
} // UNSIGNED_LONG_PARSER

function UNSIGNED_INT_PARSER(value, format) {
  const [v, w] = NONNEGATIVE_INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_unsignedInt']
  if (v > 4294967295) return [null, 'invalid_unsignedInt']
  return [v, w]
} // UNSIGNED_INT_PARSER

function UNSIGNED_SHORT_PARSER(value, format) {
  const [v, w] = NONNEGATIVE_INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_unsignedShort']
  if (v > 65535) return [null, 'invalid_unsignedShort']
  return [v, w]
} // UNSIGNED_SHORT_PARSER

function UNSIGNED_BYTE_PARSER(value, format) {
  const [v, w] = NONNEGATIVE_INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_unsignedByte']
  if (v > 256) return [null, 'invalid_unsignedByte']
  return [v, w]
} // UNSIGNED_BYTE_PARSER

function NONPOSITIVE_INTEGER_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_nonPositiveInteger']
  if (v >= 0) return [null, 'invalid_nonPositiveInteger']
  return [v, w]
} // NONPOSITIVE_INTEGER_PARSER

function NEGATIVE_INTEGER_PARSER(value, format) {
  const [v, w] = INTEGER_PARSER(value, format)
  if (w !== null) return [null, 'invalid_negativeInteger']
  if (v > 0) return [null, 'invalid_negativeInteger']
  return [v, w]
} // NEGATIVE_INTEGER_PARSER

const DATATYPE_PARSER = {
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral": TRIM_VALUE,
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML": TRIM_VALUE,
  "http://www.w3.org/ns/csvw#JSON": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#anyAtomicType": ALL_VALUES_VALID,
  "http://www.w3.org/2001/XMLSchema#anyURI": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#base64Binary": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#boolean": BOOLEAN_PARSER,
"http://www.w3.org/2001/XMLSchema#date":
createDateParser("http://www.w3.org/2001/XMLSchema#date", 'invalid_date'),
"http://www.w3.org/2001/XMLSchema#dateTime":
createDateParser("http://www.w3.org/2001/XMLSchema#dateTime", 'invalid_date_time'),
"http://www.w3.org/2001/XMLSchema#dateTimeStamp":
createDateParser("http://www.w3.org/2001/XMLSchema#dateTimeStamp", 'invalid_date_time_stamp'),
"http://www.w3.org/2001/XMLSchema#decimal": DECIMAL_PARSER,
"http://www.w3.org/2001/XMLSchema#integer": INTEGER_PARSER,
"http://www.w3.org/2001/XMLSchema#long": LONG_PARSER,
"http://www.w3.org/2001/XMLSchema#int": INT_PARSER,
"http://www.w3.org/2001/XMLSchema#short": SHORT_PARSER,
"http://www.w3.org/2001/XMLSchema#byte": BYTE_PARSER,
"http://www.w3.org/2001/XMLSchema#nonNegativeInteger": NONNEGATIVE_INTEGER_PARSER,
"http://www.w3.org/2001/XMLSchema#positiveInteger": POSITIVE_INTEGER_PARSER,
"http://www.w3.org/2001/XMLSchema#unsignedLong": UNSIGNED_LONG_PARSER,
"http://www.w3.org/2001/XMLSchema#unsignedInt": UNSIGNED_INT_PARSER,
"http://www.w3.org/2001/XMLSchema#unsignedShort": UNSIGNED_SHORT_PARSER,
"http://www.w3.org/2001/XMLSchema#unsignedByte": UNSIGNED_BYTE_PARSER,
"http://www.w3.org/2001/XMLSchema#nonPositiveInteger": NONPOSITIVE_INTEGER_PARSER,
"http://www.w3.org/2001/XMLSchema#negativeInteger": NEGATIVE_INTEGER_PARSER,
"http://www.w3.org/2001/XMLSchema#double": NUMERIC_PARSER,
  // regular expressions here taken from XML Schema datatypes spec
"http://www.w3.org/2001/XMLSchema#duration":
createRegexpBasedParser(/-?P((([0-9]+Y([0-9]+M)?([0-9]+D)?|([0-9]+M)([0-9]+D)?|([0-9]+D))(T(([0-9]+H)([0-9]+M)?([0-9]+(\.[0-9]+)?S)?|([0-9]+M)([0-9]+(\.[0-9]+)?S)?|([0-9]+(\.[0-9]+)?S)))?)|(T(([0-9]+H)([0-9]+M)?([0-9]+(\.[0-9]+)?S)?|([0-9]+M)([0-9]+(\.[0-9]+)?S)?|([0-9]+(\.[0-9]+)?S))))/, 'invalid_duration'),
"http://www.w3.org/2001/XMLSchema#dayTimeDuration":
createRegexpBasedParser(/-?P(([0-9]+D(T(([0-9]+H)([0-9]+M)?([0-9]+(\.[0-9]+)?S)?|([0-9]+M)([0-9]+(\.[0-9]+)?S)?|([0-9]+(\.[0-9]+)?S)))?)|(T(([0-9]+H)([0-9]+M)?([0-9]+(\.[0-9]+)?S)?|([0-9]+M)([0-9]+(\.[0-9]+)?S)?|([0-9]+(\.[0-9]+)?S))))/, 'invalid_dayTimeDuration'),
"http://www.w3.org/2001/XMLSchema#yearMonthDuration":
createRegexpBasedParser(/-?P([0-9]+Y([0-9]+M)?|([0-9]+M))/, 'invalid_duration'),
"http://www.w3.org/2001/XMLSchema#float": NUMERIC_PARSER,
  "http://www.w3.org/2001/XMLSchema#gDay":
createDateParser("http://www.w3.org/2001/XMLSchema#gDay", 'invalid_gDay'),
"http://www.w3.org/2001/XMLSchema#gMonth":
createDateParser("http://www.w3.org/2001/XMLSchema#gMonth", 'invalid_gMonth'),
"http://www.w3.org/2001/XMLSchema#gMonthDay":
createDateParser("http://www.w3.org/2001/XMLSchema#gMonthDay", 'invalid_gMonthDay'),
"http://www.w3.org/2001/XMLSchema#gYear":
createDateParser("http://www.w3.org/2001/XMLSchema#gYear", 'invalid_gYear'),
"http://www.w3.org/2001/XMLSchema#gYearMonth":
createDateParser("http://www.w3.org/2001/XMLSchema#gYearMonth", 'invalid_gYearMonth'),
"http://www.w3.org/2001/XMLSchema#hexBinary": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#QName": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#string": ALL_VALUES_VALID,
  "http://www.w3.org/2001/XMLSchema#normalizedString": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#token": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#language": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#Name": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#NMTOKEN": TRIM_VALUE,
  "http://www.w3.org/2001/XMLSchema#time":
createDateParser("http://www.w3.org/2001/XMLSchema#time", 'invalid_time')
}


module.exports = (...args) => new Column(...args)
module.exports.fromJson = Column.fromJson
