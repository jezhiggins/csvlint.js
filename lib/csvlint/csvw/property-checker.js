const metadataError = require('./metadata-error')

function checkProperty(property, value, base_url, lang) {
  if (PROPERTIES[property]) {
    return PROPERTIES[property](value, base_url, lang)
  }

  if (isNamespace(property)) {
    const [ value, warnings ] = checkCommonPropertyValue(value, base_url, lang)
    return [ value, warnings, 'annotation' ]
  }

  // property name must be an absolute URI
  try {
    if (isAbsoluteUri(property)) {
      return [value, 'invalid_property', null]
    }
    const [ value, warnings ] = checkCommonPropertyValue(value, base_url, lang)
    return [ value, warnings, 'annotation' ]
  } catch (e) {
    return [ value, 'invalid_property', null ]
  }
} // checkProperty

function metadataErrorIf(condition, path, msg) {
  if (condition) metadataError(path, msg)
} // metadataErrorIf

function isString (value) {
  return (typeof value === 'string')
} // isString

function isObject (value) {
  return (typeof value === 'object')
} // isObject

const hasNamespace = /^([a-z]+):/
function isNamespace (value) {
  return (hasNamespace.test(value) && NAMESPACES[value.split(":")[0]])
} // isNamespace

function isAbsoluteUri (value) {
  return !!(url.parse(property).protocol)
} // isAbsoluteUri

function isValidLanguage (value) {
  return (!value) || BCP47_LANGUAGE_REGEXP.test(v)
} // isValidLanguage

function asArray (v) {
  return Array.isArray(v) ? v : [v]
}

function checkCommonPropertyValue(value, base_url, lang) {
  if (Array.isArray(value)) {
    const values = []
    const warnings = []
    value.forEach(each_val => {
      const [v, w] = checkCommonPropertyValue(each_val, base_url, lang)
      warnings.push(...w)
      values.push(v)
    })
    return [values, warnings]
  } else if (isString(value)) {
    if (lang === "und")
      return [ value, null ]
    return [ { "@value": value, "@language": lang }, null ]
  } else if (value) {
    const warnings = []
    for (let [p, v] of Object.entries(value)) {
      switch(p) {
        case "@context":
          return metadataError(p, "common property has @context property")
        case "@list":
          return metadataError(p, "common property has @list property")
        case "@set":
          return metadataError(p, "common property has @set property")
        case "@type": {
          if (value["@value"] && BUILT_IN_DATATYPES[v]) {
          } else if (!value["@value"] && BUILT_IN_TYPES[v]) {
          } else if (isNamespace(v)) {
          } else {
            metadataErrorIf(!isAbsoluteUri(v), null, `common property has invalid @type (${v})`)
          }
        }
        break;
        case "@id": {
          if (base_url) {
            try {
              v = (new URL(v, base_url)).href
            } catch (e) {
              metadataError(null, `common property has invalid @id (${v})`)
            }
          }
        }
        break
        case "@value": {
          metadataErrorIf(value["@type"] && value["@language"], null, "common property with @value has both @language and @type")
          const hasOtherKeys = Object.keys(value).filter(k => !["@type", "@language", "@value"].includes(k)).length !== 0
          metadataErrorIf(hasOtherKeys, null, "common property with @value has properties other than @language or @type")
        }
        break
        case "@language": {
          metadataErrorIf(!value["@value"], null, "common property with @language lacks a @value")
          metadataErrorIf(isValidLanguage(v), null, `common property has invalid @language (${v})`)
        }
        break
        default: {
          metadataErrorIf((p[0] === "@"), null, `common property has property other than @id, @type, @value or @language beginning with @ (${p})`)

          const [checkedV, w] = checkCommonPropertyValue(v, base_url, lang)
          warnings.push(...w)
          v = checkedV
        }
      } // switch
      value[p] = v
    } // for ...
    return [ value, warnings ]
  } else {
    return [ value, null ]
  }
} // checkCommonPropertyValue

function convertValueFacet(value, property, datatype) {
  if (!value[property]) return []

  if (DATE_FORMAT_DATATYPES.includes(datatype)) {
    const format = DateFormat(null, datatype)
    const v = format.parse(value[property])
    if (v === null) {
      value.delete(property)
      return [`invalid_${property}`]
    }

    value[property] = v
    return []
  } // Date format

  if (NUMERIC_FORMAT_DATATYPES.includes(datatype)) {
    return []
  } // numeric format

  metadataError(`datatype.${property}`, `${property} is only allowed for numeric, date/time and duration types`)
} // convertValueFacet

