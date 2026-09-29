---
name: puppyworkbooks-integration-xml
description: Create, edit, and validate PuppyWorkbooks XML integration definitions containing CSV, SQL, JSON, or HTTP I/O and worksheet-driven Map, Filter, Reduce, or Switch steps with mock data testing.
---

# PuppyWorkbooks Integration XML

Use this skill to create, modify, inspect, and validate XML integration pipeline definitions for PuppyWorkbooks.

## Reference Patterns

This skill is self-contained: every construct you need is documented inline below. You do not need access to any source repository or sample project. The most common pipeline shapes are:

- **File pipeline**: A provider-specific input element such as `<CsvInput>` or `<SqlInput>`, one or more `Map`/`Filter`/`Reduce` steps referencing external worksheets, and a provider-specific output element such as `<CsvOutput>` (see the full structure and step examples below).
- **Conditional routing**: A `Switch` step with inline worksheet boolean cells and multiple execution `Branch` blocks (see the `Switch` section).
- **HTTP endpoints**: `<HttpInput>`/`<HttpOutput>` steps driven by `<HttpConfigurations>` (see the structure example and input/output sections).
- **Mock scenarios**: One or more named mock data sources for edge-case and volume testing (see "Defining Mock Data for Testing").
- **Standalone worksheets**: Map/Filter/Reduce worksheet definitions used within pipeline steps (see the companion `puppyworkbooks-workbook-mapping` skill).

## Pipeline Architecture & XML Structure

Integration pipelines are declared under a root `<Integration Name="...">` with child `<Steps>`. Optional `<HttpConfigurations>` can precede `<Steps>`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<Integration Name="OrderProcessing">
  <HttpConfigurations>
    <HttpConfiguration Name="BillingApi" BaseUrl="https://api.example.com/v1/" HttpClientName="billing-client">
      <Headers>
        <Header Name="Authorization" Value="Bearer secret-token" />
        <Header Name="Accept" Value="application/json" />
      </Headers>
    </HttpConfiguration>
  </HttpConfigurations>
  <Steps>
    <!-- Pipeline steps defined in sequential execution order -->
  </Steps>
