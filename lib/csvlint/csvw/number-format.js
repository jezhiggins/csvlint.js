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
      let numericPartRegExp = `(?<numeric_part>[-+]?([0#Ee]|${escapeRegExp(this.groupingSeparator_)}|${escapeRegExp(this.decimalSeparator)})+)`
      const numberFormatRegexp = XRegExp(`^(?<prefix>.*?)${numericPartRegExp}(?<suffix>.*?)$`)
      const match = XRegExp.exec(pattern, numberFormatRegexp)
      if (match === null) throw NumberFormatError("invalid number format")

      this.prefix_ = match["prefix"]
      this.numericPart_ = match["numeric_part"]
      this.suffix_ = match["suffix"]

      const {
        integerPart,
        fractionalPart,
        exponentPart,
        signRegExp
      } = this.extractNumberFormatParts()

      const {
        minIntegerDigits,
        minFractionDigits,
        maxFractionDigits,
        minExponentDigits,
        maxExponentDigits
      } = this.buildMinMaxDigits(
        integerPart,
        fractionalPart,
        exponentPart
      )

      const integerParts = integerPart
        .split(this.groupingSeparator_)
        .slice(1)
      const integerPartsCount = integerParts.length
      this.primaryGroupingSize_ = (integerParts.length > 0) ? integerParts[integerPartsCount-1].length : 0
      this.secondaryGroupingSize_ = (integerParts.length > 1) ? integerParts[integerPartsCount-2].length : this.primaryGroupingSize_

      const fractionalParts = fractionalPart.split(this.groupingSeparator_).slice(0, -1)
      const fractionalPartsCount = fractionalParts.length
      this.fractionalGroupingSize_ = fractionalPartsCount ? fractionalParts[0].length : 0

      numericPartRegExp = signRegExp + this.buildIntegerRegex(minIntegerDigits)
      numericPartRegExp += this.buildFractionalRegex(minFractionDigits, maxFractionDigits)
      numericPartRegExp += this.buildExponentRegex(minExponentDigits, maxExponentDigits)

      this.regexp_ = XRegExp(`^(?<prefix>${escapeRegExp(this.prefix_)})(?<numeric_part>${numericPartRegExp})(?<suffix>${escapeRegExp(this.suffix_)})$`)
    }
  } // constructor

  match(value) {
    return this.regexp_.test(value)
  } // match

  parse(value) {
    /*
    if this.pattern_=== null
      return null if !this.groupingSeparator_=== null && value =~ Regexp.new("((^${escapeRegExp(this.groupingSeparator_)})|${escapeRegExp(this.groupingSeparator_)}{2})")
      value.replace!(this.groupingSeparator_, "") unless this.groupingSeparator_=== null
      value.replace!(this.decimalSeparator, ".") unless this.decimalSeparator=== null
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
      number.replace!(this.groupingSeparator_, "") unless this.groupingSeparator_=== null
      number.replace!(this.decimalSeparator, ".") unless this.decimalSeparator=== null
      number = this.integer_ ? number.to_i : number.to_f
      number = number.to_f / 100 if match["prefix"].include?("%") || match["suffix"].include?("%")
      number = number.to_f / 1000 if match["prefix"].include?("‰") || match["suffix"].include?("‰")
      return number
    end
    */
  }

  extractNumberFormatParts () {
    const parts = this.numericPart_.split("E")
    const mantissaPart = parts[0]
    const exponentPart = parts[1] || ""
    const mantissaParts = mantissaPart.split(this.decimalSeparator)
    // raise Csvw::NumberFormatError, "more than two decimal separators in number format" if parts.length > 2
    let integerPart = mantissaParts[0]
    const fractionalPart = mantissaParts[1] || ""

    let signRegExp = "[-+]?"

    if (["+", "-"].includes(integerPart[0])) {
      signRegExp = `\\${integerPart[0]}`
      integerPart = integerPart.substring(1)
    }

    return {
      integerPart,
      fractionalPart,
      exponentPart,
      signRegExp
    }
  } // extractNumberFormatParts

  buildMinMaxDigits (
    integerPart,
    fractionalPart,
    exponentPart
  ) {
    const allGroupingSeps = new RegExp(this.groupingSeparator_, 'g')
    const allHashs = /#/g

    const minIntegerDigits = integerPart
      .replace(allGroupingSeps, "")
      .replace(allHashs, "")
      .length
    const minFractionDigits = fractionalPart
      .replace(allGroupingSeps, "")
      .replace(allHashs, "")
      .length
    const maxFractionDigits = fractionalPart
      .replace(allGroupingSeps, "")
      .length
    const minExponentDigits = exponentPart
      .replace(allHashs, "")
      .length
    const maxExponentDigits = exponentPart.length

    return {
      minIntegerDigits,
      minFractionDigits,
      maxFractionDigits,
      minExponentDigits,
      maxExponentDigits
    }
  } // buildMinMaxDigits

  buildIntegerRegex (minIntegerDigits) {
    if (this.primaryGroupingSize_ === 0) {
      return `[0-9]*[0-9]{${minIntegerDigits}}`
    }

    const leadingRegexp = `([0-9]{0,${this.secondaryGroupingSize_ - 1}}${escapeRegExp(this.groupingSeparator_)})?`
    const secondaryGroups = `([0-9]{${this.secondaryGroupingSize_}}${escapeRegExp(this.groupingSeparator_)})*`
    if (minIntegerDigits > this.primaryGroupingSize_) {
      const remainingReqDigits = minIntegerDigits - this.primaryGroupingSize_
      const reqSecondaryGroups = remainingReqDigits / this.secondaryGroupingSize_ > 0 ? `([0-9]{${this.secondaryGroupingSize_}}${escapeRegExp(this.groupingSeparator_)}){${remainingReqDigits / this.secondaryGroupingSize_}}` : ""
      if (remainingReqDigits % this.secondaryGroupingSize_ > 0) {
        const finalReqDigits = `[0-9]{${this.secondaryGroupingSize_ - (remainingReqDigits % this.secondaryGroupingSize_)}}`
        const finalOptDigits = `[0-9]{0,${this.secondaryGroupingSize_ - (remainingReqDigits % this.secondaryGroupingSize_)}}`
        return `((${leadingRegexp}${secondaryGroups}${finalReqDigits})|${finalOptDigits})[0-9]{${remainingReqDigits % this.secondaryGroupingSize_}}${escapeRegExp(this.groupingSeparator_)}${reqSecondaryGroups}[0-9]{${this.primaryGroupingSize_}}`
      } else {
        return `(${leadingRegexp}${secondaryGroups})?${reqSecondaryGroups}[0-9]{${this.primaryGroupingSize_}}`
      }
    } else {
      const finalReqDigits = this.primaryGroupingSize_ > minIntegerDigits ? `[0-9]{${this.primaryGroupingSize_ - minIntegerDigits}}` : ""
      const finalOptDigits = this.primaryGroupingSize_ > minIntegerDigits ? `[0-9]{0,${this.primaryGroupingSize_ - minIntegerDigits}}` : ""
      return `((${leadingRegexp}${secondaryGroups}${finalReqDigits})|${finalOptDigits})[0-9]{${minIntegerDigits}}`
    }
  } // buildIntegerRegex

  buildFractionalRegex (minFractionalDigits, maxFractionalDigits) {
    if (maxFractionalDigits === 0) {
      return ''
    }

    if (this.fractionalGroupingSize_ === 0) {
      let fractionalRegExp = ""
      if (minFractionDigits > 0) {
        fractionalRegExp += `[0-9]{${minFractionDigits}}`
      }
      if (minFractionalDigits !== maxFractionalDigits) {
        fractionalRegExp += `[0-9]{0,${maxFractionDigits - minFractionDigits}}`
      }

      fractionalRegExp = `${escapeRegExp(this.decimalSeparator)}${fractionalRegExp}`
      if (minFractionDigits === 0) {
        fractionalRegExp = `(${fractionalRegExp})?`
      }

      return fractionalRegExp
    }

    // fractionalGroupSize_ > 0
    /*
    let fractionalRegExp = ""

    if minFractionDigits > 0
      if minFractionDigits >= this.fractionalGroupingSize_
        # first group of required digits - something like "[0-9]{3}"
        fractionalRegExp += "[0-9]{${this.fractionalGroupingSize_}}"
        # additional groups of required digits - something like "(,[0-9]{3}){1}"
        fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{${this.fractionalGroupingSize_}}){${minFractionDigits / this.fractionalGroupingSize_ - 1}}" if minFractionDigits / this.fractionalGroupingSize_ > 1
        fractionalRegExp += "${escapeRegExp(this.groupingSeparator_)}" if minFractionDigits % this.fractionalGroupingSize_ > 0
      end
      # additional required digits - something like ",[0-9]{1}"
      fractionalRegExp += "[0-9]{${minFractionDigits % this.fractionalGroupingSize_}}" if minFractionDigits % this.fractionalGroupingSize_ > 0

      opt_fractional_digits = maxFractionDigits - minFractionDigits
      if opt_fractional_digits > 0
        fractionalRegExp += "("

        if minFractionDigits % this.fractionalGroupingSize_ > 0
          # optional fractional digits to complete the group
          fractionalRegExp += "[0-9]{0,${[opt_fractional_digits, this.fractionalGroupingSize_ - (minFractionDigits % this.fractionalGroupingSize_)].min}}"
          fractionalRegExp += "|"
          fractionalRegExp += "[0-9]{${[opt_fractional_digits, this.fractionalGroupingSize_ - (minFractionDigits % this.fractionalGroupingSize_)].min}}"
        else
          fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,${this.fractionalGroupingSize_}})?"
          fractionalRegExp += "|"
          fractionalRegExp += "${escapeRegExp(this.groupingSeparator_)}[0-9]{${this.fractionalGroupingSize_}}"
        end

        remaining_opt_fractional_digits = opt_fractional_digits - (this.fractionalGroupingSize_ - (minFractionDigits % this.fractionalGroupingSize_))
        if remaining_opt_fractional_digits > 0
          if remaining_opt_fractional_digits % this.fractionalGroupingSize_ > 0
            # optional fraction digits in groups
            fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{${this.fractionalGroupingSize_}}){0,${remaining_opt_fractional_digits / this.fractionalGroupingSize_}}" if remaining_opt_fractional_digits > this.fractionalGroupingSize_
            # remaining optional fraction digits
            fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,${remaining_opt_fractional_digits % this.fractionalGroupingSize_}})?"
          else
            # optional fraction digits in groups
            fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{${this.fractionalGroupingSize_}}){0,${(remaining_opt_fractional_digits / this.fractionalGroupingSize_) - 1}}" if remaining_opt_fractional_digits > this.fractionalGroupingSize_
            # remaining optional fraction digits
            fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,${this.fractionalGroupingSize_}})?"
          end

          # optional fraction digits in groups
          fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{${this.fractionalGroupingSize_}}){0,${(remaining_opt_fractional_digits / this.fractionalGroupingSize_) - 1}}" if remaining_opt_fractional_digits > this.fractionalGroupingSize_
          # remaining optional fraction digits
          fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,${remaining_opt_fractional_digits % this.fractionalGroupingSize_}})?" if remaining_opt_fractional_digits % this.fractionalGroupingSize_ > 0
        end
        fractionalRegExp += ")"
      end
    elsif maxFractionDigits % this.fractionalGroupingSize_ > 0
      # optional fractional digits in groups
      fractionalRegExp += "([0-9]{${this.fractionalGroupingSize_}}${escapeRegExp(this.groupingSeparator_)}){0,${maxFractionDigits / this.fractionalGroupingSize_}}"
      # remaining optional fraction digits
      fractionalRegExp += "(${escapeRegExp(this.groupingSeparator_)}[0-9]{1,${maxFractionDigits % this.fractionalGroupingSize_}})?" if maxFractionDigits % this.fractionalGroupingSize_ > 0
    else
      fractionalRegExp += "([0-9]{${this.fractionalGroupingSize_}}${escapeRegExp(this.groupingSeparator_)}){0,${(maxFractionDigits / this.fractionalGroupingSize_) - 1}}" if maxFractionDigits > this.fractionalGroupingSize_
      fractionalRegExp += "[0-9]{1,${this.fractionalGroupingSize_}}"
    end
    fractionalRegExp = "${escapeRegExp(this.decimalSeparator)}${fractionalRegExp}"
    fractionalRegExp = "(${fractionalRegExp})?" if minFractionDigits == 0
    return fractionalRegExp
    */
  } // buildFractionalRegex

  buildExponentRegex (minExponentDigits, maxExponentDigits) {
    if (maxExponentDigits === 0) {
      return ''
    }

    let exponentRegExp = "E"

    if (maxExponentDigits !== minExponentDigits) {
      exponentRegExp += `[0-9]{0,${maxExponentDigits - minExponentDigits}}`
    } // if ...
    if (minExponentDigits !== 0) {
      exponentRegExp += `[0-9]{${minExponentDigits}}`
    }

    return exponentRegExp
  } // buildExponentRegex
} // class NumberFormat

const INTEGER_REGEXP = /^[-+]?[0-9]+[%‰]?$/

class NumberFormatError extends Error { }

module.exports = (pattern, groupingSeparator, decimalSeparator, integer) =>
  new NumberFormat(pattern, groupingSeparator, decimalSeparator, integer)