function arrayProperty(type) {
  return (value, base_url, lang) => {
    return Array.isArray(value)
      ? [ value, null, type ]
      : [ false, 'invalid_value', type ]
  }
} // arrayProperty

function booleanProperty(type) {
  return (value, base_url, lang) => {
    return (value == true || value == false)
      ? [ value, null, type ]
      : [ false, 'invalid_value', type ]
  }
} // booleanProperty

function stringProperty(type) {
  return (value, base_url, lang) => {
    return isString(value)
      ? [ value, null, type ]
      : [ "", 'invalid_value', type ]
  }
} // stringProperty

function uriTemplateProperty(type) {
  throw new Error ("URITemplate not supported yet")
  //return lambda { |value, base_url, lang|
  //  return URITemplate.new(value), null, type if value.instance_of? String
  //  return URITemplate.new(""), 'invalid_value', type
  //}
} // uriTemplateProperty

function numericProperty(type) {
  return (value, base_url, lang) => {
    return Number.isInteger(value) && (value => 0)
      ? [ value, null, type ]
      : [ null, 'invalid_value', type ]
  }
} // numericProperty

function linkProperty(type) {
  return (value, base_url, lang) => {
    metadataErrorIf(/^_:/.test(value), null, `URL ${value} starts with _:`)

    if (isString(value)) {
      const uri = base_url ? new URL(uri, base_url) : new URL(uri)
      return [uri, null, type]
    }
    return [ base_url, 'invalid_value', type ]
  }
} // linkProperty

function languageProperty(type) {
  return (value, base_url, lang) => {
    return isValidLanguage(value)
      ? [ value, null, type ]
      : [ null, 'invalid_value', type ]
  }
} // languageProperty

function naturalLanguageProperty(type) {
  return (value, base_url, lang) => {
    if (isString(value)) {
      return [{lang: [value]}, null, type]
    }

    if (Array.isArray(value)) {
      const warnings = []
      const valid_titles = []
      value.forEach(title => {
        if (isString(title)) {
          valid_titles.push(title)
        } else {
          warnings.push('invalid_value')
        }
      })
      return [ { lang: valid_titles }, warnings, type ]
    }

    if (value) {
      const titles = {}
      for (const [l,v] of Object.entries(value)) {
        if (isValidLanguage(l)) {
          const valid_titles =
            asArray(v).filter(title => {
              const s = isString(title)
              if (s) warnings.push('invalid_value')
              return s
            })
          titles[l] = valid_titles
        } else {
          warnings.push('invalid_language')
        }
      }
      if (!value) {
        warnings.push('invalid_value')
      }
      return [ titles, warnings, type ]
    }

    return [ {}, 'invalid_value', type ]
  }
} // naturalLanguageProperty

function columnReferenceProperty(type) {
  return (value, base_url, lang) => {
    return [ asArray(value), null, type ]
  }
} // columnReferenceProperty

function noteProperty(value, base_url, lang) {
  if (!Array.isArray(value)) {
    return [ false, 'invalid_value', 'common' ]
  }

  const values = []
  const warnings = []

  for (const v of value) {
    const [v, w] = checkCommonPropertyValue(v, base_url, lang)
    values.push(v)
    warnings.push(...w)
  }
  return [ values, warnings, 'common' ]
} // noteProperty

function dialectProperty(value, base_url, lang) {
  if (!value) return [ {}, 'invalid_value', 'common' ]

  const dialects = { }
  const warnings = []
  for (const [p,v] of Object.entries(value)) {
    if (p === "@id") {
      metadataErrorIf(/^_:/.test(v), "dialect.@id", "@id starts with _:")
    } else if (p === "@type") {
      metadataErrorIf(v !== 'Dialect', "dialect.@type", "@type of dialect is not 'Dialect'")
    } else {
      const [v, warning, type] = checkProperty(p, v, base_url, lang)
      if (type === 'dialect' && warning.length === 0) {
        dialects[p] = v
      } else {
        warnings.push('invalid_property')
      }
      warnings.push(...warning)
    }
  } // for ...
  return [ value, warnings, 'common' ]
} // dialectProperty

function nullProperty(value, base_url, lang) {
  if (isString(value)) {
    return [[value], null, 'inherited']
  }

  if (Array.isArray(value)) {
    const values = value.filter(v => isString(v))
    const warnings = value.filter(v => !isString(v)).map(v => 'invalid_value')
    return [values, warnings, 'inherited']
  }

  return [ [""], 'invalid_value', 'inherited' ]
} // nullProperty

function separatorProperty(value, base_url, lang) {
  return isString(value) || (value === null)
    ? [ value, null, 'inherited' ]
    : [ null, 'invalid_value', 'inherited' ]
} // separatorProperty

