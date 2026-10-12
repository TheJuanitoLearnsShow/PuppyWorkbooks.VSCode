# AGENTS.md

## Project overview

PuppyWorkbooks is a .NET 10 solution for defining and evaluating worksheet-style
Power Fx formulas. The repository includes the core workbook library, an XML-based
integration pipeline, desktop and CLI presentation projects, and xUnit tests.

## Repository layout

- `3-Services/PuppyWorkbooks/`: core workbook model, Power Fx interpreter, and XML serialization.
- `3-Services/PuppyWorkbooks.Integration/`: CSV/SQL/JSON/HTTP integration pipeline and integration XML serializer.
- `5-Presentation/`: Avalonia, WinForms, WPF, WinUI, CLI, and view-model projects.
- `7-Tests/PuppyWorkbooks.Tests/`: xUnit tests and XML/CSV sample fixtures.

## Working conventions

- Target framework is `net10.0`; preserve nullable-reference annotations and implicit usings.
- Follow existing C# conventions: file-scoped namespaces, PascalCase public APIs, and async APIs ending in `Async`.
- Keep domain behavior in the service projects. Presentation projects should consume view models/services rather than duplicate interpreter or serialization logic.
- Keep integration XML parsing backward-compatible where aliases or legacy fields are already supported.
- When changing XML-backed models, update the relevant sample files and tests together.
- Do not commit IDE state from `.vs/` or `.idea/`, nor generated `bin/` and `obj/` output.

---

## Integration XML Guidelines

Integration XML files describe end-to-end data pipelines executed record-by-record.

### XML Pipeline Structure
```xml
<?xml version="1.0" encoding="utf-8"?>
<Integration Name="PipelineName">
  <HttpConfigurations>
    <!-- Optional HTTP client configs -->
    <HttpConfiguration Name="ApiConfig" BaseUrl="https://api.example.com/" HttpClientName="api-client">
      <Headers><Header Name="Authorization" Value="Bearer token" /></Headers>
    </HttpConfiguration>
  </HttpConfigurations>
  <Steps>
    <!-- Steps run in sequential order -->
  </Steps>
</Integration>
```

### Supported Step Types
1. **`IOInput`**: Primary record source.
   - `Kind="CSVReader"` with `FilePath="data.csv"`
   - `Kind="SqlReader"` with `ConnectionString="..."` and `Query="..."` (or child `<Query>`)
   - `Kind="HttpReader"` with `HttpConfiguration="..."`, `Endpoint="..."`, `JsonPath="..."`, `HttpMethod="GET"`
2. **`Map`**: Transforms record by evaluating a worksheet. Every formula cell name becomes a field in the output record.
   - Referenced: `<Map Id="map1"><Worksheet FilePath="worksheets/map.xml" /></Map>`
   - Inline: `<Map Id="map1"><Worksheet><Cells><WorkCell><Id>1</Id><Name>Total</Name><Formula>InputRecord.Price * 1.1</Formula></WorkCell></Cells></Worksheet></Map>`
3. **`Filter`**: Evaluates the last formula cell as boolean.
   - `<Filter Id="f1" KeepWhenTrue="true"><Worksheet FilePath="worksheets/filter.xml" /></Filter>`
4. **`Reduce`**: Aggregates records into an accumulator state.
   - Attributes: `InitialStateJson="0"`, `OutputField="Total"`. Worksheet receives `State` and `InputRecord`.
5. **`Switch`**: Dispatches record to conditional branches based on boolean worksheet cells.
   - Contains `<Worksheet>` and one or more `<Branch WorkCell="CellName">` blocks containing child `Map`, `Filter`, `Reduce`, or nested `Switch` steps.
6. **`IOOutput`**: Writes records to sinks.
   - `Kind="CSVWriter" FilePath="..."`
   - `Kind="JsonWriter" FilePath="..."`
   - `Kind="XmlWriter" FilePath="..." XmlRootElement="..." XmlRecordElement="..."`
   - `Kind="SqlWriter" ConnectionString="..." TableName="..."`
   - `Kind="HttpWriter" HttpConfiguration="..." Endpoint="..." HttpMethod="POST" PayloadFormat="Json"`

---

## Workbook Mapping & Power Fx Guidelines

Worksheet files (`<WorkSheet>`) define variables and formula cells evaluated with Power Fx.

