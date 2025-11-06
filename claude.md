# Fronius Homey App

## Project Overview

Homey application for Fronius solar inverters integration. This app enables connection and monitoring of Fronius equipment (inverters, smartmeters, batteries, etc.) through the Homey home automation platform.

The app communicates **locally** with Fronius equipment through their REST APIs - no cloud dependency required.

## Technology Stack

- **Platform**: Homey SDK v3 (minimum compatibility: >=12.3.0)
- **Runtime**: Node.js with ES modules
- **Package Type**: ESM (type: "module" in package.json)
- **Main Dependencies**:
  - `node-fetch`: HTTP communication with Fronius APIs
  - `node-cron`: Task scheduling for data retrieval (every 5 minutes by default)
  - `he`: HTML encoding/decoding for API responses

## Project Structure

```
/
├── app.js                  # Main application entry point (Homey.App class)
├── app.json                # Generated from .homeycompose/app.json
├── .homeycompose/          # Source files for app configuration
│   ├── app.json            # Main app metadata and configuration
│   └── ...
├── lib/
│   └── device.js           # Base FroniusDevice class with common polling logic
└── drivers/                # Device drivers (one per equipment type)
    ├── inverter/           # Solar inverter driver
    ├── smartmeter/         # Smart meter driver
    ├── ohmpilot/           # Ohmpilot consumption regulator driver
    ├── storage/            # Battery storage driver
    ├── fronius-powerflow/  # Site energy flow driver
    ├── reporting/          # DataManager reporting driver
    └── GEN24-storage/      # (Deprecated) GEN24 specific storage
```

## Available Drivers

### 1. Inverter (`/drivers/inverter/`)
Monitors Fronius solar inverters (classic and GEN24/Tauro models).

**Capabilities**:
- `measure_power`: Current PV power generation
- `meter_power`: Daily energy production (kWh)
- `meter_power.YEAR`: Yearly energy production (kWh)
- `meter_power.TOTAL`: Total lifetime energy production (kWh)
- `measure_current.AC`: AC current
- `measure_voltage.AC`: AC voltage
- `measure_current.DC`: DC current (classic models)
- `measure_voltage.DC`: DC voltage (classic models)
- `measure_current.DC1-4`: DC current per MPPT (GEN24/Tauro)
- `measure_voltage.DC1-4`: DC voltage per MPPT (GEN24/Tauro)
- `measure_frequency`: Grid frequency

**API Endpoint**: `/solar_api/v1/GetInverterRealtimeData.cgi?DataCollection=CommonInverterData`

**Settings**:
- `DT`: Device Type (0=Classic, 1=GEN24/Tauro)
- `MPPTnumber`: Number of MPPT trackers (1-4, only for GEN24/Tauro)

**Special Behavior**:
- Dynamically adds/removes DC capabilities based on MPPT count
- GEN24/Tauro models use `IDC_x` and `UDC_x` fields instead of single DC values
- Automatically migrates capabilities when device type changes

### 2. Smartmeter (`/drivers/smartmeter/`)
Monitors Fronius Smart Meter for grid connection data.

**Capabilities**:
- Single-phase: voltage, current, power, frequency, energy
- 3-phase: separate L1/L2/L3 measurements for current and voltage
- Energy metrics: production, consumption, import, export

**API Endpoint**: `/solar_api/v1/GetMeterRealtimeData.cgi`

**Known Issues**:
- 3-phase support requires dynamic capability addition (v0.1.11+)
- GEN24 smartmeter compatibility issues (workaround in v0.0.10)

### 3. Ohmpilot (`/drivers/ohmpilot/`)
Monitors Fronius Ohmpilot hot water heater controller.

**Capabilities**:
- `measure_power`: Current consumption
- `measure_temperature`: Temperature reading

### 4. Storage (`/drivers/storage/`)
Monitors battery storage systems.

**Capabilities**:
- Battery capacity and charge level
- Current and voltage measurements
- Charge/discharge power

### 5. PowerFlow (`/drivers/fronius-powerflow/`)
Provides site-wide energy flow overview.

**Capabilities**:
- PV production
- Grid import/export
- Load consumption
- Battery charge/discharge
- Self-consumption metrics

