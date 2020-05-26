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

  parse (value) {
  /*
    match = this.regexp_.match(value)
    return nil if match=== null
    # STDERR.puts(this.regexp_)
    # STDERR.puts(value)
    # STDERR.puts(match.inspect)
    value = {}
    match.names.each do |field|
      unless match[field]=== null
        case field
        when "timezone"
          tz = match["timezone"]
          tz = "+00:00" if tz == 'Z'
          tz += ':00' if tz.length == 3
          tz = "#{tz[0..2]}:#{tz[3..4]}" unless tz =~ /:/
          value[:timezone] = tz
        when "second"
          value[:second] = match["second"].to_f
        else
          value[field.to_sym] = match[field].to_i
        end
      end
    end
    case this.type_
    when "http://www.w3.org/2001/XMLSchema#date"
      begin
        value[:dateTime] = Date.new(match["year"].to_i, match["month"].to_i, match["day"].to_i)
      rescue ArgumentError
        return nil
      end
    when "http://www.w3.org/2001/XMLSchema#dateTime"
      begin
        value[:dateTime] = DateTime.new(match["year"].to_i, match["month"].to_i, match["day"].to_i, match["hour"].to_i, match["minute"].to_i, (match.names.include?("second") ? match["second"].to_f : 0), match.names.include?("timezone") && match["timezone"] ? match["timezone"] : '')
      rescue ArgumentError
        return nil
      end
    else
      value[:dateTime] = DateTime.new(value[:year] || 0, value[:month] || 1, value[:day] || 1, value[:hour] || 0, value[:minute] || 0, value[:second] || 0, value[:timezone] || "+00:00")
    end
    if value[:year]
      if value[:month]
        if value[:day]
          if value[:hour]
            # dateTime
            value[:string] = "#{format('%04d', value[:year])}-#{format('%02d', value[:month])}-#{format('%02d', value[:day])}T#{format('%02d', value[:hour])}:#{format('%02d', value[:minute] || 0)}:#{format('%02g', value[:second] || 0)}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
          else
            # date
            value[:string] = "#{format('%04d', value[:year])}-#{format('%02d', value[:month])}-#{format('%02d', value[:day])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
          end
        else
          # gYearMonth
          value[:string] = "#{format('%04d', value[:year])}-#{format('%02d', value[:month])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
        end
      else
        # gYear
        value[:string] = "#{format('%04d', value[:year])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
      end
    elsif value[:month]
      if value[:day]
        # gMonthDay
        value[:string] = "--#{format('%02d', value[:month])}-#{format('%02d', value[:day])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
      else
        # gMonth
        value[:string] = "--#{format('%02d', value[:month])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
      end
    elsif value[:day]
      # gDay
      value[:string] = "---#{format('%02d', value[:day])}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
    else
      value[:string] = "#{format('%02d', value[:hour])}:#{format('%02d', value[:minute])}:#{format('%02g', value[:second] || 0)}#{value[:timezone] ? value[:timezone].sub("+00:00", "Z") : ''}"
    end
    return value

   */
  } // parse
} // class DateFormat

class DateFormatError extends Error { }

const FIELDS = {
  "yyyy": XRegExp('(?<year>-?([1-9][0-9]{3,}|0[0-9]{3}))'),
  "MM": XRegExp('(?<month>0[1-9]|1[0-2])'),
  "M": XRegExp('(?<month>[1-9]|1[0-2])'),
  "dd": XRegExp('(?<day>0[1-9]|[12][0-9]|3[01])'),
  "d": XRegExp('(?<day>[1-9]|[12][0-9]|3[01])'),
  "HH": XRegExp('(?<hour>[01][0-9]|2[0-3])'),
  "mm": XRegExp('(?<minute>[0-5][0-9])'),
  "ss": XRegExp('([0-6][0-9])'),
  "X": XRegExp('(?<timezone>Z|[-+]((0[0-9]|1[0-3])([0-5][0-9])?|14(00)?))'),
  "XX": XRegExp('(?<timezone>Z|[-+]((0[0-9]|1[0-3])[0-5][0-9]|1400))'),
  "XXX": XRegExp('(?<timezone>Z|[-+]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))'),
  "x": XRegExp('(?<timezone>[-+]((0[0-9]|1[0-3])([0-5][0-9])?|14(00)?))'),
  "xx": XRegExp('(?<timezone>[-+]((0[0-9]|1[0-3])[0-5][0-9]|1400))'),
  "xxx": XRegExp('(?<timezone>[-+]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))'),
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

