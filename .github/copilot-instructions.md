# Copilot Code Review Instructions for PowerTick-API-JS (Azure Functions API)

## 1. Avoid Magic Numbers

**Description:**  
Do not use magic numbers in code. All numeric literals should be defined as named constants or variables with meaningful names for maintainability and clarity.

**Path patterns:**  
`**/*.js`

---

## 2. Follow JavaScript API Industry Standard Style

**Description:**  
All code must follow the [Airbnb JavaScript Style Guide](https://airbnb.io/javascript/). This includes standards for variable naming, spacing, indentation, ES6+ usage, and best practices for building maintainable JavaScript APIs.

**Path patterns:**  
`**/*.js`

---

## 3. Protect Against SQL Injection

**Description:**  
All code that constructs SQL queries must use parameterized queries or safe query-building libraries to avoid SQL injection vulnerabilities. Never concatenate untrusted user input directly into SQL statements.

**Path patterns:**  
`**/*.js`

---

## 4. All Code and Source Files Must Be in English

**Description:**  
All code, comments, identifiers (such as variable, function, and class names), and documentation must be written in English. Do not use other languages in code, comments, or documentation.

**Path patterns:**  
`**/*.js`, `**/*.md`

---

## 5. Don't use `SELECT *` in SQL queries

**Description:**  
Don't use `SELECT *` in SQL queries. Always specify the columns you want to select. `COUNT(*)` is allowed.

**Path patterns:**  
_Applies to all files (SQL queries may be embedded in code)._

---

## 6. Always Tag Metrics with the Current Environment

**Description:**  
Always include an `env` tag with the current environment when emitting metrics, for example, `env:prod` or `env:dev`. This ensures all metrics are properly scoped for observability across environments.

**Path patterns:**  
`**/*.js`

---