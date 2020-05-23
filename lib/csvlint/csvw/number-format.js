const XRegExp = require('xregexp')

function escapeRegExp(string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

class NumberFormat {
  get integer() { return this.integer_ }
  get pattern() { return this.pattern_ }
  get prefix() { return this.prefix_ }
  get numericPart() { return this.numericPart_ }
  get suffix() { return this.suffix_ }
  get groupingSeparator() { return this.groupingSeparator_ }
  get decimalSeparator() { return this.decimalSeparator_ }
  get primaryGroupingSize() { return this.primaryGroupingSize_ }
  get secondaryGroupingSize() { return this.secondaryGroupingSize_ }
  get fractionalGroupingSize() { return this.fractionalGroupingSize_ }

  constructor(pattern=null, groupingSeparator=null, decimalSeparator=".", integer=null) {
    this.pattern_ = pattern
    this.integer_ = integer
    if (this.integer_ === null) {
      if (this.pattern_ === null) {
        this.integer_ = null
      } else {
        this.integer_ = !this.pattern_.includes(decimalSeparator)
      }
    }
    this.groupingSeparator_ = groupingSeparator || (this.pattern_ === null ? null : ",")
    this.decimalSeparator_ = decimalSeparator || "."
    if (pattern === null) {
      if (integer) {
        this.regexp_ = INTEGER_REGEXP
      } else {
        this.regexp_ = /^(([-+]?[0-9]+(\\.[0-9]+)?([Ee][-+]?[0-9]+)?[%‰]?)|NaN|INF|-INF)$"/
      }
    } else {
      const numericPartRegExp = XRegExp(`(?<numeric_part>[-+]?([0#Ee]|${escapeRegExp(this.groupingSeparator_)}|${escapeRegExp(this.decimalSeparator)})+)`)
      const numberFormatRegexp = XRegExp(`^(?<prefix>.*?)${numericPartRegExp.xregexp.source}(?<suffix>.*?)$`)
      const match = XRegExp.exec(pattern, numberFormatRegexp)
      if (match === null) throw NumberFormatError("invalid number format")

      this.prefix_ = match["prefix"]
      this.numericPart_ = match["numeric_part"]
      this.suffix_ = match["suffix"]

      /*
      const parts = this.numericPart_.split("E")
      const mantissaPart = parts[0]
      const exponentPart = parts[1] || ""
      const mantissaParts = mantissaPart.split(this.decimalSeparator)
      // raise Csvw::NumberFormatError, "more than two decimal separators in number format" if parts.length > 2
      const integerPart = mantissaParts[0]
      const fractionalPart = mantissaParts[1] || ""

      if ["+", "-"].include?(integerPart[0])
        numericPartRegExp = "\\#{integerPart[0]}"
        integerPart = integerPart[1..-1]
      else
        numericPartRegExp = "[-+]?"
      end

      min_integer_digits = integerPart.gsub(this.groupingSeparator_, "").gsub("#", "").length
      min_fraction_digits = fractionalPart.gsub(this.groupingSeparator_, "").gsub("#", "").length
      max_fraction_digits = fractionalPart.gsub(this.groupingSeparator_, "").length
      min_exponent_digits = exponentPart.gsub("#", "").length
      max_exponent_digits = exponentPart.length

      integerParts = integerPart.split(this.groupingSeparator_)[1..-1]
      @primary_grouping_size = integerParts[-1].length rescue 0
      @secondary_grouping_size = integerParts[-2].length rescue @primary_grouping_size

      fractionalParts = fractionalPart.split(this.groupingSeparator_)[0..-2]
      @fractional_grouping_size = fractionalParts[0].length rescue 0

      if @primary_grouping_size == 0
        integer_regexp = "[0-9]*[0-9]{#{min_integer_digits}}"
      else
        leading_regexp = "([0-9]{0,#{@secondary_grouping_size - 1}}${escapeRegExp(this.groupingSeparator_)})?"
        secondary_groups = "([0-9]{#{@secondary_grouping_size}}${escapeRegExp(this.groupingSeparator_)})*"
        if min_integer_digits > @primary_grouping_size
          remaining_req_digits = min_integer_digits - @primary_grouping_size
          req_secondary_groups = remaining_req_digits / @secondary_grouping_size > 0 ? "([0-9]{#{@secondary_grouping_size}}${escapeRegExp(this.groupingSeparator_)}){#{remaining_req_digits / @secondary_grouping_size}}" : ""
          if remaining_req_digits % @secondary_grouping_size > 0
            final_req_digits = "[0-9]{#{@secondary_grouping_size - (remaining_req_digits % @secondary_grouping_size)}}"
            final_opt_digits = "[0-9]{0,#{@secondary_grouping_size - (remaining_req_digits % @secondary_grouping_size)}}"
            integer_regexp = "((#{leading_regexp}#{secondary_groups}#{final_req_digits})|#{final_opt_digits})[0-9]{#{remaining_req_digits % @secondary_grouping_size}}${escapeRegExp(this.groupingSeparator_)}#{req_secondary_groups}[0-9]{#{@primary_grouping_size}}"
          else
            integer_regexp = "(#{leading_regexp}#{secondary_groups})?#{req_secondary_groups}[0-9]{#{@primary_grouping_size}}"
          end
        else
          final_req_digits = @primary_grouping_size > min_integer_digits ? "[0-9]{#{@primary_grouping_size - min_integer_digits}}" : ""
          final_opt_digits = @primary_grouping_size > min_integer_digits ? "[0-9]{0,#{@primary_grouping_size - min_integer_digits}}" : ""
          integer_regexp = "((#{leading_regexp}#{secondary_groups}#{final_req_digits})|#{final_opt_digits})[0-9]{#{min_integer_digits}}"
        end
      end

      numericPartRegExp += integer_regexp

      if max_fraction_digits > 0
        if @fractional_grouping_size == 0
          fractional_regexp = ""
          fractional_regexp += "[0-9]{#{min_fraction_digits}}" if min_fraction_digits > 0
          fractional_regexp += "[0-9]{0,#{max_fraction_digits - min_fraction_digits}}" unless min_fraction_digits == max_fraction_digits
          fractional_regexp = "${escapeRegExp(this.decimalSeparator)}#{fractional_regexp}"
          fractional_regexp = "(#{fractional_regexp})?" if min_fraction_digits == 0
          numericPartRegExp += fractional_regexp
        else
          fractional_regexp = ""

          if min_fraction_digits > 0
            if min_fraction_digits >= @fractional_grouping_size
              # first group of required digits - something like "[0-9]{3}"
              fractional_regexp += "[0-9]{#{@fractional_grouping_size}}"
              # additional groups of required digits - something like "(,[0-9]{3}){1}"
              fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{#{@fractional_grouping_size}}){#{min_fraction_digits / @fractional_grouping_size - 1}}" if min_fraction_digits / @fractional_grouping_size > 1
              fractional_regexp += "${escapeRegExp(this.groupingSeparator_)}" if min_fraction_digits % @fractional_grouping_size > 0
            end
            # additional required digits - something like ",[0-9]{1}"
            fractional_regexp += "[0-9]{#{min_fraction_digits % @fractional_grouping_size}}" if min_fraction_digits % @fractional_grouping_size > 0

            opt_fractional_digits = max_fraction_digits - min_fraction_digits
            if opt_fractional_digits > 0
              fractional_regexp += "("

              if min_fraction_digits % @fractional_grouping_size > 0
                # optional fractional digits to complete the group
                fractional_regexp += "[0-9]{0,#{[opt_fractional_digits, @fractional_grouping_size - (min_fraction_digits % @fractional_grouping_size)].min}}"
                fractional_regexp += "|"
                fractional_regexp += "[0-9]{#{[opt_fractional_digits, @fractional_grouping_size - (min_fraction_digits % @fractional_grouping_size)].min}}"
              else
                fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,#{@fractional_grouping_size}})?"
                fractional_regexp += "|"
                fractional_regexp += "${escapeRegExp(this.groupingSeparator_)}[0-9]{#{@fractional_grouping_size}}"
              end

              remaining_opt_fractional_digits = opt_fractional_digits - (@fractional_grouping_size - (min_fraction_digits % @fractional_grouping_size))
              if remaining_opt_fractional_digits > 0
                if remaining_opt_fractional_digits % @fractional_grouping_size > 0
                  # optional fraction digits in groups
                  fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{#{@fractional_grouping_size}}){0,#{remaining_opt_fractional_digits / @fractional_grouping_size}}" if remaining_opt_fractional_digits > @fractional_grouping_size
                  # remaining optional fraction digits
                  fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,#{remaining_opt_fractional_digits % @fractional_grouping_size}})?"
                else
                  # optional fraction digits in groups
                  fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{#{@fractional_grouping_size}}){0,#{(remaining_opt_fractional_digits / @fractional_grouping_size) - 1}}" if remaining_opt_fractional_digits > @fractional_grouping_size
                  # remaining optional fraction digits
                  fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,#{@fractional_grouping_size}})?"
                end

                # optional fraction digits in groups
                fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{#{@fractional_grouping_size}}){0,#{(remaining_opt_fractional_digits / @fractional_grouping_size) - 1}}" if remaining_opt_fractional_digits > @fractional_grouping_size
                # remaining optional fraction digits
                fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,#{remaining_opt_fractional_digits % @fractional_grouping_size}})?" if remaining_opt_fractional_digits % @fractional_grouping_size > 0
              end
              fractional_regexp += ")"
            end
          elsif max_fraction_digits % @fractional_grouping_size > 0
            # optional fractional digits in groups
            fractional_regexp += "([0-9]{#{@fractional_grouping_size}}${escapeRegExp(this.groupingSeparator_)}){0,#{max_fraction_digits / @fractional_grouping_size}}"
            # remaining optional fraction digits
            fractional_regexp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,#{max_fraction_digits % @fractional_grouping_size}})?" if max_fraction_digits % @fractional_grouping_size > 0
          else
            fractional_regexp += "([0-9]{#{@fractional_grouping_size}}${escapeRegExp(this.groupingSeparator_)}){0,#{(max_fraction_digits / @fractional_grouping_size) - 1}}" if max_fraction_digits > @fractional_grouping_size
            fractional_regexp += "[0-9]{1,#{@fractional_grouping_size}}"
          end
          fractional_regexp = "${escapeRegExp(this.decimalSeparator)}#{fractional_regexp}"
          fractional_regexp = "(#{fractional_regexp})?" if min_fraction_digits == 0
          numericPartRegExp += fractional_regexp
        end
      end

      if max_exponent_digits > 0
        numericPartRegExp += "E"
        numericPartRegExp += "[0-9]{0,#{max_exponent_digits - min_exponent_digits}}" unless max_exponent_digits == min_exponent_digits
        numericPartRegExp += "[0-9]{#{min_exponent_digits}}" unless min_exponent_digits == 0
      end

      this.regexp_ = Regexp.new("^(?<prefix>${escapeRegExp(this.prefix_)})(?<numeric_part>#{numericPartRegExp})(?<suffix>#{suffix})$")
       */
    }
  } // constructor

  match(value) {
    this.regexp_.test(value)
  } // match

  parse(value) {
    /*
    if this.pattern_=== null
      return null if !this.groupingSeparator_=== null && value =~ Regexp.new("((^${escapeRegExp(this.groupingSeparator_)})|${escapeRegExp(this.groupingSeparator_)}{2})")
      value.gsub!(this.groupingSeparator_, "") unless this.groupingSeparator_=== null
      value.gsub!(this.decimalSeparator, ".") unless this.decimalSeparator=== null
      if value =~ this.regexp_
        case value
        when "NaN"
          return Float::NAN
        when "INF"
          return Float::INFINITY
        when "-INF"
          return -Float::INFINITY
        else
          case value[-1]
          when "%"
            return value.to_f / 100
          when "‰"
            return value.to_f / 1000
          else
            if this.integer_=== null
              return value.include?(".") ? value.to_f : value.to_i
            else
              return this.integer_ ? value.to_i : value.to_f
            end
          end
        end
      else
        return null
      end
    else
      match = this.regexp_.match(value)
      return null if match=== null
      number = match["numeric_part"]
      number.gsub!(this.groupingSeparator_, "") unless this.groupingSeparator_=== null
      number.gsub!(this.decimalSeparator, ".") unless this.decimalSeparator=== null
      number = this.integer_ ? number.to_i : number.to_f
      number = number.to_f / 100 if match["prefix"].include?("%") || match["suffix"].include?("%")
      number = number.to_f / 1000 if match["prefix"].include?("‰") || match["suffix"].include?("‰")
      return number
    end
    */
  }

} // class NumberFormat

const INTEGER_REGEXP = /^[-+]?[0-9]+[%‰]?$/

class NumberFormatError extends Error { }

module.exports = (pattern, groupingSeparator, decimalSeparator, integer) =>
  new NumberFormat(pattern, groupingSeparator, decimalSeparator, integer)
