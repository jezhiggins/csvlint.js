const XRegExp = require('xregexp')

class DateFormat {
  get pattern() { return this.pattern_ }

  constructor (pattern, datatype = null) {
    this.pattern_ = pattern

    if (this.pattern_=== null) {
      this.regexp_ = DEFAULT_REGEXP[datatype]
      this.type_ = datatype
    } else {
      /*
      test_pattern = pattern.clone
      test_pattern.gsub!(/S+/, "")
      FIELDS.keys.sort_by{|f| -f.length}.each do |field|
        test_pattern.gsub!(field, "")
      end
      raise Csvw::DateFormatError, "unrecognised date field symbols in date format" if test_pattern =~ /[GyYuUrQqMLlwWdDFgEecahHKkjJmsSAzZOvVXx]/
      */
      this.regexp_ = DATE_PATTERN_REGEXP[this.pattern_]
      this.type_ = this.regexp_=== null ? "http://www.w3.org/2001/XMLSchema#time" : "http://www.w3.org/2001/XMLSchema#date"
      this.regexp_ = this.regexp_ || TIME_PATTERN_REGEXP[this.pattern_]
      this.type_ = this.regexp_=== null ? "http://www.w3.org/2001/XMLSchema#dateTime" : this.type_
      this.regexp_ = this.regexp_ || DATE_TIME_PATTERN_REGEXP[this.pattern_]

      if (this.regexp_=== null) {
        /*
        regexp = this.pattern_

        this.type_ = "http://www.w3.org/2001/XMLSchema#date" if !(regexp =~ /HH/) && regexp =~ /yyyy/
        this.type_ = "http://www.w3.org/2001/XMLSchema#time" if regexp =~ /HH/ && !(regexp =~ /yyyy/)
        this.type_ = "http://www.w3.org/2001/XMLSchema#dateTime" if regexp =~ /HH/ && regexp =~ /yyyy/

        regexp = regexp.sub("HH", FIELDS["HH"].to_s)
        regexp = regexp.sub("mm", FIELDS["mm"].to_s)
        if this.pattern_ =~ /ss\.S+/
          max_fractional_seconds = this.pattern_.split(".")[-1].length
          regexp = regexp.sub(/ss\.S+$/, "(?<second>#{FIELDS["ss"]}(\.[0-9]{1,#{max_fractional_seconds}})?)")
        else
          regexp = regexp.sub("ss", "(?<second>#{FIELDS["ss"]})")
        end

        if regexp =~ /yyyy/
          regexp = regexp.sub("yyyy", FIELDS["yyyy"].to_s)
          regexp = regexp.sub("MM", FIELDS["MM"].to_s)
          regexp = regexp.sub("M", FIELDS["M"].to_s)
          regexp = regexp.sub("dd", FIELDS["dd"].to_s)
          regexp = regexp.sub(/d(?=[-T \/\.])/, FIELDS["d"].to_s)
        end

        regexp = regexp.sub("XXX", FIELDS["XXX"].to_s)
        regexp = regexp.sub("XX", FIELDS["XX"].to_s)
        regexp = regexp.sub("X", FIELDS["X"].to_s)
        regexp = regexp.sub("xxx", FIELDS["xxx"].to_s)
        regexp = regexp.sub("xx", FIELDS["xx"].to_s)
        regexp = regexp.sub(/x(?!:)/, FIELDS["x"].to_s)

        this.regexp_ = Regexp.new("^#{regexp}$")
       */
      }
    }
  } // constructor

  match (value) {
    return this.regexp_.test(value)
  } // match