function datatypeProperty(value, base_url, lang) {
  let datatype = Object.assign({}, value)
  const warnings = []

  if (BUILT_IN_DATATYPES[value]) {
    datatype = { "@id": BUILT_IN_DATATYPES[value] }
  } else if (isObject(value)) {
    if (value["@id"]) {
      const builtInId = Object.values(BUILT_IN_DATATYPES).includes(value["@id"])
      metadataErrorIf(builtInId,"datatype.@id", `"datatype @id must not be the id of a built-in datatype (${value["@id"]})"`)
      const [ v, w, t ] = PROPERTIES["@id"].call(value["@id"], base_url, lang)
      if (w) {
        warnings.push(w)
        delete datatype["@id"]
      }
    }

    if (value["base"]) {
      if (BUILT_IN_DATATYPES[value["base"]]) {
        datatype["base"] = BUILT_IN_DATATYPES[value["base"]]
      } else {
        value["base"] = BUILT_IN_DATATYPES["string"]
        warnings.push('invalid_datatype_base')
      }
    } else {
      datatype["base"] = BUILT_IN_DATATYPES["string"]
    }
  } else {
    datatype = {"@id": BUILT_IN_DATATYPES["string"]}
    warnings.push('invalid_value')
  }

  if (!STRING_DATATYPES.includes(value["base"]) && !BINARY_DATATYPES.includes(value["base"])) {
    metadataErrorIf(value["length"], "datatype.length", `datatypes based on ${value["base"]} cannot have a length facet`)
    metadataErrorIf(value["minLength"], "datatype.minLength", `datatypes based on ${value["base"]} cannot have a minLength facet`)
    metadataErrorIf(value["maxLength"], "datatype.maxLength", `datatypes based on ${value["base"]} cannot have a maxLength facet`)
  }

  if (value["minimum"]) {
    datatype["minInclusive"] = value["minimum"]
    delete datatype["minimum"]
  }
  if (value["maximum"]) {
    datatype["maxInclusive"] = value["maximum"]
    delete datatype["maximum"]
  }

  for (const p of ["minInclusive", "minExclusive", "maxInclusive", "maxExclusive"]) {
    warnings.push(convertValueFacet(value, p, value["base"]))
  }

  minInclusive = isObject(value["minInclusive"]) ? value["minInclusive"]['dateTime'] : value["minInclusive"]
  maxInclusive = isObject(value["maxInclusive"]) ? value["maxInclusive"]['dateTime'] : value["maxInclusive"]
  minExclusive = isObject(value["minExclusive"]) ? value["minExclusive"]['dateTime'] : value["minExclusive"]
  maxExclusive = isObject(value["maxExclusive"]) ? value["maxExclusive"]['dateTime'] : value["maxExclusive"]

  metadataErrorIf(minInclusive && minExclusive, "", `datatype cannot specify both minimum/minInclusive (${minInclusive}) and minExclusive (${minExclusive}`)
  metadataErrorIf(maxInclusive && maxExclusive, "", `datatype cannot specify both maximum/maxInclusive (${maxInclusive}) and maxExclusive (${maxExclusive}`)
  metadataErrorIf(minInclusive && maxInclusive && minInclusive > maxInclusive,"", `datatype minInclusive (${minInclusive}) cannot be more than maxInclusive (${maxInclusive}`)
  metadataErrorIf(minInclusive && maxExclusive && minInclusive >= maxExclusive, "", `datatype minInclusive (${minInclusive}) cannot be more than or equal to maxExclusive (${maxExclusive}`)
  metadataErrorIf(minExclusive && maxExclusive && minExclusive > maxExclusive, "", `datatype minExclusive (${minExclusive}) cannot be more than or equal to maxExclusive (${maxExclusive}`)
  metadataErrorIf(minExclusive && maxInclusive && minExclusive >= maxInclusive,"", `datatype minExclusive (${minExclusive}) cannot be more than maxInclusive (${maxInclusive}`)

  metadataErrorIf(value["length"] && value["minLength"] && value["length"] < value["minLength"], "", `datatype length (${value["length"]}) cannot be less than minLength (${value["minLength"]}`)
  metadataErrorIf(value["length"] && value["maxLength"] && value["length"] > value["maxLength"], "", `datatype length (${value["length"]}) cannot be more than maxLength (${value["maxLength"]}`)
  metadataErrorIf(value["minLength"] && value["maxLength"] && value["minLength"] > value["maxLength"], "", `datatype minLength (${value["minLength"]}) cannot be more than maxLength (${value["maxLength"]}`)

  if (value["format"]) {
    if (REGEXP_FORMAT_DATATYPES.includes(value["base"])) {
      try {
        datatype["format"] = new RegExp(value["format"])
      } catch (e) {
        delete datetype["format"]
        warnings.push(invalid_regex)
      }
    } else if (NUMERIC_FORMAT_DATATYPES.includes(value["base"])) {
      if (isString(value["format]"])) {
        datatype["format"] = {"pattern": value["format"]}
      }
      try {
        datatype["format"] = NumberFormat(
          value["format"]["pattern"],
          value["format"]["groupChar"],
          value["format"]["decimalChar"] || ".",
          INTEGER_FORMAT_DATATYPES.includes(value["base"])
        )
      } catch (e) {
        datatype["format"] = NumberFormat(
          null,
          value["format"]["groupChar"],
          value["format"]["decimalChar"] || ".",
          INTEGER_FORMAT_DATATYPES.includes(value["base"])
        )
        warnings.push('invalid_number_format')
      }
    } else if (value["base"] === "http://www.w3.org/2001/XMLSchema#boolean") {
      if (isString(value["format"])) {
        datatype["format"] = value["format"].split("|")
        if (datatype["format"].length !== 2) {
          delete datatype["format"]
          warnings.push('invalid_boolean_format')
        }
      } else {
        delete datatype["format"]
        warnings.push('invalid_boolean_format')
      }
    } else if (DATE_FORMAT_DATATYPES.includes(value["base"])) {
      if (isString(value["format"])) {
        try {
          datatype["format"] = DateFormat(value["format"])
        } catch (e) {
          delete datatype["format"]
          warnings.push('invalid_date_format')
        }
      } else {
        delete datatype["format"]
        warnings.push('invalid_date_format')
      }
    }
  }
  return [ datatype, warnings, 'inherited' ]
} // datatypeProperty

