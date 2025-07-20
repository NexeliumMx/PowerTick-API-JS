/**
 * File: downloads.js
 * Author(s): Andres Gomez
 * Endpoint: GET /api/downloads
 * Brief: Download measurements as CSV for a given powermeter, month, and year.
 * Date: 2025-07-20
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
const { Parser } = require('json2csv');

const ALLOWED_ENVIRONMENTS = ['production', 'demo', 'dev'];
const CSV_CONTENT_TYPE = 'text/csv';
const DEFAULT_SCHEMA = 'public';

const CSV_DATE_FORMAT = 'YYYY-MM-DD';
const CSV_TIME_FORMAT = 'HH24:MI:SS';

const LANGUAGE_EN = 'en';
const LANGUAGE_ES = 'es';
const DEFAULT_LANGUAGE = LANGUAGE_EN;

// Column name mapping for English and Spanish
const COLUMN_ALIASES = {
  [LANGUAGE_EN]: {
    date: 'Date',
    time: 'Time',
    current_total: 'Total Current (A)',
    current_l1: 'Current Phase 1 (A)',
    current_l2: 'Current Phase 2 (A)',
    current_l3: 'Current Phase 3 (A)',
    voltage_ln: 'Line to Neutral Voltage (V)',
    voltage_l1: 'Voltage Phase 1 (V)',
    voltage_l2: 'Voltage Phase 2 (V)',
    voltage_l3: 'Voltage Phase 3 (V)',
    voltage_ll: 'Line to Line Voltage (V)',
    voltage_l1_l2: 'Voltage Line 1 to 2 (V)',
    voltage_l2_l3: 'Voltage Line 2 to 3 (V)',
    voltage_l3_l1: 'Voltage Line 3 to 1 (V)',
    frequency: 'Frequency (Hz)',
    watts: 'Total Demand (W)',
    watts_l1: 'Demand Phase 1 (W)',
    watts_l2: 'Demand Phase 2 (W)',
    watts_l3: 'Demand Phase 3 (W)',
    va: 'Total Apparent Power (VA)',
    va_l1: 'Phase 1 Apparent Power (VA)',
    va_l2: 'Phase 2 Apparent Power (VA)',
    va_l3: 'Phase 3 Apparent Power (VA)',
    var: 'Total Reactive Power (VAr)',
    var_l1: 'Phase 1 Reactive Power (VAr)',
    var_l2: 'Phase 2 Reactive Power (VAr)',
    var_l3: 'Phase 3 Reactive Power (VAr)',
    power_factor: 'Power Factor Total',
    pf_l1: 'Phase 1 Power Factor',
    pf_l2: 'Phase 2 Power Factor',
    pf_l3: 'Phase 3 Power Factor',
    kwh_exported_total: 'Total Exported Energy (kWh)',
    kwh_exported_l1: 'Phase 1 Exported Energy (kWh)',
    kwh_exported_l2: 'Phase 2 Exported Energy (kWh)',
    kwh_exported_l3: 'Phase 3 Exported Energy (kWh)',
    kwh_imported_total: 'Total Energy Consumption (kWh)',
    kwh_imported_l1: 'Phase 1 Energy Consumption (kWh)',
    kwh_imported_l2: 'Phase 2 Energy Consumption (kWh)',
    kwh_imported_l3: 'Phase 3 Energy Consumption (kWh)',
    vah_exported_total: 'Total Apparent Energy Exported (VAh)',
    vah_exported_l1: 'Phase 1 Apparent Energy Exported (VAh)',
    vah_exported_l2: 'Phase 2 Apparent Energy Exported (VAh)',
    vah_exported_l3: 'Phase 3 Apparent Energy Exported (VAh)',
    vah_imported_total: 'Total Apparent Energy Consumption (VAh)',
    vah_imported_l1: 'Phase 1 Apparent Energy Consumption (VAh)',
    vah_imported_l2: 'Phase 1 Apparent Energy Consumption (VAh)',
    vah_imported_l3: 'Phase 1 Apparent Energy Consumption (VAh)',
    varh_imported_q1: 'Total Inductive Energy Consumption (VArh)',
    varh_imported_q1_l1: 'Phase 1 Inductive Energy Consumption (VArh)',
    varh_imported_q1_l2: 'Phase 2 Inductive Energy Consumption (VArh)',
    varh_imported_q1_l3: 'Phase 3 Inductive Energy Consumption (VArh)',
    varh_imported_q2: 'Total Capacitive Energy Consumption (VArh)',
    varh_imported_q2_l1: 'Phase 1 Capacitive Energy Consumption (VArh)',
    varh_imported_q2_l2: 'Phase 2 Capacitive Energy Consumption (VArh)',
    varh_imported_q2_l3: 'Phase 3 Capacitive Energy Consumption (VArh)',
    vah_exported_q3: 'Total Inductive Energy Exported (VArh)',
    vah_exported_q3_l1: 'Phase 1 Inductive Energy Exported (VArh)',
    vah_exported_q3_l2: 'Phase 2 Inductive Energy Exported (VArh)',
    vah_exported_q3_l3: 'Phase 3 Inductive Energy Exported (VArh)',
    varh_exported_q4: 'Total Capacitive Energy Exported (VArh)',
    varh_exported_q4_l1: 'Phase 1 Capacitive Energy Exported (VArh)',
    varh_exported_q4_l2: 'Phase 2 Capacitive Energy Exported (VArh)',
    varh_exported_q4_l3: 'Phase 3 Capacitive Energy Exported (VArh)',
    phase_sequence: 'Phase Sequence',
    current_n: 'Neutral Current (A)',
    thd_current_l1: 'THD Current Phase 1 (%)',
    thd_current_l2: 'THD Current Phase 2 (%)',
    thd_current_l3: 'THD Current Phase 3 (%)',
    thd_voltage_ln: 'THD Voltage Line to Neutral (%)',
    thd_voltage_l1: 'THD Voltage Phase 1 (%)',
    thd_voltage_l2: 'THD Voltage Phase 2 (%)',
    thd_voltage_l3: 'THD Voltage Phase 3 (%)',
    thd_voltage_ll: 'THD Line to Line Voltage (%)',
    thd_voltage_l1_l2: 'THD Voltage Line 1 to 2 (%)',
    thd_voltage_l2_l3: 'THD Voltage Line 2 to 3 (%)',
    thd_voltage_l3_l1: 'THD Voltage Line 3 to 1 (%)',
    kw_dmd_max: 'Max Demand (kW)',
    kw_dmd: 'Demand (kW)',
    va_dmd_max: 'Max Apparent Demand (kW)',
    va_dmd_total: 'Total Apparent Demand (kW)',
    current_dmd_max: 'Max Current (A)',
    varh_imported_total: 'Total Reactive Energy Consumed (VArh)',
    varh_exported_total: 'Total Reactive Energy Exported (VArh)',
  },
  [LANGUAGE_ES]: {
    date: 'Fecha',
    time: 'Hora',
    current_total: 'Corriente Total (A)',
    current_l1: 'Corriente Fase 1 (A)',
    current_l2: 'Corriente Fase 2 (A)',
    current_l3: 'Corriente Fase 3 (A)',
    voltage_ln: 'Voltaje Línea-Neutro (V)',
    voltage_l1: 'Voltaje Fase 1 (V)',
    voltage_l2: 'Voltaje Fase 2 (V)',
    voltage_l3: 'Voltaje Fase 3 (V)',
    voltage_ll: 'Voltaje Línea-Línea (V)',
    voltage_l1_l2: 'Voltaje Línea 1 a 2 (V)',
    voltage_l2_l3: 'Voltaje Línea 2 a 3 (V)',
    voltage_l3_l1: 'Voltaje Línea 3 a 1 (V)',
    frequency: 'Frecuencia (Hz)',
    watts: 'Demanda Total (W)',
    watts_l1: 'Demanda Fase 1 (W)',
    watts_l2: 'Demanda Fase 2 (W)',
    watts_l3: 'Demanda Fase 3 (W)',
    va: 'Potencia Aparente Total (VA)',
    va_l1: 'Potencia Aparente Fase 1 (VA)',
    va_l2: 'Potencia Aparente Fase 2 (VA)',
    va_l3: 'Potencia Aparente Fase 3 (VA)',
    var: 'Potencia Reactiva Total (VAr)',
    var_l1: 'Potencia Reactiva Fase 1 (VAr)',
    var_l2: 'Potencia Reactiva Fase 2 (VAr)',
    var_l3: 'Potencia Reactiva Fase 3 (VAr)',
    power_factor: 'Factor de Potencia Total',
    pf_l1: 'Factor de Potencia Fase 1',
    pf_l2: 'Factor de Potencia Fase 2',
    pf_l3: 'Factor de Potencia Fase 3',
    kwh_exported_total: 'Energía Exportada Total (kWh)',
    kwh_exported_l1: 'Energía Exportada Fase 1 (kWh)',
    kwh_exported_l2: 'Energía Exportada Fase 2 (kWh)',
    kwh_exported_l3: 'Energía Exportada Fase 3 (kWh)',
    kwh_imported_total: 'Consumo Total de Energía (kWh)',
    kwh_imported_l1: 'Consumo Fase 1 de Energía (kWh)',
    kwh_imported_l2: 'Consumo Fase 2 de Energía (kWh)',
    kwh_imported_l3: 'Consumo Fase 3 de Energía (kWh)',
    vah_exported_total: 'Energía Aparente Exportada Total (VAh)',
    vah_exported_l1: 'Energía Aparente Exportada Fase 1 (VAh)',
    vah_exported_l2: 'Energía Aparente Exportada Fase 2 (VAh)',
    vah_exported_l3: 'Energía Aparente Exportada Fase 3 (VAh)',
    vah_imported_total: 'Consumo Total de Energía Aparente (VAh)',
    vah_imported_l1: 'Consumo Fase 1 de Energía Aparente (VAh)',
    vah_imported_l2: 'Consumo Fase 1 de Energía Aparente (VAh)',
    vah_imported_l3: 'Consumo Fase 1 de Energía Aparente (VAh)',
    varh_imported_q1: 'Consumo Total de Energía Inductiva (VArh)',
    varh_imported_q1_l1: 'Consumo Fase 1 de Energía Inductiva (VArh)',
    varh_imported_q1_l2: 'Consumo Fase 2 de Energía Inductiva (VArh)',
    varh_imported_q1_l3: 'Consumo Fase 3 de Energía Inductiva (VArh)',
    varh_imported_q2: 'Consumo Total de Energía Capacitiva (VArh)',
    varh_imported_q2_l1: 'Consumo Fase 1 de Energía Capacitiva (VArh)',
    varh_imported_q2_l2: 'Consumo Fase 2 de Energía Capacitiva (VArh)',
    varh_imported_q2_l3: 'Consumo Fase 3 de Energía Capacitiva (VArh)',
    vah_exported_q3: 'Exportación Total de Energía Inductiva (VArh)',
    vah_exported_q3_l1: 'Exportación Fase 1 de Energía Inductiva (VArh)',
    vah_exported_q3_l2: 'Exportación Fase 2 de Energía Inductiva (VArh)',
    vah_exported_q3_l3: 'Exportación Fase 3 de Energía Inductiva (VArh)',
    varh_exported_q4: 'Exportación Total de Energía Capacitiva (VArh)',
    varh_exported_q4_l1: 'Exportación Fase 1 de Energía Capacitiva (VArh)',
    varh_exported_q4_l2: 'Exportación Fase 2 de Energía Capacitiva (VArh)',
    varh_exported_q4_l3: 'Exportación Fase 3 de Energía Capacitiva (VArh)',
    phase_sequence: 'Secuencia de Fases',
    current_n: 'Corriente Neutro (A)',
    thd_current_l1: 'THD Corriente Fase 1 (%)',
    thd_current_l2: 'THD Corriente Fase 2 (%)',
    thd_current_l3: 'THD Corriente Fase 3 (%)',
    thd_voltage_ln: 'THD Voltaje Línea-Neutro (%)',
    thd_voltage_l1: 'THD Voltaje Fase 1 (%)',
    thd_voltage_l2: 'THD Voltaje Fase 2 (%)',
    thd_voltage_l3: 'THD Voltaje Fase 3 (%)',
    thd_voltage_ll: 'THD Voltaje Línea-Línea (%)',
    thd_voltage_l1_l2: 'THD Voltaje Línea 1 a 2 (%)',
    thd_voltage_l2_l3: 'THD Voltaje Línea 2 a 3 (%)',
    thd_voltage_l3_l1: 'THD Voltaje Línea 3 a 1 (%)',
    kw_dmd_max: 'Demanda Máxima (kW)',
    kw_dmd: 'Demanda (kW)',
    va_dmd_max: 'Demanda Aparente Máxima (kW)',
    va_dmd_total: 'Demanda Aparente Total (kW)',
    current_dmd_max: 'Corriente Máxima (A)',
    varh_imported_total: 'Consumo Total de Energía Reactiva (VArh)',
    varh_exported_total: 'Exportación Total de Energía Reactiva (VArh)',
  },
};
function getColumnSelect(language) {
  const aliases = COLUMN_ALIASES[language] || COLUMN_ALIASES[DEFAULT_LANGUAGE];
  return [
    `m.timestamp::date AS "${aliases.date}"`,
    `TO_CHAR(m.timestamp, '${CSV_TIME_FORMAT}') AS "${aliases.time}"`,
    `m.current_total AS "${aliases.current_total}"`,
    `m.current_l1 AS "${aliases.current_l1}"`,
    `m.current_l2 AS "${aliases.current_l2}"`,
    `m.current_l3 AS "${aliases.current_l3}"`,
    `m.voltage_ln AS "${aliases.voltage_ln}"`,
    `m.voltage_l1 AS "${aliases.voltage_l1}"`,
    `m.voltage_l2 AS "${aliases.voltage_l2}"`,
    `m.voltage_l3 AS "${aliases.voltage_l3}"`,
    `m.voltage_ll AS "${aliases.voltage_ll}"`,
    `m.voltage_l1_l2 AS "${aliases.voltage_l1_l2}"`,
    `m.voltage_l2_l3 AS "${aliases.voltage_l2_l3}"`,
    `m.voltage_l3_l1 AS "${aliases.voltage_l3_l1}"`,
    `m.frequency AS "${aliases.frequency}"`,
    `m.watts AS "${aliases.watts}"`,
    `m.watts_l1 AS "${aliases.watts_l1}"`,
    `m.watts_l2 AS "${aliases.watts_l2}"`,
    `m.watts_l3 AS "${aliases.watts_l3}"`,
    `m.va AS "${aliases.va}"`,
    `m.va_l1 AS "${aliases.va_l1}"`,
    `m.va_l2 AS "${aliases.va_l2}"`,
    `m.va_l3 AS "${aliases.va_l3}"`,
    `m.var AS "${aliases.var}"`,
    `m.var_l1 AS "${aliases.var_l1}"`,
    `m.var_l2 AS "${aliases.var_l2}"`,
    `m.var_l3 AS "${aliases.var_l3}"`,
    `m.power_factor AS "${aliases.power_factor}"`,
    `m.pf_l1 AS "${aliases.pf_l1}"`,
    `m.pf_l2 AS "${aliases.pf_l2}"`,
    `m.pf_l3 AS "${aliases.pf_l3}"`,
    `m.kwh_exported_total AS "${aliases.kwh_exported_total}"`,
    `m.kwh_exported_l1 AS "${aliases.kwh_exported_l1}"`,
    `m.kwh_exported_l2 AS "${aliases.kwh_exported_l2}"`,
    `m.kwh_exported_l3 AS "${aliases.kwh_exported_l3}"`,
    `m.kwh_imported_total AS "${aliases.kwh_imported_total}"`,
    `m.kwh_imported_l1 AS "${aliases.kwh_imported_l1}"`,
    `m.kwh_imported_l2 AS "${aliases.kwh_imported_l2}"`,
    `m.kwh_imported_l3 AS "${aliases.kwh_imported_l3}"`,
    `m.vah_exported_total AS "${aliases.vah_exported_total}"`,
    `m.vah_exported_l1 AS "${aliases.vah_exported_l1}"`,
    `m.vah_exported_l2 AS "${aliases.vah_exported_l2}"`,
    `m.vah_exported_l3 AS "${aliases.vah_exported_l3}"`,
    `m.vah_imported_total AS "${aliases.vah_imported_total}"`,
    `m.vah_imported_l1 AS "${aliases.vah_imported_l1}"`,
    `m.vah_imported_l2 AS "${aliases.vah_imported_l2}"`,
    `m.vah_imported_l3 AS "${aliases.vah_imported_l3}"`,
    `m.varh_imported_q1 AS "${aliases.varh_imported_q1}"`,
    `m.varh_imported_q1_l1 AS "${aliases.varh_imported_q1_l1}"`,
    `m.varh_imported_q1_l2 AS "${aliases.varh_imported_q1_l2}"`,
    `m.varh_imported_q1_l3 AS "${aliases.varh_imported_q1_l3}"`,
    `m.varh_imported_q2 AS "${aliases.varh_imported_q2}"`,
    `m.varh_imported_q2_l1 AS "${aliases.varh_imported_q2_l1}"`,
    `m.varh_imported_q2_l2 AS "${aliases.varh_imported_q2_l2}"`,
    `m.varh_imported_q2_l3 AS "${aliases.varh_imported_q2_l3}"`,
    `m.vah_exported_q3 AS "${aliases.vah_exported_q3}"`,
    `m.vah_exported_q3_l1 AS "${aliases.vah_exported_q3_l1}"`,
    `m.vah_exported_q3_l2 AS "${aliases.vah_exported_q3_l2}"`,
    `m.vah_exported_q3_l3 AS "${aliases.vah_exported_q3_l3}"`,
    `m.varh_exported_q4 AS "${aliases.varh_exported_q4}"`,
    `m.varh_exported_q4_l1 AS "${aliases.varh_exported_q4_l1}"`,
    `m.varh_exported_q4_l2 AS "${aliases.varh_exported_q4_l2}"`,
    `m.varh_exported_q4_l3 AS "${aliases.varh_exported_q4_l3}"`,
    `m.phase_sequence AS "${aliases.phase_sequence}"`,
    `m.current_n AS "${aliases.current_n}"`,
    `m.thd_current_l1 AS "${aliases.thd_current_l1}"`,
    `m.thd_current_l2 AS "${aliases.thd_current_l2}"`,
    `m.thd_current_l3 AS "${aliases.thd_current_l3}"`,
    `m.thd_voltage_ln AS "${aliases.thd_voltage_ln}"`,
    `m.thd_voltage_l1 AS "${aliases.thd_voltage_l1}"`,
    `m.thd_voltage_l2 AS "${aliases.thd_voltage_l2}"`,
    `m.thd_voltage_l3 AS "${aliases.thd_voltage_l3}"`,
    `m.thd_voltage_ll AS "${aliases.thd_voltage_ll}"`,
    `m.thd_voltage_l1_l2 AS "${aliases.thd_voltage_l1_l2}"`,
    `m.thd_voltage_l2_l3 AS "${aliases.thd_voltage_l2_l3}"`,
    `m.thd_voltage_l3_l1 AS "${aliases.thd_voltage_l3_l1}"`,
    `m.kw_dmd_max AS "${aliases.kw_dmd_max}"`,
    `m.kw_dmd AS "${aliases.kw_dmd}"`,
    `m.va_dmd_max AS "${aliases.va_dmd_max}"`,
    `m.va_dmd_total AS "${aliases.va_dmd_total}"`,
    `m.current_dmd_max AS "${aliases.current_dmd_max}"`,
    `m.varh_imported_total AS "${aliases.varh_imported_total}"`,
    `m.varh_exported_total AS "${aliases.varh_exported_total}"`,
  ].join(',\n        ');
}

/**
 * Returns the last day of a given month and year.
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getSchema(env) {
  if (!env || env === 'production') return DEFAULT_SCHEMA;
  if (ALLOWED_ENVIRONMENTS.includes(env)) return env;
  return null;
}

app.http('downloads', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const userId = request.query.get('user_id');
    const powermeterId = Number(request.query.get('powermeter_id'));
    const month = request.query.get('month');
    const year = request.query.get('year');
    const environment = request.query.get('environment');
    const language = (request.query.get('language') || DEFAULT_LANGUAGE).toLowerCase();

    context.log('--- [DEBUG] Incoming parameters ---');
    context.log({ userId, powermeterId, month, year, environment, language });

    if (!userId || !powermeterId || !month || !year) {
      context.log('[DEBUG] Missing required parameters');
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Missing required parameters' }),
      };
    }

    const schema = getSchema(environment);
    context.log('[DEBUG] Using schema:', schema);

    if (!schema) {
      context.log('[DEBUG] Invalid environment parameter');
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Invalid environment parameter' }),
      };
    }

    const FIRST_DAY = 1;
    const lastDay = getLastDayOfMonth(Number(year), Number(month));
    const startDate = `${year}-${month.padStart(2, '0')}-${FIRST_DAY.toString().padStart(2, '0')}`;
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')} 23:59:59`;

    context.log('[DEBUG] Date range:', { startDate, endDate });

    const powermetersTable = `${schema}.powermeters`;
    const measurementsTable = `${schema}.measurements`;
    const userInstallationsTable = `${DEFAULT_SCHEMA}.user_installations`;

    const columnSelect = getColumnSelect(language);

    const query = `
      WITH authorized_powermeter AS (
        SELECT p.powermeter_id
        FROM ${powermetersTable} p
        JOIN ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
        WHERE ui.user_id = $1
          AND p.powermeter_id = $2
      )
      SELECT
        ${columnSelect}
      FROM ${measurementsTable} m
      JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
      WHERE m.timestamp >= $3
        AND m.timestamp < $4
      ORDER BY m.timestamp ASC;
    `;

    const params = [userId, powermeterId, startDate, endDate];

    context.log('[DEBUG] SQL Query:', query);
    context.log('[DEBUG] SQL Params:', params);

    try {
      const client = await getClient();
      const result = await client.query(query, params);
      client.release();

      context.log('[DEBUG] Query result row count:', result.rows.length);

      if (!result.rows || result.rows.length === 0) {
        context.log('[DEBUG] No data found for the specified period.');
        return {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: false, error: 'No data found for the specified period.' }),
        };
      }

      // Convert to CSV
      const parser = new Parser();
      const csv = parser.parse(result.rows);

      context.log('[DEBUG] CSV generated successfully.');

      return {
        status: 200,
        headers: {
          'Content-Type': CSV_CONTENT_TYPE,
          'Content-Disposition': `attachment; filename="powermeter_${powermeterId}_${year}_${month}.csv"`,
          'Access-Control-Allow-Origin': '*',
        },
        body: csv,
      };
    } catch (error) {
      context.log.error('Database error:', error);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Database query failed' }),
      };
    }
  }
});