### Worksheet Structure
```xml
<?xml version="1.0" encoding="utf-8"?>
<WorkSheet>
  <Name>SheetName</Name>
  <Variables>
    <Variable><Key>InputRecord</Key><Value>{Amount: 100, IsTaxExempt: false}</Value></Variable>
  </Variables>
  <Cells>
    <WorkCell>
      <Id>1</Id>
      <Name>Tax</Name>
      <Formula>If(InputRecord.IsTaxExempt, 0, Value(InputRecord.Amount) * 0.07)</Formula>
      <Comments>Calculates tax</Comments>
    </WorkCell>
    <WorkCell>
      <Id>2</Id>
      <Name>Total</Name>
      <Formula>Value(InputRecord.Amount) + Tax</Formula>
      <Comments>Final sum</Comments>
    </WorkCell>
  </Cells>
</WorkSheet>
```

### Power Fx Syntax Summary
- **No leading `=`**: Write `InputRecord.Amount * 2`, not `=InputRecord.Amount * 2`.
- **XML escaping**: Always escape XML entities in formulas:
  - `&` -> `&amp;` (e.g. `FirstName &amp; &quot; &quot; &amp; LastName`)
  - `"` -> `&quot;`
  - `<` -> `&lt;` (e.g. `Value(Age) &lt; 18`)
  - `>` -> `&gt;` (e.g. `Value(Amount) &gt; 100`)
- **Record access**: Access fields via `InputRecord.FieldName` or directly `FieldName`. In reduce steps, access accumulator via `State`.
- **Core Functions & Operators**:
  - *Logic*: `If(cond, trueVal, falseVal)`, `Switch(...)`, `And(...)` / `&&`, `Or(...)` / `||`, `Not(...)` / `!`, `IsBlank(...)`, `Blank()`, `Coalesce(...)`
  - *Text*: `Concatenate(...)`, `Upper(...)`, `Lower(...)`, `Trim(...)`, `Left(...)`, `Right(...)`, `Mid(...)`, `Len(...)`, `Replace(...)`, `Substitute(...)`, `Text(...)`, `Value(...)`
  - *Math*: `+`, `-`, `*`, `/`, `^`, `Round(...)`, `RoundUp(...)`, `RoundDown(...)`, `Abs(...)`, `Sqrt(...)`, `Power(...)`, `Mod(...)`, `Max(...)`, `Min(...)`, `Sum(...)`, `Average(...)`
  - *Dates*: `Date(...)`, `Time(...)`, `DateTime(...)`, `Now()`, `Today()`, `DateAdd(...)`, `DateDiff(...)`
  - *Tables*: `[item1, item2]`, `Table(...)`, `LookUp(...)`, `Filter(...)`, `First(...)`, `Last(...)`, `CountRows(...)`
- **Custom Functions in PuppyWorkbooks**:
  - `AddTax(decimal)`: Adds 7% tax.
  - `FileLines(string)`: Reads lines from file into a table of decimal `Price` values.
  - `AsyncSample(string)`: Returns record with `AsyncNewValue`.
- **Official References**:
  - [Power Fx Overview](https://learn.microsoft.com/en-us/power-platform/power-fx/overview)
  - [Power Fx Formula Reference](https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference)

---

## Testing & Mock Execution via CLI

The `puppyworkbooks` CLI executable is available in the system's `PATH`. Use it to execute integrations in mock mode and evaluate worksheets.

### Defining Mock Data
Define mock data on `IOInput` steps to test integrations safely:
```xml
<IOInput Id="source" Kind="CSVReader" FilePath="orders.csv">
  <!-- Inline mock CSV -->
  <MockCsv>
Id,Amount,Status
1,100,Active
2,250,Inactive
  </MockCsv>
  <!-- Or named scenarios -->
  <MockDataSources>
    <MockData Name="ScenarioA">
Id,Amount
1,50
    </MockData>
    <MockData Name="ScenarioB" FilePath="mocks/scenario_b.csv" />
  </MockDataSources>
</IOInput>
```

### CLI Execution Commands
- **Run integration with mock data**:
  ```powershell
  puppyworkbooks path/to/integration.xml --use-mock-data-for-steps ALL --debug
  ```
- **Run a specific named mock scenario**:
  ```powershell
  puppyworkbooks path/to/integration.xml --use-mock-data-for-steps ALL --scenario ScenarioA --debug
  ```
- **Evaluate standalone worksheet / mapping**:
  ```powershell
  puppyworkbooks path/to/worksheet.xml
  ```

---

## Validation

Run the focused test project for core and integration changes:

```powershell
dotnet test 7-Tests/PuppyWorkbooks.Tests/PuppyWorkbooks.Tests.csproj
```

For a broader compile check, build the solution when the installed platform workloads support every UI project:

```powershell
dotnet build PuppyWorkbooks.slnx
```

Prefer focused tests for a changed behavior. Add or update an xUnit test in
`7-Tests/PuppyWorkbooks.Tests` for bug fixes and new core/integration behavior.