function textDirectionProperty (value, base_url, lang) {
  return ['ltr', 'rtl', 'auto', 'inherit'].includes(value)
    ? [ value, null, 'inherited' ]
    : [ 'inherit', 'invalid_value', 'inherited' ]
} // textDirectionProperty

const PROPERTIES = {
  // context properties
  "@language": languageProperty('context'),
  "@base": linkProperty('context'),
  // common properties
  "@id": linkProperty('common'),
  "notes": noteProperty,
  "suppressOutput": booleanProperty('common'),
  "dialect": dialectProperty,
  // inherited properties
  "null": nullProperty,
  "default": stringProperty('inherited'),
  "separator": separatorProperty,
  "lang": languageProperty('inherited'),
  "datatype": datatypeProperty,
  "required": booleanProperty('inherited'),
  "ordered": booleanProperty('inherited'),
  "aboutUrl": uriTemplateProperty('inherited'),
  "propertyUrl": uriTemplateProperty('inherited'),
  "valueUrl": uriTemplateProperty('inherited'),
  "textDirection": textDirectionProperty,
  // column level properties
  "virtual": booleanProperty(:column),
  "titles": naturalLanguageProperty(:column),
          "name": lambda { |value, base_url, lang|
            return value, null, :column if value.instance_of?(String) && value =~ NAME_REGEXP
            return null, 'invalid_value', :column
          },
          // table level properties
          "transformations": lambda { |value, base_url, lang|
            transformations = []
            warnings = []
            if value.instance_of? Array
              value.each_with_index do |transformation,i|
                if transformation.instance_of? Hash
                  transformation = transformation.clone
                  transformation.each do |p,v|
                    if p == "@id"
                      metadataError("transformations[${i}].@id"), "@id starts with _:" if v =~ /^_:/
                    elsif p == "@type"
                      metadataError("transformations[${i}].@type"), "@type of transformation is not 'Template'" if v != 'Template'
                    elsif p == "url"
                    elsif p == "titles"
                    else
                      v, warning, type = check_property(p, v, base_url, lang)
                      unless type == :transformation && (warning.null? || warning.empty?)
                        value.delete(p)
                        warnings << 'invalid_property' unless type == :transformation
                        warnings += Array(warning)
                      end
                    end
                  end
                  transformations << transformation
                else
                  warnings << :invalid_transformation
                end
              end
            else
              warnings << 'invalid_value'
            end
            return transformations, warnings, 'table'
          },
          "tableDirection": lambda { |value, base_url, lang|
            value = value.to_sym
            return value, null, 'table' if [:ltr, :rtl, :auto].include? value
            return :auto, 'invalid_value', 'table'
          },
          "tableSchema": lambda { |value, base_url, lang|
            schema_base_url = base_url
            schema_lang = lang
            if value.instance_of? String
              schema_url = URI.join(base_url, value).to_s
              schema_base_url = schema_url
              schema_ref = schema_url.start_with?("file:") ? File.new(schema_url[5..-1]) : schema_url
              schema = JSON.parse( open(schema_ref).read )
              schema["@id"] = schema["@id"] ? URI.join(schema_url, schema["@id"]).to_s : schema_url
              if schema["@context"]
                if schema["@context"].instance_of?(Array) && schema["@context"].length > 1
                  schema_base_url = schema["@context"][1]["@base"] ? URI.join(schema_base_url, schema["@context"][1]["@base"]).to_s : schema_base_url
                  schema_lang = schema["@context"][1]["@language"] || schema_lang
                end
                schema.delete("@context")
              end
            elsif value.instance_of? Hash
              schema = value.clone
            else
              return {}, 'invalid_value', 'table'
            end
            warnings = []
            schema.each do |p,v|
              if p == "@id"
                metadataError("tableSchema.@id"), "@id starts with _:" if v =~ /^_:/
              elsif p == "@type"
                metadataError("tableSchema.@type"), "@type of schema is not 'Schema'" if v != 'Schema'
              else
                v, warning, type = check_property(p, v, schema_base_url, schema_lang)
                if (type == 'schema' || type == 'inherited') && (warning.null? || warning.empty?)
                  schema[p] = v
                else
                  schema.delete(p)
                  warnings << 'invalid_property' unless (type == 'schema' || type == 'inherited')
                  warnings += Array(warning)
                end
              end
            end
            return schema, warnings, 'table'
          },
          "url": linkProperty('table'),
          // dialect properties
          "commentPrefix": stringProperty('dialect'),
          "delimiter": stringProperty('dialect'),
          "doubleQuote": booleanProperty('dialect'),
          "encoding": lambda { |value, base_url, lang|
            return value, null, 'dialect' if VALID_ENCODINGS.include? value
            return null, 'invalid_value', 'dialect'
          },
          "header": booleanProperty('dialect'),
          "headerRowCount": numericProperty('dialect'),
          "lineTerminators": arrayProperty('dialect'),
          "quoteChar": stringProperty('dialect'),
          "skipBlankRows": booleanProperty('dialect'),
          "skipColumns": numericProperty('dialect'),
          "skipInitialSpace": booleanProperty('dialect'),
          "skipRows": numericProperty('dialect'),
          "trim": lambda { |value, base_url, lang|
            value = :true if value == true || value == "true"
            value = :false if value == false || value == "false"
            value = :start if value == "start"
            value = :end if value == "end"
            return value, null, 'dialect' if [:true, :false, :start, :end].include? value
            return true, 'invalid_value', 'dialect'
          },
          // schema properties
          "columns": lambda { |value, base_url, lang| return value, null, 'schema' },
          "primaryKey": columnReferenceProperty('schema'),
          "foreignKeys": lambda { |value, base_url, lang|
            foreign_keys = []
            warnings = []
            if value.instance_of? Array
              value.each_with_index do |foreign_key,i|
                if foreign_key.instance_of? Hash
                  foreign_key = foreign_key.clone
                  foreign_key.each do |p,v|
                    v, warning, type = check_property(p, v, base_url, lang)
                    if type == :foreign_key && (warning.null? || warning.empty?)
                      foreign_key[p] = v
                    elsif p =~ /:/
                      metadataError("foreignKey.${p}"), "foreignKey includes a prefixed (common) property"
                    else
                      foreign_key.delete(p)
                      warnings << 'invalid_property' unless type == :foreign_key
                      warnings += Array(warning)
                    end
                  end
                  foreign_keys << foreign_key
                else
                  warnings << :invalid_foreign_key
                end
              end
            else
              warnings << 'invalid_value'
            end
            return foreign_keys, warnings, 'schema'
          },
          "rowTitles": columnReferenceProperty('schema'),
          // transformation properties
          "targetFormat": lambda { |value, base_url, lang| return value, null, :transformation },
          "scriptFormat": lambda { |value, base_url, lang| return value, null, :transformation },
          "source": lambda { |value, base_url, lang| return value, null, :transformation },
          // foreignKey properties
          "columnReference": columnReferenceProperty(:foreign_key),
          "reference": lambda { |value, base_url, lang|
            if value.instance_of? Hash
              value = value.clone
              warnings = []
              value.each do |p,v|
                if ["resource", "schemaReference", "columnReference"].include? p
                  v, warning, type = check_property(p, v, base_url, lang)
                  if warning.null? || warning.empty?
                    value[p] = v
                  else
                    value.delete(p)
                    warnings += Array(warning)
                  end
                elsif p =~ /:/
                  metadataError("foreignKey.reference.${p}"), "foreignKey reference includes a prefixed (common) property"
                else
                  value.delete(p)
                  warnings << 'invalid_property'
                end
              end
              metadataError("foreignKey.reference.columnReference"), "foreignKey reference columnReference is missing" unless value["columnReference"]
              metadataError("foreignKey.reference"), "foreignKey reference does not have either resource or schemaReference" unless value["resource"] || value["schemaReference"]
              metadataError("foreignKey.reference"), "foreignKey reference has both resource and schemaReference" if value["resource"] && value["schemaReference"]
              return value, warnings, :foreign_key
            else
              metadataError("foreignKey.reference"), "foreignKey reference is not an object"
            end
          },
          // foreignKey reference properties
          "resource": lambda { |value, base_url, lang| return value, null, :foreign_key_reference },
          "schemaReference": lambda { |value, base_url, lang|
            return URI.join(base_url, value).to_s, null, :foreign_key_reference
          }
        }

