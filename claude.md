# Fronius Homey App

## Project Overview

Homey application for Fronius solar inverters integration. This app enables connection and monitoring of Fronius equipment (inverters, smartmeters, batteries, etc.) through the Homey home automation platform.

## Technology Stack

- **Platform**: Homey SDK v3
- **Runtime**: Node.js
- **Main Dependencies**:
  - `node-fetch`: HTTP communication with Fronius APIs
  - `node-cron`: Task scheduling for data retrieval
  - `he`: HTML encoding/decoding

## Project Structure

### Available Drivers

1. **Inverter**: Solar inverter (PV power, production, AC/DC voltage/current)
2. **Smartmeter**: Smart meter (current, voltage, frequency, energy)
3. **Ohmpilot**: Consumption regulator (consumption, temperature)
4. **Storage**: Battery storage (capacity, charge, current, voltage)
5. **PowerFlow**: Site energy flow (PV, Grid, Load, Battery)
6. **Reporting**: Reports via DataManager (costs, savings, self-consumption rate)

## Architecture

- `/drivers/`: Contains drivers for each Fronius equipment type
- `/app.js`: Main application entry point
- `/app.json`: Homey application configuration

## Fronius API Integration

The application communicates with local Fronius equipment APIs to retrieve real-time data (solar production, consumption, battery status, etc.).

## Supported Models

- Classic inverters support
- GEN24/Tauro support with specific IDC_x and UDC_x fields
- 3-phase smartmeter support

## Development Tools

### Code Quality

- **Linter**: Biome - Use Biome for code linting and formatting
  - Run linting: `npx biome lint .`
  - Run formatting: `npx biome format .`
  - Apply fixes: `npx biome check --write .`

## Development Notes

- Current version: 0.0.13
- Homey SDK v3
- Local communication with Fronius equipment (no cloud dependency)