</Integration>
```

The pipeline executes steps in declaration order for each record yielded by the primary input element (except when `Reduce` is present, which aggregates all records and passes the final state record to subsequent output steps).

## Step Types & Configuration

### 1. Input Provider Elements
Yields records sequentially into the pipeline.
- **CSV**: `<CsvInput Id="source" FilePath="data/orders.csv" />`
- **SQL**: `<SqlInput Id="source" ConnectionString="Server=...;Database=..." Query="SELECT Id, Customer, Amount FROM Orders" />` (or child `<Query>SELECT ...</Query>`)
- **HTTP**: `<HttpInput Id="source" HttpConfiguration="BillingApi" Endpoint="invoices" JsonPath="$.data.items" HttpMethod="GET" />`
- **JSON file**: `<JsonInput Id="source" FilePath="data/orders.json" JsonPath="$.items" />`
- **XML file**: `<XmlInput Id="source" FilePath="data/orders.xml" XmlItemElement="Order" />`

Each provider element has its own attributes: file readers use `FilePath`; SQL uses `ConnectionString` and optional `Query`; HTTP uses `HttpConfiguration`, `Endpoint`, `HttpMethod`, and `JsonPath`; JSON uses `FilePath` and `JsonPath`; XML uses `FilePath` and `XmlItemElement`. Input elements may also use `MockCsvFilePath` and mock-data child elements as described below.

### 2. `Map` (Record Transformation)
Transforms the incoming record by evaluating a Power Fx worksheet. Each non-empty formula cell becomes a field in the output record matching the cell's `Name`.
- **Referenced Worksheet**: `<Map Id="transform"><Worksheet FilePath="worksheets/order_map.xml" /></Map>`
- **Inline Worksheet**:
  ```xml
  <Map Id="transform">
    <Worksheet>
      <Name>OrderTransform</Name>
      <Cells>
        <WorkCell>
          <Id>1</Id>
          <Name>OrderId</Name>
          <Formula>InputRecord.Id</Formula>
        </WorkCell>
        <WorkCell>
          <Id>2</Id>
          <Name>TotalWithTax</Name>
          <Formula>AddTax(Value(InputRecord.Amount))</Formula>
        </WorkCell>
      </Cells>
    </Worksheet>
  </Map>
  ```

### 3. `Filter` (Record Inclusion / Exclusion)
Evaluates a worksheet expression. The boolean result of the final non-empty formula cell determines whether the record proceeds.
- Attributes: `KeepWhenTrue="true"` (default) keeps matching records; `KeepWhenTrue="false"` discards matching records.
- Example:
  ```xml
  <Filter Id="activeFilter" KeepWhenTrue="true">
    <Worksheet>
      <Name>ActiveOnly</Name>
      <Cells>
        <WorkCell>
          <Id>1</Id>
          <Name>ShouldKeep</Name>
          <Formula>InputRecord.Status = &quot;Active&quot; And Value(InputRecord.Amount) &gt; 0</Formula>
        </WorkCell>
      </Cells>
    </Worksheet>
  </Filter>
  ```

### 4. `Reduce` (Batch Aggregation)
Accumulates state across all input records.
- Attributes / Elements:
  - `InitialStateJson`: Initial accumulator value as JSON (e.g., `0`, `{}`, `{"Count": 0, "Sum": 0}`).
  - `OutputField`: Name of the record field that stores the resulting accumulator value.
  - `Worksheet`: Accesses `State` (previous accumulator value) and `InputRecord`.
- Example:
  ```xml
  <Reduce Id="calculateTotal" OutputField="Summary">
    <InitialStateJson>0</InitialStateJson>
    <Worksheet>
      <Name>SumAmounts</Name>
      <Cells>
        <WorkCell>
          <Id>1</Id>
          <Name>Summary</Name>
          <Formula>State + Value(InputRecord.Amount)</Formula>
        </WorkCell>
      </Cells>
    </Worksheet>
  </Reduce>
  ```

### 5. `Switch` (Conditional Routing)
Evaluates a worksheet for each record and dispatches the record to one or more matching branches.
- Contains a `<Worksheet>` defining boolean cells and one or more `<Branch WorkCell="CellName">` blocks.
- All branches whose referenced `WorkCell` evaluates to `true` will execute in XML declaration order.
- Branches can contain `Map`, `Filter`, `Reduce`, or nested `Switch` steps; input and output provider steps cannot be nested inside a branch.
- Example:
  ```xml
  <Switch Id="routeByRegion">
    <Worksheet>
      <Name>RegionRouter</Name>
      <Cells>
        <WorkCell>
          <Id>1</Id>
          <Name>IsDomestic</Name>
          <Formula>InputRecord.Country = &quot;US&quot;</Formula>
        </WorkCell>
        <WorkCell>
          <Id>2</Id>
          <Name>IsInternational</Name>
          <Formula>InputRecord.Country &lt;&gt; &quot;US&quot;</Formula>
        </WorkCell>
      </Cells>
    </Worksheet>
    <Branch WorkCell="IsDomestic">
      <Map Id="domesticMap">
        <Worksheet FilePath="worksheets/domestic.xml" />
      </Map>
    </Branch>
    <Branch WorkCell="IsInternational">
      <Map Id="internationalMap">
        <Worksheet FilePath="worksheets/intl.xml" />
      </Map>
    </Branch>
  </Switch>
  ```

### 6. Output Provider Elements
Writes the current record to an external sink and appends status metadata (`<step-id>.Status`, `<step-id>.StatusMessage`, `<step-id>.AffectedRows`).
- **CSV**: `<CsvOutput Id="csvSink" FilePath="output/results.csv" />`
- **JSON**: `<JsonOutput Id="jsonSink" FilePath="output/results.json" />`
- **XML**: `<XmlOutput Id="xmlSink" FilePath="output/results.xml" XmlRootElement="Orders" XmlRecordElement="Order" />`
- **SQL**: `<SqlOutput Id="sqlSink" ConnectionString="..." TableName="ProcessedOrders" />` (or with custom `Query="INSERT INTO ..."` or child `<Query>INSERT INTO ...</Query>`)
- **HTTP**: `<HttpOutput Id="httpSink" HttpConfiguration="BillingApi" Endpoint="archive" HttpMethod="POST" PayloadFormat="Json" />`

Each output element accepts only attributes that apply to its provider: file writers use `FilePath`; SQL uses `ConnectionString`, `TableName`, and optional `Query`; HTTP uses `HttpConfiguration`, `Endpoint`, `HttpMethod`, and `PayloadFormat`; XML uses `FilePath`, `XmlRootElement`, and `XmlRecordElement`.

---

## Defining Mock Data for Testing

To safely test integrations without external databases, network calls, or input files, define mock data on input provider elements:

### 1. Inline Mock CSV
```xml
<CsvInput Id="source" FilePath="production/path.csv">
  <MockCsv>
