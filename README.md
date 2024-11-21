
# PowerTick Node.js API Documentation

## Overview
The PowerTIC API is built with Azure Functions and provides endpoints to monitor and manage powermeter data for multiple locations and clients. This documentation outlines all available endpoints, their purposes, and how to interact with them.

---

## Demo API Endpoints

| **Endpoint**                     | **Method** | **Description**                                         |
|----------------------------------|------------|---------------------------------------------------------|
| `/api/demoConsumptionHistory`    | GET        | Fetch consumption history for a specific powermeter.    |
| `/api/demoGetPowerMetersInfo`    | GET        | Retrieve all powermeters in the database.               |
| `/api/demoPostReading`           | POST       | Submit a new reading for a powermeter.                  |
| `/api/demoPowerDemandHistory`    | GET        | Retrieve power demand history for a powermeter.         |
| `/api/demoPowerFactorHistory`    | GET        | Retrieve power factor history for a powermeter.         |
| `/api/demoRealtimeData`          | GET        | Retrieve the latest real-time data for a powermeter.    |
| `/api/demoRegisterNewMeter`      | POST       | Register a new powermeter into the database.            |

## Public API Endpoints

| **Endpoint**           | **Method** | **Description**                                 |
|------------------------|------------|-------------------------------------------------|
| `/api/supportedModels` | GET        | Retrieve a list of supported powermeter models. |

## Dev API Endpoints

| **Endpoint**              | **Method** | **Description**                                         |
|---------------------------|------------|---------------------------------------------------------|
| `/api/getPowerMetersInfo` | GET        | Retrieve all powermeters in the database.               |
| `/api/postReading`        | POST       | Submit a new reading for a powermeter.                  |
| `/api/registerNewMeter`   | POST       | Register a new powermeter into the database.            |

## Test API Endpoints

| **Endpoint**            | **Method** | **Description**                                         |
|-------------------------|------------|---------------------------------------------------------|
| `/api/httpTrigger1`     | GET, POST  | Sample trigger for testing.                             |
| `/api/testDBconnection` | GET        | Test the database connection.                           |

---

## Setup Instructions

### Running the API Locally
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/powertic-api.git
   cd powertic-api
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

Below are examples of how to interact with each API endpoint using `curl`.

### `/api/demoConsumptionHistory` - GET

**Description**: Fetch consumption history for a specific powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoConsumptionHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoConsumptionHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoGetPowerMetersInfo` - GET

**Description**: Retrieve all powermeters in the database.

**Example**:

- **Retrieve all powermeter data**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoGetPowerMetersInfo"
  ```

---

### `/api/demoPostReading` - POST

**Description**: Submit a new reading for a powermeter.

**Example**:

- **Insert a new powermeter reading**:
  ```bash
  curl -X POST "http://localhost:7071/api/demoPostReading"   -H "Content-Type: application/json"   -d '{
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
  curl -X GET "http://localhost:7071/api/demoPowerDemandHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoPowerDemandHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoPowerFactorHistory` - GET

**Description**: Retrieve power factor history for a powermeter.

**Examples**:

- **Query for the past hour**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoPowerFactorHistory?sn=DEMO0000001&time=hour"
  ```

- **Query for the past year**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoPowerFactorHistory?sn=DEMO0000001&time=year"
  ```

---

### `/api/demoRealtimeData` - GET

**Description**: Retrieve the latest real-time data for a powermeter.

**Example**:

- **Query real-time data**:
  ```bash
  curl -X GET "http://localhost:7071/api/demoRealtimeData?sn=DEMO0000001"
  ```

---

### `/api/demoRegisterNewMeter` - POST

**Description**: Register a new powermeter into the database.

**Example**:

- **Register a new meter**:
  ```bash
  curl -X POST "http://localhost:7071/api/demoRegisterNewMeter"   -H "Content-Type: application/json"   -d '{ 
      "serial_number": "DEMO0000010",
      "manufacturer": "AccurEnergy",
      "series": "Accurev1330",
      "model": "Accurev1335",
      "firmware_v": "321"
  }'
  ```

---

### `/api/supportedModels` - GET

**Description**: Retrieve a list of supported powermeter models.

**Example**:

- **Query supported models**:
  ```bash
  curl -X GET "http://localhost:7071/api/supportedModels"
  ```

---

### `/api/testDBconnection` - GET

**Description**: Test the database connection.

**Example**:

- **Test database connection**:
  ```bash
  curl -X GET "http://localhost:7071/api/testDBconnection"
  ```

---

### `/api/httpTrigger1` - GET, POST

**Description**: Sample trigger for testing.

**Example**:

- **Invoke the sample trigger**:
  ```bash
  curl -X GET "http://localhost:7071/api/httpTrigger1"
  ```
  or
  ```bash
  curl -X POST "http://localhost:7071/api/httpTrigger1"   -H "Content-Type: application/json"   -d '{ "sampleData": "test" }'
  ```

---

Feel free to modify the example serial numbers, timestamps, and other parameters as needed for testing purposes.