const NAMESPACES = {
  "dcat": "http://www.w3.org/ns/dcat#",
  "qb": "http://purl.org/linked-data/cube#",
  "grddl": "http://www.w3.org/2003/g/data-view#",
  "ma": "http://www.w3.org/ns/ma-ont#",
  "org": "http://www.w3.org/ns/org#",
  "owl": "http://www.w3.org/2002/07/owl#",
  "prov": "http://www.w3.org/ns/prov#",
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfa": "http://www.w3.org/ns/rdfa#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "rif": "http://www.w3.org/2007/rif#",
  "rr": "http://www.w3.org/ns/r2rml#",
  "sd": "http://www.w3.org/ns/sparql-service-description#",
  "skos": "http://www.w3.org/2004/02/skos/core#",
  "skosxl": "http://www.w3.org/2008/05/skos-xl#",
  "wdr": "http://www.w3.org/2007/05/powder#",
  "void": "http://rdfs.org/ns/void#",
  "wdrs": "http://www.w3.org/2007/05/powder-s#",
  "xhv": "http://www.w3.org/1999/xhtml/vocab#",
  "xml": "http://www.w3.org/XML/1998/namespace",
  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "csvw": "http://www.w3.org/ns/csvw#",
  "cnt": "http://www.w3.org/2008/content",
  "earl": "http://www.w3.org/ns/earl#",
  "ht": "http://www.w3.org/2006/http#",
  "oa": "http://www.w3.org/ns/oa#",
  "ptr": "http://www.w3.org/2009/pointers#",
  "cc": "http://creativecommons.org/ns#",
  "ctag": "http://commontag.org/ns#",
  "dc": "http://purl.org/dc/terms/",
  "dcterms": "http://purl.org/dc/terms/",
  "dc11": "http://purl.org/dc/elements/1.1/",
  "foaf": "http://xmlns.com/foaf/0.1/",
  "gr": "http://purl.org/goodrelations/v1#",
  "ical": "http://www.w3.org/2002/12/cal/icaltzd#",
  "og": "http://ogp.me/ns#",
  "rev": "http://purl.org/stuff/rev#",
  "sioc": "http://rdfs.org/sioc/ns#",
  "v": "http://rdf.data-vocabulary.org/#",
  "vcard": "http://www.w3.org/2006/vcard/ns#",
  "schema": "http://schema.org/"
}

