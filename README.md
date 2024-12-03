
# PowerTick Node.js API Documentation

## Overview
The PowerTick Node.js API is built with Azure Functions and provides endpoints to monitor and manage powermeter data for multiple locations and clients. This documentation outlines all available endpoints, their purposes, and how to interact with them.

---

## API Endpoints

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

### Public API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                 |
|------------------------------------------------------|------------|-------------------------------------------------|
| [`/api/supportedModels`](#apisupportedmodels)        | GET        | Retrieve a list of supported powermeter models. |

### Dev API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/getPowerMetersInfo`](#apigetpowermetersinfo)  | GET        | Retrieve all powermeters in the database.               |
| [`/api/postReading`](#apipostreading)               | POST       | Submit a new reading for a powermeter.                  |
| [`/api/registerNewMeter`](#apiregisternewmeter)      | POST       | Register a new powermeter into the database.            |
| [`/api/powerMeterInfo`](#apipowermeterinfo)          | GET        | Retrieve specific information for a powermeter.         |

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

### `/api/getPowerMetersInfo`

**Description**: Retrieve all powermeters in the database.

**Example**:

- **Retrieve all powermeter data**:
  ```bash
  curl -X GET "https://power-tick-api-js.nexelium.mx/api/getPowerMetersInfo"
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