  parse (input) {
    const match = XRegExp.exec(input, this.regexp_)
    if (match === null) {
      return null
    }

    const value = {}
    for (const field of this.regexp_.xregexp.captureNames) {
      if (field === null || match[field] === null) continue

      switch (field) {
        case "timezone": {
          let tz = match.timezone
          if (tz === 'Z') tz = "+00:00"
          if (tz.length === 3) tz += ':00'
          if (!/:/.test(tz)) tz = `${tz.substring(0, 3)}:${tz.substring(3)}`
          value.timezone = tz
        }
          break
        case "second": {
          value.second = Number.parseFloat(match.second)
        }
          break;
        default:
          value[field] = Number.parseInt(match[field])
      }
    }

    switch (this.type_) {
      case "http://www.w3.org/2001/XMLSchema#date": {
        try {
          value.dateTime = new Date(
            Number.parseInt(match["year"]),
            Number.parseInt(match["month"]) - 1,
            Number.parseInt(match["day"])
          )
        } catch (e) {
          return null
        }
      }
        break;
      case "http://www.w3.org/2001/XMLSchema#dateTime": {
        try {
          value.dateTime = new Date(
            Number.parseInt(match["year"]),
            Number.parseInt(match["month"]),
            Number.parseInt(match["day"]),
            Number.parseInt(match["hour"]),
            Number.parseInt(match["minute"]),
            match["second"] ? Number.parseFloat(match["second"]) : 0,
            match["timezone"] && Number.parseInt(match["timezone"]) ? match["timezone"] : ''
          )
        } catch (e) {
          return null
        }
      }
        break
      default:
        value.dateTime = new Date(
          value.year || 0,
          value.month || 1,
          value.day || 1,
          value.hour || 0,
          value.minute || 0,
          value.second || 0,
          value.timezone || "+00:00"
        )
    }

    if (value.year) {
      if (value.month) {
        if (value.day) {
          if (value.hour) {
            // dateTime
            value.string = `${year(value)}-${month(value)}-${day(value)}T${hour(value)}:${minute(value, 0)}:${second(value)}${timezone(value)}`
          } else {
            // date
            value.string = `${year(value)}-${month(value)}-${day(value)}${timezone(value)}`
          }
        } else {
          // gYearMonth
          value.string = `${year(value)}-${month(value)}${timezone(value)}`
        }
      } else {
        // gYear
        value.string = `${year(value)}${timezone(value)}`
      }
    } else if (value.month) {
      if (value.day) {
        // gMonthDay
        value.string = `--${month(value)}-${day(value)}${timezone(value)}`
      } else {
        // gMonth
        value.string = `--${month(value)}${timezone(value)}`
      }
    } else if (value.day) {
      // gDay
      value.string = `---${day(value)}${timezone(value)}`
    } else {
      value.string = `${hour(value)}:${minute(value)}:${second(value)}${timezone(value)}`
    }
    return value
  } // parse
} // class DateFormat

function year(value) { return formatNumber(value.year, 4) }
function month(value) { return formatNumber(value.month, 2) }
function day(value) { return formatNumber(value.day, 2) }
function hour(value) { return formatNumber(value.hour, 2) }
function minute(value, def) { return formatNumber(value.minute || def, 2) }
function second(value) { return (value.second || 0).toExponential(2) }
function timezone(value) { return value.timezone ? value.timezone.replace("+00:00", "Z") : '' }

function formatNumber(n, width) {
  return `${n}`.padStart(width, 0)
}

class DateFormatError extends Error { }

const FIELDS = {
  "yyyy": '(?<year>-?([1-9][0-9]{3,}|0[0-9]{3}))',
  "MM": '(?<month>0[1-9]|1[0-2])',
  "M": '(?<month>[1-9]|1[0-2])',
  "dd": '(?<day>0[1-9]|[12][0-9]|3[01])',
  "d": '(?<day>[1-9]|[12][0-9]|3[01])',
  "HH": '(?<hour>[01][0-9]|2[0-3])',
  "mm": '(?<minute>[0-5][0-9])',
  "ss": '([0-6][0-9])',
  "X": '(?<timezone>Z|[-+]((0[0-9]|1[0-3])([0-5][0-9])?|14(00)?))',
  "XX": '(?<timezone>Z|[-+]((0[0-9]|1[0-3])[0-5][0-9]|1400))',
  "XXX": '(?<timezone>Z|[-+]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))',
  "x": '(?<timezone>[-+]((0[0-9]|1[0-3])([0-5][0-9])?|14(00)?))',
  "xx": '(?<timezone>[-+]((0[0-9]|1[0-3])[0-5][0-9]|1400))',
  "xxx": '(?<timezone>[-+]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))'
}