const BCP47_REGULAR_REGEXP = "(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)"
const BCP47_IRREGULAR_REGEXP = "(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)"
const BCP47_GRANDFATHERED_REGEXP = "(?<grandfathered>" + BCP47_IRREGULAR_REGEXP + "|" + BCP47_REGULAR_REGEXP + ")"
const BCP47_PRIVATE_USE_REGEXP = "(?<privateUse>x(-[A-Za-z0-9]{1,8})+)"
const BCP47_SINGLETON_REGEXP = "[0-9A-WY-Za-wy-z]"
const BCP47_EXTENSION_REGEXP = "(?<extension>" + BCP47_SINGLETON_REGEXP + "(-[A-Za-z0-9]{2,8})+)"
const BCP47_VARIANT_REGEXP = "(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})"
const BCP47_REGION_REGEXP = "(?<region>[A-Za-z]{2}|[0-9]{3})"
const BCP47_SCRIPT_REGEXP = "(?<script>[A-Za-z]{4})"
const BCP47_EXTLANG_REGEXP = "(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2})"
const BCP47_LANGUAGE_REGEXP = "(?<language>([A-Za-z]{2,3}(-" + BCP47_EXTLANG_REGEXP + ")?)|[A-Za-z]{4}|[A-Za-z]{5,8})"
const BCP47_LANGTAG_REGEXP = "(" + BCP47_LANGUAGE_REGEXP + "(-" + BCP47_SCRIPT_REGEXP + ")?" + "(-" + BCP47_REGION_REGEXP + ")?" + "(-" + BCP47_VARIANT_REGEXP + ")*" + "(-" + BCP47_EXTENSION_REGEXP + ")*" + "(-" + BCP47_PRIVATE_USE_REGEXP + ")?" + ")"
const BCP47_LANGUAGETAG_REGEXP = "^(" + BCP47_GRANDFATHERED_REGEXP + "|" + BCP47_LANGTAG_REGEXP + "|" + BCP47_PRIVATE_USE_REGEXP + ")$"
const BCP47_REGEXP = Regexp.new(BCP47_LANGUAGETAG_REGEXP)