**API Endpoint**: `/solar_api/v1/GetPowerFlowRealtimeData.fcgi`

### 6. Reporting (`/drivers/reporting/`)
Historical data and statistics via DataManager archive.

**Metrics**:
- Costs and savings
- Self-consumption rate
- Monthly/yearly comparisons

**API Endpoint**: DataManager archive endpoints

## Architecture Patterns

### Base Device Class
All drivers extend `FroniusDevice` from `/lib/device.js`:

```javascript
class FroniusDevice extends Homey.Device {
  // Common polling mechanism (every 5 minutes)
  // Error handling and logging
  // API communication helpers
}
```

### Polling Mechanism
- Uses event-driven polling with `addListener('poll', this.pollDevice)`
- Default interval: 5 minutes (configured via `node-cron`)
- Each device manages its own polling lifecycle

### Dynamic Capabilities
Drivers dynamically add/remove capabilities based on:
- Hardware configuration (MPPT count, phases)
- Device type (Classic vs GEN24/Tauro)
- Firmware version compatibility

Example from Inverter:
```javascript
// Add frequency capability if missing (migration from v0.1.5)
if (!this.hasCapability('measure_frequency')) {
  this.addCapability('measure_frequency');
}

// Add/remove MPPT capabilities based on settings
for (let i = 2; i <= mppt; i++) {
  if (!this.hasCapability(`measure_voltage.DC${i}`))
    this.addCapability(`measure_voltage.DC${i}`);
}
```

## Fronius API Integration

### Base URL Structure
```
http://{device_ip}/solar_api/v1/{endpoint}
```

### Common Endpoints
- **Inverter Data**: `/GetInverterRealtimeData.cgi?Scope=Device&DeviceId={id}&DataCollection=CommonInverterData`
- **Meter Data**: `/GetMeterRealtimeData.cgi?Scope=Device&DeviceId={id}`
- **PowerFlow**: `/GetPowerFlowRealtimeData.fcgi`
- **Archive**: `/GetArchiveData.cgi` (for Reporting)

### Authentication
- Local network access only (no authentication required)
- Requires Fronius device to be on same network as Homey

### Data Format
Responses are JSON with structure:
```json
{
  "Head": {
    "RequestArguments": {},
    "Status": { "Code": 0, "Reason": "", "UserMessage": "" }
  },
  "Body": {
    "Data": {
      // Device-specific data fields
      "PAC": { "Value": 2500, "Unit": "W" },
      "DAY_ENERGY": { "Value": 15000, "Unit": "Wh" }
    }
  }
}
```

## Supported Models

### Classic Inverters
- Single MPPT tracker
- Uses `IDC` and `UDC` fields
- Full support for all capabilities

### GEN24/Tauro Models
- Multiple MPPT trackers (1-4)
- Uses `IDC_1`, `IDC_2`, `UDC_1`, `UDC_2` etc.
- Setting `DT=1` enables GEN24 mode
- Some capabilities not available (removed on init)

### Smartmeters
- Single-phase and 3-phase support
- Automatic phase detection
- GEN24 compatibility workarounds

## Common Issues and Solutions

### Issue #1: 3-Phase Smartmeter Not Showing All Phases
**Symptom**: Only single-phase data visible
**Cause**: 3-phase capabilities not added automatically
**Solution**: App automatically detects and adds L1/L2/L3 capabilities (v0.1.11+)
**Code**: Check `smartmeter/device.js` for phase detection logic

### Issue #2: GEN24 Smartmeter Compatibility
**Symptom**: Smartmeter not working on GEN24 inverters
**Workaround**: Implemented in v0.0.10
**Code**: See `smartmeter/device.js` for GEN24-specific handling

### Issue #3: Missing DC Voltage/Current on GEN24
**Symptom**: DC values not showing
**Cause**: GEN24 uses different field names (`IDC_x` vs `IDC`)
**Solution**: Set `DT=1` and configure `MPPTnumber` in settings
**Code**: See `inverter/device.js` lines 19-51

### Issue #4: Empty Data with UUID
**Symptom**: Device shows no data
**Fix**: Implemented in v0.1.9
**Code**: Check UUID handling in device initialization

