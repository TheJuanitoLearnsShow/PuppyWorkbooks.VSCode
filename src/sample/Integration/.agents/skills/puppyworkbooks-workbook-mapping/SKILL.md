---
name: puppyworkbooks-workbook-mapping
description: Create, edit, and validate PuppyWorkbooks worksheet mapping files and Power Fx formulas for integration transformations, calculations, and standalone workbooks.
---

# PuppyWorkbooks Workbook Mapping & Power Fx

Use this skill when authoring, modifying, or reviewing PuppyWorkbooks `<WorkSheet>` XML files, including mapping worksheets for `Map`, `Filter`, `Reduce`, or `Switch` integration steps, as well as standalone calculation workbooks.

## Reference Examples

This skill is self-contained: every construct you need is documented inline below. You do not need access to any source repository or sample project. The common worksheet patterns are:

- **Record transformation (Map)**: Each formula cell projects a field into the emitted record (see the multi-cell example in "Worksheet XML Structure").
- **Record filtering (Filter)**: A final boolean cell decides record inclusion, e.g. `Value(InputRecord.Amount) &gt; 100`.
- **State accumulation (Reduce)**: Cells combine the previous `State` with the current `InputRecord`, e.g. `State + Value(InputRecord.Amount)`.
- **Multi-cell formula chain**: Declare `Variables` (including a sample `InputRecord`) and chain cells that reference earlier cell names, arrays, and records (see the example below).

## Worksheet XML Structure

A worksheet file defines variables and formula-evaluated cells:

```xml
<?xml version="1.0" encoding="utf-8"?>
<WorkSheet>
  <Name>OrderCalculations</Name>
  <Variables>
    <Variable>
      <Key>InputRecord</Key>
      <Value>{Id: 101, Customer: "Acme", Amount: 250.00, IsVip: true}</Value>
    </Variable>
    <Variable>
      <Key>TaxRate</Key>
      <Value>0.08</Value>
    </Variable>
  </Variables>
  <Cells>
    <WorkCell>
      <Id>1</Id>
      <Name>Discount</Name>
      <Formula>If(InputRecord.IsVip, Value(InputRecord.Amount) * 0.10, 0)</Formula>
      <Comments>10% discount for VIP customers</Comments>
    </WorkCell>
    <WorkCell>
      <Id>2</Id>
      <Name>Subtotal</Name>
      <Formula>Value(InputRecord.Amount) - Discount</Formula>
      <Comments>Amount after discount</Comments>
    </WorkCell>
    <WorkCell>
      <Id>3</Id>
      <Name>Tax</Name>
      <Formula>Subtotal * TaxRate</Formula>
      <Comments>Calculated tax amount</Comments>
    </WorkCell>
    <WorkCell>
      <Id>4</Id>
      <Name>FinalTotal</Name>
      <Formula>Subtotal + Tax</Formula>
      <Comments>Final billed amount</Comments>
    </WorkCell>
  </Cells>
</WorkSheet>
```

### Element Breakdown
- `<Name>`: Descriptive worksheet name.
- `<Variables>`: Key-value variable declarations evaluated before cells run. In integration steps, `InputRecord` (and `State` in Reduce steps) are bound automatically from the pipeline. Declaring sample `Variables` in mapping XML allows standalone testing.
- `<Cells>`: List of `<WorkCell>` elements executed in sequential order.
- `<WorkCell>`:
  - `<Id>`: Integer identifier (1, 2, 3, ...).
  - `<Name>`: Identifier for the cell. Must follow valid Power Fx identifier naming (letters, numbers, underscore). In `Map` steps, each cell name becomes a property in the emitted record.
  - `<Formula>`: Power Fx expression.
  - `<Comments>`: Optional description/documentation.

---

## Power Fx Syntax Rules & Best Practices

PuppyWorkbooks uses Microsoft Power Fx as its formula expression engine.

### Essential Rules
1. **No Leading Equals Sign (`=`)**: Write formulas directly without Excel's leading `=`.
   - Correct: `InputRecord.Price * 1.05`
   - Incorrect: `=InputRecord.Price * 1.05`
2. **XML Entity Escaping**: Because formulas reside in XML elements, special XML characters must be escaped:
   - `&` (string concatenation or logical AND): Use `&amp;` (e.g., `InputRecord.FirstName &amp; &quot; &quot; &amp; InputRecord.LastName`)
   - `"` (quote literal): Use `&quot;` inside attributes or when escaping text
   - `<` (less than): Use `&lt;` (e.g., `Value(InputRecord.Age) &lt; 65`)
   - `>` (greater than): Use `&gt;` (e.g., `Value(InputRecord.Amount) &gt; 100`)
3. **Record Access in Integration Context**:
   - Access fields on the incoming record using `InputRecord.FieldName` (e.g., `InputRecord.Amount`).
   - For backwards compatibility, direct field names (e.g., `Amount`) are also bound if present.
   - For `Reduce` steps, access previous accumulated state using `State` (e.g., `State + InputRecord.Amount`).