const NAME_REGEXP = /^([A-Za-z0-9]|(%[A-F0-9][A-F0-9]))([A-Za-z0-9_]|(%[A-F0-9][A-F0-9]))*$/

const BUILT_IN_TYPES = ["TableGroup", "Table", "Schema", "Column", "Dialect", "Template", "Datatype"]

const REGEXP_FORMAT_DATATYPES = [
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML",
  "http://www.w3.org/ns/csvw#JSON",
  "http://www.w3.org/2001/XMLSchema#anyAtomicType",
  "http://www.w3.org/2001/XMLSchema#anyURI",
  "http://www.w3.org/2001/XMLSchema#base64Binary",
  "http://www.w3.org/2001/XMLSchema#duration",
  "http://www.w3.org/2001/XMLSchema#dayTimeDuration",
  "http://www.w3.org/2001/XMLSchema#yearMonthDuration",
  "http://www.w3.org/2001/XMLSchema#hexBinary",
  "http://www.w3.org/2001/XMLSchema#QName",
  "http://www.w3.org/2001/XMLSchema#string",
  "http://www.w3.org/2001/XMLSchema#normalizedString",
  "http://www.w3.org/2001/XMLSchema#token",
  "http://www.w3.org/2001/XMLSchema#language",
  "http://www.w3.org/2001/XMLSchema#Name",
  "http://www.w3.org/2001/XMLSchema#NMTOKEN"
]

const STRING_DATATYPES = [
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML",
  "http://www.w3.org/ns/csvw#JSON",
  "http://www.w3.org/2001/XMLSchema#string",
  "http://www.w3.org/2001/XMLSchema#normalizedString",
  "http://www.w3.org/2001/XMLSchema#token",
  "http://www.w3.org/2001/XMLSchema#language",
  "http://www.w3.org/2001/XMLSchema#Name",
  "http://www.w3.org/2001/XMLSchema#NMTOKEN"
]

const BINARY_DATATYPES = [
  "http://www.w3.org/2001/XMLSchema#base64Binary",
  "http://www.w3.org/2001/XMLSchema#hexBinary"
]

const INTEGER_FORMAT_DATATYPES = [
  "http://www.w3.org/2001/XMLSchema#integer",
  "http://www.w3.org/2001/XMLSchema#long",
  "http://www.w3.org/2001/XMLSchema#int",
  "http://www.w3.org/2001/XMLSchema#short",
  "http://www.w3.org/2001/XMLSchema#byte",
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger",
  "http://www.w3.org/2001/XMLSchema#positiveInteger",
  "http://www.w3.org/2001/XMLSchema#unsignedLong",
  "http://www.w3.org/2001/XMLSchema#unsignedInt",
  "http://www.w3.org/2001/XMLSchema#unsignedShort",
  "http://www.w3.org/2001/XMLSchema#unsignedByte",
  "http://www.w3.org/2001/XMLSchema#nonPositiveInteger",
  "http://www.w3.org/2001/XMLSchema#negativeInteger"
]

const NUMERIC_FORMAT_DATATYPES = [
  "http://www.w3.org/2001/XMLSchema#decimal",
  "http://www.w3.org/2001/XMLSchema#double",
  "http://www.w3.org/2001/XMLSchema#float"
] + INTEGER_FORMAT_DATATYPES

const DATE_FORMAT_DATATYPES = [
  "http://www.w3.org/2001/XMLSchema#date",
  "http://www.w3.org/2001/XMLSchema#dateTime",
  "http://www.w3.org/2001/XMLSchema#dateTimeStamp",
  "http://www.w3.org/2001/XMLSchema#time"
]