### Issue #5: Reporting Not Working at Month Start
**Symptom**: No data shown at beginning of month
**Fix**: Implemented in v0.0.12
**Code**: Check date handling in `reporting/device.js`

## Development Guidelines

### Code Quality Tools

**Linter**: Biome (replaces ESLint)
```bash
npx biome lint .          # Check for issues
npx biome format .        # Check formatting
npx biome check --write . # Fix issues automatically
```

**Testing**:
- Test with both Classic and GEN24 inverters
- Verify 3-phase smartmeter functionality
- Check capability migration on app updates

### Adding a New Driver

1. Create directory in `/drivers/{driver-name}/`
2. Extend `FroniusDevice` base class
3. Implement required methods:
   - `getUpdatePath()`: API endpoint
   - `updateValues(data)`: Parse and set capabilities
4. Add driver configuration to `.homeycompose/`
5. Test polling and capability management

### Code Style

- **ES Modules**: Use `import`/`export` syntax
- **Async/Await**: Prefer over promises/callbacks
- **Error Handling**: Always catch and log errors
- **Logging**: Use `this.log()` and `this.error()`
- **Capabilities**: Use `this.setCapabilityValue()`
- **Settings**: Access via `this.getSetting()`

### Git Workflow

- **Main Branch**: `main`
- **Feature Branches**: Use descriptive names
- **Commits**: Clear messages explaining changes
- **PRs**: Include version history update in README.md

## Version Management

Current version: **0.1.17** (from app.json)

### Version History Pattern
- Update `README.md` with version notes
- Increment version in `.homeycompose/app.json`
- Run `homey app build` to regenerate `app.json`

### Breaking Changes Checklist
- Test capability migrations
- Verify backward compatibility
- Update CLAUDE.md if API changes

## Testing Checklist

### Before Release
- [ ] Test with Classic inverter
- [ ] Test with GEN24/Tauro inverter
- [ ] Verify 3-phase smartmeter
- [ ] Check capability migrations
- [ ] Run Biome linting
- [ ] Test on Homey firmware >=12.3.0

### Common Test Scenarios
1. Fresh installation
2. Update from previous version
3. Settings changes (MPPT count, device type)
4. Network connectivity loss/recovery
5. API endpoint failures

## GitHub Actions Integration

### Workflow: Issue Response
When new issues are created, Claude will:
1. Analyze the issue description and title
2. Check if it matches known issues (see Common Issues section)
3. Determine if it's:
   - **User Support**: Configuration or usage question
   - **Bug Report**: Actual code issue
   - **Feature Request**: Enhancement suggestion
   - **Not Relevant**: Spam or off-topic
4. Respond accordingly:
   - Provide solution if known issue
   - Ask clarifying questions if ambiguous
   - Acknowledge and triage if valid bug/feature
   - Close if not relevant

### Context for Claude (Issue Analysis)

**When analyzing issues, check for**:
- Fronius equipment model mentioned
- Homey firmware version
- Error messages or logs
- Steps to reproduce
- Expected vs actual behavior

**Common keywords indicating known issues**:
- "3-phase" / "L1 L2 L3" → Issue #1
- "GEN24" + "smartmeter" → Issue #2
- "DC voltage" + "GEN24" → Issue #3
- "no data" / "empty" → Issue #4
- "beginning of month" + "reporting" → Issue #5

**Response templates**:
- Known issue: Link to solution, reference version where fixed
- Need info: Ask for Fronius model, Homey version, logs
- Bug confirmation: Thank user, create TODO for investigation
- Feature request: Acknowledge, ask for use case details

### Workflow: Code Review
Automated PR reviews check for:
- Biome linting compliance
- Capability management patterns
- Error handling
- API endpoint usage
- Backward compatibility

## Resources

- **Homey SDK Docs**: https://apps.developer.homey.app/
- **Fronius API Docs**: Available from Fronius device web interface
- **App Store**: https://homey.app/a/com.thomashoussin.fronius/
- **Issues**: https://github.com/ThomasHoussin/com.thomashoussin.fronius/issues
- **Donations**: PayPal (thomashoussin958) or GitHub Sponsors (@ThomasHoussin)