---

## Power Fx Syntax & Built-in Functions Reference

### Operators
- **Arithmetic**: `+`, `-`, `*`, `/`, `^` (power)
- **Comparison**: `=` (equal), `<>` (not equal), `<`, `>`, `<=`, `>=`
- **Text**: `&` (concatenation)
- **Logical**: `And` (or `&&`), `Or` (or `||`), `Not` (or `!`)

### Conditional & Logical Functions
- `If(condition, trueValue, falseValue)`: Conditional branching. Supports multiple condition pairs: `If(cond1, val1, cond2, val2, defaultValue)`.
- `Switch(expression, match1, val1, match2, val2, defaultVal)`: Multi-way branching based on value.
- `Coalesce(val1, val2, ...)`: Returns first non-blank, non-null value.
- `IsBlank(value)` / `IsBlankOrError(value)`: Checks if a value is blank.
- `Blank()`: Returns a blank/null value.

### Text & String Functions
- `Concatenate(str1, str2, ...)`: Joins strings (or use `&amp;`).
- `Upper(text)` / `Lower(text)`: Converts string casing.
- `Trim(text)`: Removes leading, trailing, and excessive internal spaces.
- `Left(text, count)` / `Right(text, count)` / `Mid(text, start, count)`: Substring extraction.
- `Len(text)`: String length.
- `Replace(text, start, count, newText)` / `Substitute(text, oldText, newText)`: String replacement.
- `Text(numberOrDate, [format])`: Formats numbers or dates into strings.
- `Value(text)`: Parses numeric string into decimal number (essential when processing CSV string inputs).

### Mathematical & Numerical Functions
- `Round(num, digits)` / `RoundUp(num, digits)` / `RoundDown(num, digits)`
- `Abs(num)`: Absolute value.
- `Sqrt(num)`: Square root.
- `Power(base, exponent)`: Exponential calculation.
- `Mod(number, divisor)`: Modulo/remainder.
- `Min(val1, val2, ...)` / `Max(val1, val2, ...)`: Extremes.
- `Sum(tableOrList, [expression])` / `Average(...)`: Aggregate calculations.

### Date & Time Functions
- `Date(year, month, day)` / `Time(hour, minute, second)` / `DateTime(year, month, day, hour, minute, second)`
- `Now()` / `Today()`: Current date/time.
- `Year(date)` / `Month(date)` / `Day(date)` / `Hour(time)` / `Minute(time)` / `Second(time)`
- `DateAdd(date, delta, TimeUnit)` / `DateDiff(date1, date2, TimeUnit)`: Date arithmetic (e.g., `TimeUnit.Days`, `TimeUnit.Months`).

### Table & Collection Functions
- `[item1, item2, item3]`: Inline array/table literal.
- `{Field1: val1, Field2: val2}`: Inline record literal.
- `Table({Col: 1}, {Col: 2})`: Creates a structured table.
- `First(table)` / `Last(table)`: Retrieves first/last record.
- `CountRows(table)`: Counts rows in table.
- `LookUp(table, condition, [resultExpression])`: Finds first matching record or projected expression.
- `Filter(table, condition)`: Filters rows from table.

---

## Custom PuppyWorkbooks Power Fx Functions

PuppyWorkbooks registers custom reflection functions available in formulas:

1. `AddTax(amount: Decimal) -> Decimal`
   - Adds 7% tax to decimal input: `AddTax(100.00) -> 107.00`.
   - Example: `<Formula>AddTax(Value(InputRecord.Price))</Formula>`
2. `FileLines(filePath: String) -> Table<Price: Decimal>`
   - Reads file lines from `filePath` and exposes them as a table containing a decimal `Price` column.
   - Example: `<Formula>Sum(FileLines(&quot;prices.txt&quot;), Price)</Formula>`
3. `AsyncSample(option: String) -> Record<AsyncNewValue: String>`
   - Sample asynchronous function returning a record with `AsyncNewValue`.

---

## External Power Fx Documentation

For in-depth reference on language features, grammar, and function signatures:
- Microsoft Power Fx Overview: [https://learn.microsoft.com/en-us/power-platform/power-fx/overview](https://learn.microsoft.com/en-us/power-platform/power-fx/overview)
- Microsoft Power Fx Formula Reference: [https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference](https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference)

---

## Validating Worksheets with the CLI Tool

The `puppyworkbooks` CLI executable is available in the system's PATH.

### Direct Worksheet Evaluation
Evaluate a standalone worksheet XML file or integration mapping file directly to verify formulas and cell output:

```powershell
puppyworkbooks path/to/worksheet.xml
```

### Overriding Input Values During CLI Validation
Pass JSON input data to override variables defined in the worksheet:
```powershell
puppyworkbooks path/to/worksheet.xml --input-data "{\"InputRecord\": \"{\\\"Amount\\\": 150}\"}"
```