const BUILT_IN_DATATYPES = {
  "number": "http://www.w3.org/2001/XMLSchema#double",
  "binary": "http://www.w3.org/2001/XMLSchema#base64Binary",
  "datetime": "http://www.w3.org/2001/XMLSchema#dateTime",
  "any": "http://www.w3.org/2001/XMLSchema#anyAtomicType",
  "xml": "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral",
  "html": "http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML",
  "json": "http://www.w3.org/ns/csvw#JSON",
  "anyAtomicType": "http://www.w3.org/2001/XMLSchema#anyAtomicType",
  "anyURI": "http://www.w3.org/2001/XMLSchema#anyURI",
  "base64Binary": "http://www.w3.org/2001/XMLSchema#base64Binary",
  "boolean": "http://www.w3.org/2001/XMLSchema#boolean",
  "date": "http://www.w3.org/2001/XMLSchema#date",
  "dateTime": "http://www.w3.org/2001/XMLSchema#dateTime",
  "dateTimeStamp": "http://www.w3.org/2001/XMLSchema#dateTimeStamp",
  "decimal": "http://www.w3.org/2001/XMLSchema#decimal",
  "integer": "http://www.w3.org/2001/XMLSchema#integer",
  "long": "http://www.w3.org/2001/XMLSchema#long",
  "int": "http://www.w3.org/2001/XMLSchema#int",
  "short": "http://www.w3.org/2001/XMLSchema#short",
  "byte": "http://www.w3.org/2001/XMLSchema#byte",
  "nonNegativeInteger": "http://www.w3.org/2001/XMLSchema#nonNegativeInteger",
  "positiveInteger": "http://www.w3.org/2001/XMLSchema#positiveInteger",
  "unsignedLong": "http://www.w3.org/2001/XMLSchema#unsignedLong",
  "unsignedInt": "http://www.w3.org/2001/XMLSchema#unsignedInt",
  "unsignedShort": "http://www.w3.org/2001/XMLSchema#unsignedShort",
  "unsignedByte": "http://www.w3.org/2001/XMLSchema#unsignedByte",
  "nonPositiveInteger": "http://www.w3.org/2001/XMLSchema#nonPositiveInteger",
  "negativeInteger": "http://www.w3.org/2001/XMLSchema#negativeInteger",
  "double": "http://www.w3.org/2001/XMLSchema#double",
  "duration": "http://www.w3.org/2001/XMLSchema#duration",
  "dayTimeDuration": "http://www.w3.org/2001/XMLSchema#dayTimeDuration",
  "yearMonthDuration": "http://www.w3.org/2001/XMLSchema#yearMonthDuration",
  "float": "http://www.w3.org/2001/XMLSchema#float",
  "gDay": "http://www.w3.org/2001/XMLSchema#gDay",
  "gMonth": "http://www.w3.org/2001/XMLSchema#gMonth",
  "gMonthDay": "http://www.w3.org/2001/XMLSchema#gMonthDay",
  "gYear": "http://www.w3.org/2001/XMLSchema#gYear",
  "gYearMonth": "http://www.w3.org/2001/XMLSchema#gYearMonth",
  "hexBinary": "http://www.w3.org/2001/XMLSchema#hexBinary",
  "QName": "http://www.w3.org/2001/XMLSchema#QName",
  "string": "http://www.w3.org/2001/XMLSchema#string",
  "normalizedString": "http://www.w3.org/2001/XMLSchema#normalizedString",
  "token": "http://www.w3.org/2001/XMLSchema#token",
  "language": "http://www.w3.org/2001/XMLSchema#language",
  "Name": "http://www.w3.org/2001/XMLSchema#Name",
  "NMTOKEN": "http://www.w3.org/2001/XMLSchema#NMTOKEN",
  "time": "http://www.w3.org/2001/XMLSchema#time"
}

const VALID_ENCODINGS = [
    "utf-8",
    "ibm866",
    "iso-8859-2",
    "iso-8859-3",
    "iso-8859-4",
    "iso-8859-5",
    "iso-8859-6",
    "iso-8859-7",
    "iso-8859-8",
    "iso-8859-8-i",
    "iso-8859-10",
    "iso-8859-13",
    "iso-8859-14",
    "iso-8859-15",
    "iso-8859-16",
    "koi8-r",
    "koi8-u",
    "macintosh",
    "windows-874",
    "windows-1250",
    "windows-1251",
    "windows-1252",
    "windows-1253",
    "windows-1254",
    "windows-1255",
    "windows-1256",
    "windows-1257",
    "windows-1258",
    "x-mac-cyrillic",
    "gb18030",
    "hz-gb-2312",
    "big5",
    "euc-jp",
    "iso-2022-jp",
    "shift_jis",
    "euc-kr",
    "replacement",
    "utf-16be",
    "utf-16le",
    "x-user-defined"
  ]

module.exports = checkProperty