const DATE_PATTERN_REGEXP = {
  "yyyy-MM-dd": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}$`),
  "yyyyMMdd": XRegExp(`^${FIELDS["yyyy"]}${FIELDS["MM"]}${FIELDS["dd"]}$`),
  "dd-MM-yyyy": XRegExp(`^${FIELDS["dd"]}-${FIELDS["MM"]}-${FIELDS["yyyy"]}$`),
  "d-M-yyyy": XRegExp(`^${FIELDS["d"]}-${FIELDS["M"]}-${FIELDS["yyyy"]}$`),
  "MM-dd-yyyy": XRegExp(`^${FIELDS["MM"]}-${FIELDS["dd"]}-${FIELDS["yyyy"]}$`),
  "M-d-yyyy": XRegExp(`^${FIELDS["M"]}-${FIELDS["d"]}-${FIELDS["yyyy"]}$`),
  "dd/MM/yyyy": XRegExp(`^${FIELDS["dd"]}/${FIELDS["MM"]}/${FIELDS["yyyy"]}$`),
  "d/M/yyyy": XRegExp(`^${FIELDS["d"]}/${FIELDS["M"]}/${FIELDS["yyyy"]}$`),
  "MM/dd/yyyy": XRegExp(`^${FIELDS["MM"]}/${FIELDS["dd"]}/${FIELDS["yyyy"]}$`),
  "M/d/yyyy": XRegExp(`^${FIELDS["M"]}/${FIELDS["d"]}/${FIELDS["yyyy"]}$`),
  "dd.MM.yyyy": XRegExp(`^${FIELDS["dd"]}.${FIELDS["MM"]}.${FIELDS["yyyy"]}$`),
  "d.M.yyyy": XRegExp(`^${FIELDS["d"]}.${FIELDS["M"]}.${FIELDS["yyyy"]}$`),
  "MM.dd.yyyy": XRegExp(`^${FIELDS["MM"]}.${FIELDS["dd"]}.${FIELDS["yyyy"]}$`),
  "M.d.yyyy": XRegExp(`^${FIELDS["M"]}.${FIELDS["d"]}.${FIELDS["yyyy"]}$`)
}

const TIME_PATTERN_REGEXP = {
  "HH:mm:ss": XRegExp(`^${FIELDS["HH"]}:${FIELDS["mm"]}:(?<second>${FIELDS["ss"]})$`),
  "HHmmss": XRegExp(`^${FIELDS["HH"]}${FIELDS["mm"]}(?<second>${FIELDS["ss"]})$`),
  "HH:mm": XRegExp(`^${FIELDS["HH"]}:${FIELDS["mm"]}$`),
  "HHmm": XRegExp(`^${FIELDS["HH"]}${FIELDS["mm"]}$`)
}

const DATE_TIME_PATTERN_REGEXP = {
  "yyyy-MM-ddTHH:mm:ss": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}T${FIELDS["HH"]}:${FIELDS["mm"]}:(?<second>${FIELDS["ss"]})$`),
  "yyyy-MM-ddTHH:mm": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}T${FIELDS["HH"]}:${FIELDS["mm"]}$`)
}

const DEFAULT_REGEXP = {
  "http://www.w3.org/2001/XMLSchema#date": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#dateTime": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}T${FIELDS["HH"]}:${FIELDS["mm"]}:(?<second>${FIELDS["ss"]}(\.[0-9]+)?)${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#dateTimeStamp": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}-${FIELDS["dd"]}T${FIELDS["HH"]}:${FIELDS["mm"]}:(?<second>${FIELDS["ss"]}(\.[0-9]+)?)${FIELDS["XXX"]}$`),
  "http://www.w3.org/2001/XMLSchema#gDay": XRegExp(`^---${FIELDS["dd"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#gMonth": XRegExp(`^--${FIELDS["MM"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#gMonthDay": XRegExp(`^--${FIELDS["MM"]}-${FIELDS["dd"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#gYear": XRegExp(`^${FIELDS["yyyy"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#gYearMonth": XRegExp(`^${FIELDS["yyyy"]}-${FIELDS["MM"]}${FIELDS["XXX"]}?$`),
  "http://www.w3.org/2001/XMLSchema#time": XRegExp(`^${FIELDS["HH"]}:${FIELDS["mm"]}:(?<second>${FIELDS["ss"]}(\.[0-9]+)?)${FIELDS["XXX"]}?$`)
}

module.exports = (pattern, datetype) =>
  new DateFormat(pattern, datetype)

