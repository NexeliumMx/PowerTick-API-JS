
# PowerTick Node.js API Documentation

## Overview
The PowerTick Node.js API is built with Azure Functions and provides endpoints to monitor and manage powermeter data for multiple locations and clients. This documentation outlines all available endpoints, their purposes, and how to interact with them.

---

## API Endpoints

### Demo API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/demoConsumptionHistory`](#api/demoConsumptionHistory)    | GET        | Fetch consumption history for a specific powermeter.    |
| [`/api/demoGetPowerMetersInfo`](#api/demoGetPowerMetersInfo---get)    | GET        | Retrieve all powermeters in the database.               |
| [`/api/demoPostReading`](#api/demoPostReading---post)               | POST       | Submit a new reading for a powermeter.                  |
| [`/api/demoPowerDemandHistory`](#api/demoPowerDemandHistory---get)    | GET        | Retrieve power demand history for a powermeter.         |
| [`/api/demoPowerFactorHistory`](#api/demoPowerFactorHistory---get)    | GET        | Retrieve power factor history for a powermeter.         |
| [`/api/demoRealtimeData`](#api/demoRealtimeData---get)              | GET        | Retrieve the latest real-time data for a powermeter.    |
| [`/api/demoRegisterNewMeter`](#api/demoRegisterNewMeter---post)      | POST       | Register a new powermeter into the database.            |
| [`/api/demoMaxDemand`](#api/demoMaxDemand---get)                     | GET        | Retrieve max demand for a specific powermeter.          |
| [`/api/demoPowermeterInfo`](#api/demoPowermeterInfo---get)           | GET        | Retrieve specific information for a powermeter.         |

### Public API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                 |
|------------------------------------------------------|------------|-------------------------------------------------|
| [`/api/supportedModels`](#api/supportedModels---get) | GET        | Retrieve a list of supported powermeter models. |

### Dev API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/getPowerMetersInfo`](#api/getPowerMetersInfo---get)         | GET        | Retrieve all powermeters in the database.               |
| [`/api/postReading`](#api/postReading---post)                     | POST       | Submit a new reading for a powermeter.                  |
| [`/api/registerNewMeter`](#api/registerNewMeter---post)           | POST       | Register a new powermeter into the database.            |
| [`/api/powerMeterInfo`](#api/powerMeterInfo---get)                 | GET        | Retrieve specific information for a powermeter.         |

### Test API Endpoints

| **Endpoint**                                         | **Method** | **Description**                                         |
|------------------------------------------------------|------------|---------------------------------------------------------|
| [`/api/httpTrigger1`](#api/httpTrigger1---get-post)  | GET, POST  | Sample trigger for testing.                             |
| [`/api/testDBconnection`](#api/testDBconnection---get)             | GET        | Test the database connection.                           |

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

### `/api/demoConsumptionHistory` - GET

**Description**: Fetch consumption history for a specific powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoConsumptionHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoConsumptionHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoGetPowerMetersInfo` - GET

**Description**: Retrieve all powermeters in the database.

**Example**:

- **Retrieve all powermeter data**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoGetPowerMetersInfo"
  ```

---

### `/api/demoPostReading` - POST

**Description**: Submit a new reading for a powermeter.

**Example**:

- **Insert a new powermeter reading**:
  ```bash
  curl -X POST "https://powertick-api-js.azurewebsites.net/api/demoPostReading"   -H "Content-Type: application/json"   -d '{
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

### `/api/demoPowerDemandHistory` - GET

**Description**: Retrieve power demand history for a powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoPowerDemandHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoPowerDemandHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoPowerFactorHistory` - GET

**Description**: Retrieve power factor history for a powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoPowerFactorHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoPowerFactorHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoRealtimeData` - GET

**Description**: Retrieve the latest real-time data for a powermeter.

**Example**:

- **Query real-time data**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoRealtimeData?sn=DEMO0000001"
  ```

---

### `/api/demoRegisterNewMeter` - POST

**Description**: Register a new powermeter into the database.

**Example**:

- **Register a new meter**:
  ```bash
  curl -X POST "https://powertick-api-js.azurewebsites.net/api/demoRegisterNewMeter"   -H "Content-Type: application/json"   -d '{ 
      "serial_number": "DEMO0000010",
      "manufacturer": "AccurEnergy",
      "series": "Accurev1330",
      "model": "Accurev1335",
      "firmware_v": "321"
  }'
  ```

---

### `/api/demoMaxDemand` - GET

**Description**: Retrieve max demand for a specific powermeter.

**Examples**:

- **Query for the past day**:
  ```bash
  curl -X GET "https://powertick-api-js.azurewebsites.net/api/demoMaxDemand?sn=DEMO0000003&time=day"
  ```