Id,Customer,Amount,Status
101,Acme Corp,250.00,Active
102,Beta LLC,120.50,Inactive
103,Gamma Inc,85.00,Active
  </MockCsv>
</CsvInput>
```

### 2. Named Mock Scenarios
Define multiple scenarios within `<MockDataSources>` for edge-case and volume testing:
```xml
<CsvInput Id="source" FilePath="data.csv">
  <MockDataSources>
    <MockData Name="Standard">
Id,Amount,Status
1,100,Active
2,200,Active
    </MockData>
    <MockData Name="Empty" FilePath="mocks/empty.csv" />
    <MockData Name="TaxExempt">
Id,Amount,Status
3,500,Exempt
    </MockData>
  </MockDataSources>
</CsvInput>
```

### 3. External Mock Files
Use the `MockCsvFilePath` attribute on an input element or `FilePath` attribute on `<MockData>`:
```xml
<CsvInput Id="source" FilePath="data.csv" MockCsvFilePath="testdata/mock_orders.csv" />
```

### 4. HTTP Reader Mock JSON
For `<HttpInput>`, provide mock JSON inline or via file path:
```xml
<HttpInput Id="apiSource" HttpConfiguration="BillingApi" Endpoint="users" JsonPath="$.items">
  <MockData>
    {
      "items": [
        {"id": 1, "name": "Alice", "role": "Admin"},
        {"id": 2, "name": "Bob", "role": "User"}
      ]
    }
  </MockData>
</HttpInput>
```

---

## Verification Using the CLI Tool

The `puppyworkbooks` CLI executable is available directly in the system's PATH.

### Running Integrations in Mock Mode
Run the integration with mock data enabled for all steps or selected steps, and inspect per-step execution with `--debug`:

```powershell
# Run using mock data for all input steps with full debug output
puppyworkbooks path/to/integration.xml --use-mock-data-for-steps ALL --debug

# Run a specific named mock scenario
puppyworkbooks path/to/integration.xml --use-mock-data-for-steps ALL --scenario TaxExempt --debug

# Run using mock data for specific step IDs
puppyworkbooks path/to/integration.xml --use-mock-data-for-steps source --debug
```

### Mock Execution Behavior
- When an input provider step runs under mock mode, it supplies records from its configured inline mock data or mock file.
- When an output provider step runs under mock mode (or when `--use-mock-data-for-steps ALL` is specified), output writing uses an in-memory mock provider so no disk files or remote databases are altered.
- `--debug` outputs formatted JSON showing every step's input record, intermediate cell calculations, and filter/branch evaluation results.
