
# PowerTick Node.js API Documentation

## Overview
The PowerTick Node.js API is built with Azure Functions and provides endpoints to monitor and manage powermeter data for multiple locations and clients. This documentation outlines all available endpoints, their purposes, and how to interact with them.

---

## API Endpoints

### Public API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                 |
|------------------------------------------------------|------------|-------------------------------------------------|
| [`/api/supportedModels`](#apisupportedmodels)        | GET        | Retrieve a list of supported powermeter models. |

### Dev API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/powermeter`](#apipowermeter)  | GET, POST  | Retrieve all powermeters in the database.               |
| [`/api/postReading`](#apipostreading)               | POST       | Submit a new reading for a powermeter.                  |




### Demo API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/demoConsumptionHistory`](#apidemoconsumptionhistory)    | GET        | Fetch consumption history for a specific powermeter.    |
| [`/api/demoGetPowerMetersInfo`](#apidemogetpowermetersinfo)    | GET        | Retrieve all powermeters in the database.               |
| [`/api/demoMaxDemand`](#apidemomaxdemand)                     | GET        | Retrieve max demand for a specific powermeter.          |
| [`/api/demoPostReading`](#apidemopostreading)               | POST       | Submit a new reading for a powermeter.                  |
| [`/api/demoPowerDemandHistory`](#apidemopowerdemandhistory)    | GET        | Retrieve power demand history for a powermeter.         |
| [`/api/demoPowerFactorHistory`](#apidemopowerfactorhistory)    | GET        | Retrieve power factor history for a powermeter.         |
| [`/api/demoPowerMeterInfo`](#apidemopowermeterinfo)           | GET        | Retrieve specific information for a powermeter.         |
| [`/api/demoRealtimeData`](#apidemorealtimedata)              | GET        | Retrieve the latest real-time data for a powermeter.    |
| [`/api/demoRegisterNewMeter`](#apidemoregisternewmeter)      | POST       | Register a new powermeter into the database.            |

### Test API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/httpTrigger1`](#apihttptrigger1)             | GET, POST  | Sample trigger for testing.                             |
| [`/api/testDBconnection`](#apitestdbconnection)      | GET        | Test the database connection.                           |

---

## Setup Instructions

### Running the API Locally
1. **Clone the repository**:
   ```bash
   git clone https://github.com/NexeliumMx/PowerTick-API-JS.git
   cd PowerTick-API-JS/
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the Azure Functions runtime**:
   ```bash
   func start
   ```

---

## Usage Examples

### `/api/powermeter`

**Description**: This function serves as an HTTP endpoint to manage powermeters in the database.

It provides:
1. **POST**: Register a new powermeter.
2. **GET**: Retrieve a powermeter by serial number.

---

### POST: Register a new powermeter

Register a new powermeter in the database. The payload must include a valid set of fields.

**Example**:
```bash
curl -i -X POST https://power-tick-api-js.nexelium.mx/api/powermeter \
-H "Content-Type: application/json" \
-d '{
    "serial_number": "DEV0000010",
    "model": "Accurev1335",
    "thd_enable": "1"
}'
```

**Expected Responses**:
1. **Success**:
    ```json
    HTTP 200
    {
        "message": "Powermeter DEV0000010 was registered successfully in dev.powermeters."
    }
    ```

2. **Invalid Field(s)**:
    ```json
    HTTP 400
    {
        "error": "Invalid variable names detected.",
        "invalidKeys": ["invalid_field"],
        "validKeys": [
            "client_id", "serial_number", "manufacturer", "series", "model",
            "firmware_v", "branch", "location", "coordinates", "load_center",
            "register_date", "facturation_interval_months", "facturation_day",
            "time_zone", "device_address", "ct", "vt", "thd_enable"
        ]
    }
    ```

3. **Database Error (e.g., duplicate key)**:
    ```json
    HTTP 500
    {
        "error": "duplicate key value violates unique constraint "powermeters_pkey""
    }
    ```

---

### GET: Retrieve a powermeter by serial number

Retrieve a powermeter by its serial number (`sn` query parameter).

**Example**:
```bash
curl -X GET https://power-tick-api-js.nexelium.mx/api/powermeter?sn=DEV0000010
```

**Expected Responses**:
1. **Success**:
    ```json
    HTTP 200
    {
        "serial_number": "DEV0000010",
        "model": "Accurev1335",
        "thd_enable": "1",
        ...
    }
    ```

2. **Missing `sn` Parameter**:
    ```json
    HTTP 400
    {
        "error": "Missing required query parameter: sn"
    }
    ```

3. **No Matching Powermeter**:
    ```json
    HTTP 404
    {
        "error": "No powermeter found with serial number: DEV9999999"
    }
    ```

4. **Database Error**:
    ```json
    HTTP 500
    {
        "error": "<database error message>"
    }
    ```

---

### `/api/postReading`

**Description**: Submit a new reading for a powermeter.

**Example**:

- **Insert a new powermeter reading**:
  ```bash
  curl -X POST "https://power-tick-api-js.nexelium.mx/api/postReading"   -H "Content-Type: application/json"   -d '{
      "timestamp": "2024-11-21T19:20:00.000Z",
      "serial_number": "DEMO0000001",
      "amps_total": 1182,
      "amps_phase_a": 170,
      "amps_phase_b": 490,
      "amps_phase_c": 522,
      "voltage_ln_average": 126
  }'
  ```

---

### `/api/demoConsumptionHistory`

**Description**: Fetch consumption history for a specific powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoGetPowerMetersInfo`

**Description**: Retrieve all powermeters in the database.

**Example**:

- **Retrieve all powermeter data**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoGetPowerMetersInfo"
  ```

---

### `/api/demoMaxDemand`

**Description**: Retrieve max demand for a specific powermeter.

**Examples**:

- **Query for the past day**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoMaxDemand?sn=DEMO0000001&time=day"
  ```

- **Query for the past month**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoMaxDemand?sn=DEMO0000001&time=month"
  ```

---

### `/api/demoPostReading`

**Description**: Submit a new reading for a powermeter.

**Example**:

- **Insert a new powermeter reading**:
  ```bash
  curl -X POST "https://power-tick-api-js.nexelium.mx/api/demoPostReading"   -H "Content-Type: application/json"   -d '{
      "timestamp": "2024-11-21T19:20:00.000Z",
      "serial_number": "DEMO0000001",
      "amps_total": 1182,
      "amps_phase_a": 170,
      "amps_phase_b": 490,
      "amps_phase_c": 522,
      "voltage_ln_average": 126
  }'
  ```

---

### `/api/demoPowerDemandHistory`

**Description**: Retrieve power demand history for a powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoPowerDemandHistory?sn=DEMO0000001&time=hour"
  ```

---

### `/api/demoPowerFactorHistory`

**Description**: Retrieve power factor history for a powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoPowerFactorHistory?sn=DEMO0000001&time=hour"
  ```

---

### `/api/demoPowerMeterInfo`

**Description**: Retrieve specific information for a powermeter.

**Example**:

- **Query specific powermeter info**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoPowerMeterInfo?sn=DEMO0000001"
  ```

---

### `/api/demoRealtimeData`

**Description**: Retrieve the latest real-time data for a powermeter.

**Example**:

- **Query real-time data**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/demoRealtimeData?sn=DEMO0000001"
  ```

---

### `/api/demoRegisterNewMeter`

**Description**: Register a new powermeter into the database.

**Example**:

- **Register a new powermeter**:
  ```bash
  curl -X POST "https://power-tick-api-js.nexelium.mx/api/demoRegisterNewMeter"   -H "Content-Type: application/json"   -d '{ 
      "serial_number": "DEMO0000013",
      "model": "Accurev1335"
  }'
  ```

---

### `/api/httpTrigger1`

**Description**: Sample trigger for testing.

**Examples**:

- **Invoke the sample trigger**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/httpTrigger1"
  ```

---

### `/api/testDBconnection`

**Description**: Test the database connection.

**Examples**:

- **Test the database connection**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/testDBconnection"
  ```

### `/api/supportedModels`

**Description**: Retrieve a list of supported powermeter models.

**Example**:

- **Retrieve supported models**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/supportedModels"
  ```

---

### `/api/registerNewMeter`

**Description**: Register a new powermeter into the database.

**Example**:

- **Register a new powermeter**:
  ```bash
  curl -X POST "https://power-tick-api-js.nexelium.mx/api/registerNewMeter"   -H "Content-Type: application/json"   -d '{ 
      "serial_number": "DEV0000004",
      "model": "Accurev1335"
  }'
  ```

---

### `/api/powerMeterInfo`

**Description**: Retrieve specific information for a powermeter.

**Example**:

- **Query specific powermeter info**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/powerMeterInfo?sn=DEV0000001"
  ```

---