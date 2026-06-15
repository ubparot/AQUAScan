# AquaScan Nationals Portfolio Update

## Detailed Text Draft and Integration Guide

This document provides detailed text for updating the AquaScan Engineering Design portfolio for TSA Nationals. It is designed to supplement the States portfolio while clearly showing the engineering work completed after States. The strongest approach is to preserve the original Unity-based material as evidence of the earlier prototype, then explain how the team identified limitations, developed refinements, implemented a browser-based field system, strengthened the embedded communications chain, and created MARIS as an experimental predictive-analysis model.

The update should not imply that the original system was unsuccessful. The Unity system was an important development stage because it demonstrated the core mission-control and data-visualization concepts. The transition to a web-based system should be presented as a response to real field-use limitations discovered through continued development.

The following sections are written in a detailed, judge-scannable format. The text uses short paragraphs, numbered sections, and bullets with bold lead-ins so judges can quickly identify the problem, engineering decision, implementation, evidence, result, and remaining limitations.

---

# 1. Nationals Development Update

## Development Beyond the States Prototype

AquaScan continued to develop after the TSA States submission. The States portfolio documented a functioning prototype that combined a mobile vessel, deployable multi-sensor probe, Unity-based operator interface, GPS-tagged sensor records, and digital data visualization. This version proved the main engineering concept: a mobile platform could travel through a water body, deploy a probe below the surface, collect water-quality measurements, connect those readings to location and depth, and organize the results for later analysis.

After States, the team reviewed the prototype as an integrated scientific instrument rather than treating it as a completed competition model. This review identified several opportunities to improve field usability, communications reliability, diagnostic visibility, operator safety, mission organization, and the scientific usefulness of the collected data.

The resulting Nationals development cycle focused on four major areas:

- **Operator-interface accessibility:** The Unity interface demonstrated the software concept, but it required a dedicated Unity application on the operator computer. The team developed a browser-based dashboard that can run locally and be opened from compatible devices on the same network.
- **Embedded communication reliability:** The communication chain was refined to separate high-level network commands, motor control, and probe sensor traffic. The current design uses WebSocket communication, an ESP32, an Arduino Mega, a hardware UART control bridge, and a separate RS-485 probe bus.
- **System visibility and safety:** The updated interface displays control state, telemetry, motor outputs, sensor readings, connection status, and alerts. Safety behavior includes a disarmed startup state, neutral motor output during communication loss, and a visible latched emergency stop.
- **Predictive data analysis:** The team developed MARIS, an experimental machine-learning model that demonstrates how future AquaScan missions could forecast dissolved oxygen and identify potential bloom or anomaly risks.

## Post-States Development Sequence

### Stage 1: States Baseline

**Engineering goal:** Prove that the complete AquaScan concept could function as one integrated system.

**Implemented system:** The States prototype combined a physical vessel, deployable probe, water-quality sensors, manual control, Unity-based mission visualization, GPS-tagged data, and CSV/JSON mission records.

**Result:** The system demonstrated that AquaScan could collect and communicate location-based and depth-aware water-quality information.

### Stage 2: Field-Access Refinement

**Engineering goal:** Reduce setup friction and make the operator controls easier to access on different field devices.

**Implemented refinement:** The team rebuilt the primary mission-control interface as a browser-based React and Vite application.

**Result:** The updated dashboard supports mission loading, route visualization, direct vessel control, mission planning, project saving, and system-status displays without requiring the Unity application on the operator device.

### Stage 3: Control-Chain Refinement

**Engineering goal:** Improve communication reliability and make the state of the physical system easier to inspect.

**Implemented refinement:** The team separated the system into dedicated communication layers:

- Browser dashboard to ESP32 through WebSocket communication
- ESP32 to Arduino Mega through a full-duplex hardware UART bridge
- Arduino Mega to the probe through a separate half-duplex RS-485 sensor bus
- Arduino Mega to the ESCs and winch through direct real-time output control

**Result:** The system now provides clearer separation between operator commands, actuator control, and probe telemetry. This makes communication problems easier to identify and reduces interference between different tasks.

### Stage 4: Data-Use Refinement

**Engineering goal:** Expand AquaScan from a system that displays past measurements into a platform that can explore predictive scientific uses.

**Implemented refinement:** The team developed MARIS, a first-pass multi-task machine-learning pipeline that trains from AquaScan mission data and exports a portable ONNX model.

**Result:** MARIS demonstrates a future path for dissolved-oxygen forecasting, bloom-risk estimation, and anomaly detection while clearly documenting that additional field data and validation are still required.

### Stage 5: Verification

**Engineering goal:** Verify that the updated software and machine-learning pipeline perform consistently.

**Verified June 14, 2026:**

- **Web application tests:** 26 automated tests passed.
- **Production build:** The web application completed a production build successfully.
- **Code-quality check:** The web application completed lint checks without errors.
- **Machine-learning tests:** 7 automated tests passed.
- **ONNX export validation:** The exported ONNX model produced outputs matching the PyTorch model within a maximum absolute difference of approximately 0.00000095.

## Current System Position

AquaScan is currently a working integrated prototype intended for calm, shallow, and sheltered aquatic environments. The system has implemented manual vessel control, live system telemetry, mission replay, route planning, project saving, data visualization, probe communications, and a training/export pipeline for MARIS.

The system is not presented as a finished commercial product. Full autonomous route execution, direct pressure-based probe-depth measurement, extensive sensor calibration, long-term field reliability testing, and field-validated MARIS inference remain future development areas.

---

# 2. Post-States Software Iteration: From Unity to Web Mission Control

## States Software Baseline

The Unity interface was developed to prove that AquaScan could connect physical vessel operation with digital scientific visualization. It supported important functions such as mission playback, boat-path visualization, GPS sample points, selected sensor layers, heat maps, system status, and motor-output displays.

The Unity system was valuable because it demonstrated that AquaScan was more than a remote-controlled boat carrying sensors. It showed how collected measurements could be organized into a mission and connected to the location and depth where each reading was taken.

During continued development, the team identified a practical limitation. The Unity interface required the operator computer to have the dedicated application available and properly configured. This was effective for development and presentation, but a field instrument would benefit from controls that could be opened quickly on different laptops or tablets.

## Engineering Decision

The team decided to preserve the proven mission-data, visualization, and control concepts while rebuilding the primary operator interface as a browser-based field dashboard.

The purpose of the redesign was not simply to change the appearance of the software. The web transition addressed several engineering goals:

- **Improve accessibility:** Allow the interface to be opened through a browser on a compatible device.
- **Reduce setup requirements:** Avoid requiring the full Unity application for primary field operation.
- **Improve separation of functions:** Organize drive controls, sensor monitoring, predictive analysis, and planning tools into separate tabs.
- **Improve operator awareness:** Keep important status information visible while the operator changes between tools.
- **Support repeatable missions:** Add route planning, validation, project saving, and exportable project bundles.

## Current Browser-Based Mission-Control Dashboard

The browser dashboard is a frontend application developed using React, Vite, TypeScript, Three.js, and related visualization libraries. It runs locally and can communicate directly with the vessel through the available network route.

The dashboard includes the following major functions:

### 2.1 Mission Loading and Replay

- **CSV and JSON mission loading:** The dashboard can load AquaScan mission files containing timestamps, GPS coordinates, sensor readings, depth values, heading, speed, and battery data.
- **Timeline playback:** The operator can replay a mission over time and observe how the vessel moved between samples.
- **GPS route projection:** Latitude and longitude data are converted into local coordinates for route visualization.
- **Sample-point visualization:** Individual measurements can be displayed along the route.
- **Metric selection:** The operator can select measurements such as temperature, dissolved oxygen, pH, turbidity, conductivity, salinity, total dissolved solids, light, ultraviolet readings, depth, speed, and battery.
- **Heat-map and color-layer visualization:** Measurements can be represented by color to make spatial patterns easier to identify.

### 2.2 Direct Vessel Control

- **WebSocket connection:** The dashboard connects directly to the ESP32 through a WebSocket endpoint.
- **Joystick input:** Operator joystick values are converted into left and right motor commands.
- **Arm and disarm controls:** Motor output is disabled until the system is intentionally armed.
- **Emergency stop:** The dashboard includes an E-stop command that immediately requests a safe stopped condition.
- **Connection feedback:** The operator can see whether the dashboard is connected to the boat.
- **Motor-output display:** The requested left and right ESC pulse values are visible to the operator.

### 2.3 Simple and Advanced Control Modes

The dashboard includes separate modes so the amount of visible technical information can match the operator's current task.

- **Simple mode:** Prioritizes essential controls and reduces unnecessary visual complexity during normal operation.
- **Advanced mode:** Provides more detailed system settings and diagnostics for development, testing, or troubleshooting.

This refinement improves usability because field operation and engineering diagnostics do not always require the same interface density.

### 2.4 Mission Planning

The mission-planning tools support repeatable and organized data collection.

- **Waypoint creation:** The operator can create planned sampling points.
- **Waypoint editing:** Individual route points can be adjusted.
- **Waypoint ordering:** Planned samples can be reordered.
- **Route summary:** The dashboard calculates information such as the number of waypoints, planned route distance, and estimated duration.
- **Validation feedback:** The planner identifies issues in the route data before a mission is used.
- **Project saving:** Mission plans and settings can be saved locally.
- **Project bundles:** Related mission information can be packaged for later review or transfer.

### 2.5 Project Preflight

The dashboard includes preflight-style information to help the operator determine whether the current project and system settings are ready for use.

Preflight information can include:

- Mission or project status
- Connection settings
- Planned route validity
- Saved-project state
- Current control mode
- Safety status
- Telemetry availability

This is important because field failures often result from incomplete setup rather than one major hardware failure. A visible preflight process helps reduce avoidable setup mistakes.

### 2.6 Operator Themes and Layout

The dashboard supports both light and dark themes. The light theme can improve readability in some presentation or indoor environments, while the dark theme can reduce screen brightness and glare in other conditions.

The interface also organizes major functions into tabs, including:

- **Drive**
- **AI / MARIS and research analysis**
- **Sensors**
- **Plan**

This organization makes the system easier to scan than placing every feature on one screen.

## Verified Software Evidence

The current web application has automated tests that verify major parts of the system behavior.

Verified areas include:

- Loading CSV mission files
- Loading JSON mission files
- Rejecting invalid mission formats
- GPS coordinate projection behavior
- Drive-mixer and ESC-output calculations
- Mission route summaries
- Playback-time mapping
- Route exporting
- Waypoint editing, insertion, reordering, validation, and exporting
- Project-file serialization
- Preflight readiness calculations
- Default live-control settings
- Mission-upload protocol design
- Research-analysis readiness
- ONNX research-model metadata parsing
- Ordered feature-vector construction
- RS-485 sensor averaging
- Handling missing sensor fields
- Resetting accumulated sensor values
- Switching dashboard tabs and modes
- Saving local project files
- Displaying simulator and upload controls

As of June 14, 2026:

- **26 web tests passed**
- **The production build completed successfully**
- **Lint completed without errors**

## Result of the Software Iteration

The transition from Unity to a browser-based dashboard demonstrates a complete engineering iteration:

1. The Unity system proved that mission visualization and live control were feasible.
2. Continued development identified limitations in field accessibility and interface organization.
3. The team redesigned the interface around browser-based operation.
4. The team added planning, project-file, preflight, safety, telemetry, and diagnostic features.
5. Automated tests and release checks were used to verify the implementation.

The original Unity interface remains valuable as evidence of the earlier design stage. The web dashboard demonstrates that the team used the earlier prototype to identify practical requirements and create a more field-oriented system.

---

# 3. Web Field System and Embedded Communications Iteration

## Reason for the Embedded-System Refinement

The software interface is only useful if the commands and sensor data can move reliably through the physical system. AquaScan contains several devices with different responsibilities:

- The operator device displays the mission and sends commands.
- The ESP32 manages the network connection.
- The Arduino Mega controls real-time actuator outputs.
- The ESCs control the propulsion motors.
- The winch motor deploys and retrieves the probe.
- The probe contains sensors and an embedded controller.
- The tether carries power and communication between the vessel and probe.

During post-States development, the communication architecture was refined so that each connection had a clearer purpose. This reduces the chance that drive commands, debugging messages, and probe-sensor traffic interfere with one another.

## Current End-to-End Control and Data Path

### 3.1 Browser Dashboard to ESP32

**Communication method:** WebSocket over the local network.

**Primary functions:**

- Establish a live connection with the vessel
- Send drive commands
- Send armed/disarmed state
- Send emergency-stop commands
- Receive live status information
- Display connection and telemetry feedback

**Engineering benefit:** WebSocket communication allows the browser dashboard to maintain an active two-way connection with the vessel. The operator can send commands and receive updated status information without repeatedly refreshing the interface.

### 3.2 ESP32 to Arduino Mega

**Communication method:** Full-duplex hardware UART connection.

**Primary functions:**

- Transfer motor-control commands
- Transfer arm and E-stop state
- Transfer sequence numbers used to track commands
- Return the applied motor-control status
- Keep the ESP32 network task separate from the Arduino's real-time actuator-control task

**Engineering benefit:** The hardware UART bridge is more reliable than depending on a software-emulated serial connection. It also keeps the Arduino Mega's USB serial connection available for debugging and monitoring.

### 3.3 Arduino Mega to ESCs and Winch

**Control method:** Direct real-time output commands from the Arduino Mega.

**Primary functions:**

- Generate left and right ESC pulse values
- Maintain neutral motor output during startup
- Apply differential motor commands
- Control probe lowering, raising, and stopping
- Force safe output when required

**Engineering benefit:** The Arduino Mega handles actuator timing independently from the browser and network tasks. This makes real-time output less dependent on temporary network delays.

### 3.4 Arduino Mega to Probe

**Communication method:** Separate half-duplex RS-485 bus.

**Primary functions:**

- Request or receive probe-sensor measurements
- Transfer sensor readings over the marine tether
- Keep probe-sensor communication separate from the motor-control bridge

**Engineering benefit:** RS-485 is useful for communication over longer wired distances and in electrically noisy environments. Separating this connection from the ESP32-to-Arduino control bridge makes the system easier to diagnose and reduces communication conflicts.

### 3.5 Telemetry Return to Dashboard

The system can return information that helps the operator understand the current condition of the vessel and probe.

Telemetry fields can include:

- Connection status
- Armed or disarmed state
- Emergency-stop state
- Last processed command sequence
- Left motor output
- Right motor output
- Winch direction and speed
- Battery level
- Signal strength
- Probe depth estimate
- Individual sensor readings
- Sensor averages

**Engineering benefit:** Telemetry turns hidden system state into visible evidence. Instead of assuming that a command was received, the operator can inspect the returned status.

## Safety and Reliability Behaviors

### Safe Startup

The control system begins in a disarmed state. The ESC outputs are commanded to neutral during startup. This reduces the risk that the motors begin moving immediately when power is connected.

### Neutral Output During Communication Failure

The system is designed so that a disconnect, malformed message, or command timeout forces neutral motor output. This is important because a moving vessel should not continue using an old motor command after communication is lost.

### Emergency Stop

The operator dashboard includes an emergency-stop command. The E-stop state is latched until it is intentionally reset. This prevents the system from immediately returning to motion after the unsafe condition has been identified.

### Command Sequence Tracking

Drive messages contain a sequence number. Status messages can return the last processed sequence. This allows the system to track whether commands are being received and applied in order.

### Debug Visibility

The Arduino and ESP32 can display status through serial-monitor output. This makes the following information inspectable during testing:

- Drive sequence
- Armed state
- E-stop state
- Applied left and right motor outputs
- Winch direction
- Winch speed
- Sensor communication status

## Result of the Embedded-System Iteration

The updated communication structure improves AquaScan because it divides the system according to responsibility:

- The browser manages the operator experience.
- The ESP32 manages network communication.
- The Arduino Mega manages real-time actuators.
- The RS-485 bus manages probe-sensor communication.

This structure is more reliable and easier to troubleshoot than treating every message as part of one shared communication path.

---

# 4. MARIS: Experimental Predictive Analysis

## Overview

MARIS is AquaScan's first-pass machine-learning model for turning structured mission data into predictive research signals. MARIS is named as the predictive-analysis component of AquaScan and represents the team's exploration of how a mobile scientific instrument could eventually help researchers identify patterns that are difficult to detect from individual measurements alone.

MARIS is an implemented experimental proof of concept. It is not currently presented as a field-validated environmental decision system. The model has been trained, evaluated, exported, and tested, but it still requires substantially more independent real-world data before its predictions can be treated as scientifically reliable.

This distinction is important. The existence of a working model demonstrates technical feasibility. The limited real-world dataset and preliminary accuracy results define the next engineering and scientific validation steps.

## Purpose of MARIS

AquaScan's sensors collect measurements at different times, locations, and depths. These records can contain relationships that may not be obvious from viewing one measurement at a time. MARIS explores whether a model can use recent measurements and environmental context to generate useful predictive signals.

MARIS is designed to explore four outputs:

### 4.1 Current Dissolved-Oxygen Estimate

The model produces a regression output for the current dissolved-oxygen condition.

**Potential scientific value:** Dissolved oxygen is important because low oxygen can stress or kill aquatic organisms. A model that understands relationships between recent measurements and oxygen conditions could eventually help identify areas that require closer investigation.

### 4.2 Dissolved-Oxygen Forecasts

MARIS produces forecast outputs for:

- **30 minutes into the future**
- **60 minutes into the future**
- **120 minutes into the future**

**Potential scientific value:** Forecasting could help researchers recognize developing low-oxygen conditions before they become severe. However, the current model's forecast accuracy is not sufficient for validated field decisions.

### 4.3 Bloom-Risk Probability

MARIS produces a probability associated with elevated algae-bloom risk.

The first-pass model considers combinations of conditions such as:

- Water temperature
- Solar radiation or available light
- Turbidity
- Total dissolved solids
- pH

**Potential scientific value:** Bloom risk is influenced by interacting environmental conditions. A predictive model could eventually help identify locations or times that require direct biological or laboratory follow-up.

### 4.4 Anomaly Probability

MARIS produces a probability that the current pattern is unusual or potentially concerning.

The first-pass anomaly labels consider conditions such as:

- Low dissolved oxygen
- Rapid dissolved-oxygen decline
- High turbidity
- Unusual pH
- Other combinations that differ from expected conditions

**Potential scientific value:** Anomaly detection could help researchers prioritize the large amount of data produced during repeated missions.

## MARIS Inputs

MARIS uses two major input groups:

### Temporal Input

The temporal input represents recent measurements over a sequence of time steps. This allows the model to consider trends rather than only the current sample.

Temporal features can include:

- Dissolved oxygen
- Temperature
- pH
- Salinity
- Total dissolved solids
- Conductivity
- Turbidity
- Light
- Ultraviolet readings
- Depth
- Changes between recent readings

### Context Input

The context input represents additional information associated with the current mission or sample.

Context features can include:

- Location-related values
- Depth
- Time-related context
- Optional weather data
- Air temperature
- Wind speed
- Pressure
- Precipitation
- Solar radiation

## MARIS Outputs

The exported model contains four output heads:

- **Oxygen:** Current dissolved-oxygen regression
- **Forecast:** Dissolved-oxygen forecasts at +30, +60, and +120 minutes
- **Bloom:** Bloom-risk probability
- **Anomaly:** Anomaly probability

Using multiple output heads allows one model to explore several related scientific questions from the same structured mission data.

## Training and Export Pipeline

The MARIS pipeline accepts AquaScan CSV and JSON mission files. It performs the following development process:

1. **Mission discovery:** Finds available mission-data files.
2. **Mission loading:** Reads timestamps, GPS coordinates, and sensor metrics.
3. **Synthetic-data generation:** Creates additional simulated missions for early pipeline development.
4. **Feature engineering:** Converts mission records into temporal and contextual model inputs.
5. **Dataset normalization:** Scales input features to support model training.
6. **Training and evaluation split:** Divides available windows into training and internal evaluation groups.
7. **Multi-task model training:** Trains oxygen, forecast, bloom, and anomaly outputs together.
8. **Evaluation:** Calculates preliminary performance metrics.
9. **PyTorch checkpoint export:** Saves the trained model and feature information.
10. **ONNX export:** Converts the model into a portable ONNX artifact.
11. **ONNX validation:** Confirms that the exported ONNX model produces outputs matching the original PyTorch model.
12. **Prediction sample export:** Creates sample predictions for inspection.

## Current MARIS Development Evidence

### Available Data

- **Real missions:** 3
- **Synthetic missions:** 12
- **Total model windows:** 1,158
- **Internal evaluation windows:** 232

The synthetic missions are useful for verifying that the data and training pipeline work across varied inputs. They are not a replacement for real field data. The limited number of real missions is the most important current limitation of MARIS.

### Preliminary Evaluation Results

- **Current oxygen RMSE:** Approximately 1.92 mg/L
- **Forecast RMSE:** Approximately 2.08 mg/L
- **Bloom-risk accuracy:** Approximately 59.5%
- **Anomaly accuracy:** Approximately 93.5%

### Interpretation of the Results

**Oxygen and forecast error:** The current oxygen and forecast errors show that MARIS requires significant accuracy improvement before its predictions should be used for scientific decisions.

**Bloom-risk accuracy:** The bloom-risk accuracy is only moderately better than random classification. This result demonstrates that additional labeled field data, improved labels, and model refinement are required.

**Anomaly accuracy:** The anomaly result is promising as an internal development result. However, it depends on the available data and the rule-based labels used during development. It must be tested against independent real-world conditions.

### ONNX Export Validation

MARIS was exported to the ONNX model format. The exported model was tested against the PyTorch version.

- **Export completed:** Yes
- **Export validation completed:** Yes
- **Maximum absolute output difference:** Approximately 0.00000095

This result confirms that the exported model numerically matches the original model output. It does not prove that the predictions are scientifically accurate. It proves that the model can be moved into another compatible runtime without changing its calculations.

## Current Dashboard Integration

The primary dashboard currently displays a transparent heuristic fallback for predictive values. The interface clearly labels the fallback status rather than presenting it as validated MARIS inference.

This is an intentional engineering decision. It prevents the software from implying that the exported model is already validated for live environmental decisions.

The dashboard and repository contain scaffolding for future ONNX Runtime Web integration. Additional work is required to connect the complete MARIS temporal/context input format to live or replayed mission data.

## Current MARIS Status

MARIS should be framed as:

> An implemented experimental machine-learning proof of concept that has been trained, evaluated, tested, and exported, with field validation and dependable live deployment remaining future development.

MARIS should not be framed as:

- A finished environmental forecasting system
- A scientifically validated bloom detector
- A replacement for calibrated scientific instruments
- A model trained on a large real-world dataset
- A system currently making dependable live field decisions

## MARIS Future Development

The next MARIS development cycle should include:

- **Collect substantially more real missions:** Data should cover different water bodies, seasons, depths, times, and weather conditions.
- **Separate missions during evaluation:** Entire missions or water bodies should be held out so the model is evaluated on genuinely independent conditions.
- **Improve sensor calibration:** Model quality depends on the quality of the sensor measurements used for training.
- **Use stronger labels:** Bloom-risk and anomaly labels should be compared with validated field observations or laboratory results.
- **Compare against simple baselines:** MARIS should be compared with persistence forecasts, averages, linear regression, and other simpler methods.
- **Measure uncertainty:** Future predictions should indicate confidence or uncertainty rather than displaying only one value.
- **Complete live ONNX integration:** The exported model should be connected to the dashboard after input construction and field validation are complete.
- **Validate across external datasets:** The model should be evaluated using data not produced by the same missions used during development.

---

# 5. MARIS Placement Before “What This Data Can Reveal”

The MARIS section should appear directly before the existing portfolio heading **“What This Data Can Reveal.”**

This placement creates a logical transition:

1. AquaScan collects and organizes depth-aware, location-based data.
2. MARIS demonstrates a future method for interpreting time-based and multi-sensor patterns.
3. The existing “What This Data Can Reveal” section explains the real scientific conditions that these measurements and future predictive tools could help researchers investigate.

Suggested transition paragraph:

> AquaScan’s maps, depth profiles, and sensor records allow researchers to directly examine collected measurements. MARIS extends this data workflow by exploring whether recent measurements and environmental context can be used to forecast or flag conditions that deserve closer investigation. Whether interpreted directly through graphs or explored through an experimental predictive model, AquaScan data is intended to help reveal environmental conditions that may be hidden below the surface or isolated to specific locations.

---

# 6. Nationals Iteration Evidence

## System-Level Iteration Summary

The largest post-States refinement was not one isolated feature. It was a system-level engineering iteration focused on field usability, communication reliability, diagnostic visibility, operator safety, mission organization, and future scientific analysis.

## Iteration 1: Unity Accessibility

**Problem identified:** The Unity interface effectively demonstrated the software concept but required a dedicated installed application and was less convenient for operation across different field devices.

**Refinement made:** The team rebuilt the primary operator interface as a local browser-based React and Vite dashboard.

**Evidence available:**

- Current dashboard screenshots
- Source-code history
- Mission-loading tests
- Route-planning tests
- Project-saving tests
- Successful production build
- Successful lint check

**Result:** The updated interface is easier to open on compatible field devices and provides a clearer path toward laptop or tablet operation.

## Iteration 2: Communication Diagnostics

**Problem identified:** The earlier communication system exposed limited information about where a command or sensor-data failure occurred.

**Refinement made:** The team added explicit WebSocket status, command sequence tracking, a hardware UART control bridge, separate RS-485 probe communication, and visible telemetry fields.

**Evidence available:**

- ESP32 firmware
- Arduino Mega firmware
- Serial-monitor output
- Dashboard telemetry cards
- Sensor-averaging tests

**Result:** Communication failures are easier to locate because the operator can inspect connection state, sequence values, applied motor outputs, probe data, and other system status.

## Iteration 3: Operator Safety

**Problem identified:** A field-control system needs predictable behavior during startup, communication loss, or unsafe operation.

**Refinement made:** The system now uses a disarmed startup state, neutral output during communication failure, explicit arm/disarm state, and a latched E-stop.

**Evidence available:**

- Firmware safety logic
- WebSocket control contract
- Automated drive-mapping tests
- Visible dashboard safety state

**Result:** The system reduces the risk of unintended motor output during setup or loss of communication.

## Iteration 4: Repeatable Mission Organization

**Problem identified:** CSV and JSON data could be loaded and visualized, but a repeatable field workflow also requires organized mission plans and saved project state.

**Refinement made:** The dashboard now includes mission planning, waypoint editing, route validation, project saving, and exportable bundles.

**Evidence available:**

- Mission-planner interface
- Saved-plan interface
- Route-summary output
- Waypoint-editing tests
- Project-file serialization tests

**Result:** AquaScan missions can be prepared, checked, saved, reviewed, and communicated more consistently.

## Iteration 5: Predictive Analysis

**Problem identified:** The original visualization system explained recorded measurements but did not explore how repeated mission data could support prediction or prioritization.

**Refinement made:** The team developed MARIS and created research-analysis and ONNX-integration scaffolding.

**Evidence available:**

- MARIS training source code
- PyTorch checkpoint
- ONNX model
- Normalization metadata
- Evaluation report
- Prediction sample
- 7 passing ML tests

**Result:** AquaScan now demonstrates a technically realistic future path for predictive scientific analysis while clearly documenting the limitations that prevent current field-validation claims.

## Verified Results Summary

Verified on June 14, 2026:

- **26 web tests passed**
- **Web production build completed**
- **Web lint completed without errors**
- **7 ML tests passed**
- **MARIS ONNX export completed**
- **MARIS ONNX output matched PyTorch output**

## Engineering Significance

The current AquaScan portfolio can show an authentic engineering cycle:

1. A functioning prototype was built and tested for States.
2. The team identified practical limitations after reviewing that prototype.
3. The system was redesigned in response to those limitations.
4. New hardware, firmware, software, and machine-learning components were implemented.
5. Automated tests, serial output, screenshots, model artifacts, and build results were used as evidence.
6. Remaining limitations were documented as the basis for the next development cycle.

This is stronger than presenting the Nationals version as though it appeared fully formed. The States version becomes evidence of an earlier engineering stage, while the Nationals update demonstrates continued problem solving.

---

# 7. Post-States Development Record

The following record supplements the original TSA work log by documenting major repository-backed development completed after the April 29, 2026 States portfolio submission.

## April 30, 2026: Live-Control and Metrics Integration

**Development activity:** Expanded live-control WebSocket behavior and metric integration.

**Technical work:**

- Continued development of direct vessel control
- Improved communication between interface and control system
- Expanded metric and mission-data behavior

**Result/evidence:** Control and data behavior were incorporated into the evolving software system.

## May 5, 2026: MARIS Pipeline Development

**Development activity:** Developed and tested the first-pass multi-task machine-learning pipeline.

**Technical work:**

- Built mission-data loaders
- Generated synthetic development missions
- Engineered temporal and context features
- Trained the multi-task model
- Evaluated preliminary model performance
- Exported PyTorch and ONNX artifacts
- Validated ONNX output
- Created automated ML tests

**Result/evidence:** MARIS training code, PyTorch checkpoint, ONNX export, normalization data, metrics report, prediction sample, and passing tests.

## May 6, 2026: Browser Dashboard Creation

**Development activity:** Created the browser-based AquaScan dashboard.

**Technical work:**

- Created React/Vite application
- Added Three.js mission visualization
- Added mission loading and playback
- Added route and sample visualization
- Added direct WebSocket control
- Added joystick and E-stop interface
- Added automated tests

**Result/evidence:** Working browser dashboard capable of mission review and live-control interaction.

## May 8-10, 2026: System Integration

**Development activity:** Integrated project-wide software, visualization, and control updates.

**Technical work:**

- Consolidated mission-data formats
- Connected visualization and controls
- Expanded project documentation
- Integrated current system components

**Result/evidence:** Consolidated system capable of playback, live control, and expanded data interpretation.

## May 28, 2026: Planning and Research Tools

**Development activity:** Expanded mission planning, project-file, preflight, and research-analysis tools.

**Technical work:**

- Added saved mission plans
- Added waypoint editing and route validation
- Added project files and exportable bundles
- Added hardware preflight information
- Added research-analysis interface
- Added ONNX-model metadata scaffolding

**Result/evidence:** Saved routes, validation feedback, project bundles, and research-analysis scaffolding.

## June 7, 2026: RS-485 Sensor Pipeline and Telemetry

**Development activity:** Added RS-485 sensor pipeline and interface telemetry.

**Technical work:**

- Refined ESP32 firmware
- Refined Arduino Mega bridge firmware
- Separated probe communication from motor-control communication
- Added sensor-sequence processing
- Added sensor averaging
- Added live sensor telemetry to the dashboard

**Result/evidence:** Separate probe-sensing pipeline and visible dashboard telemetry.

## June 11-12, 2026: Current Control-Chain Validation

**Development activity:** Validated current bridge/control behavior and captured evidence.

**Technical work:**

- Inspected Arduino serial-monitor status
- Verified drive command sequence behavior
- Verified arm/disarm behavior
- Verified winch-status output
- Inspected connected-dashboard behavior

**Result/evidence:** Serial-monitor and dashboard evidence showing the current control chain.

## June 14, 2026: Verification and Nationals Documentation

**Development activity:** Ran the current verification suite and documented the post-States iteration.

**Results:**

- 26 web tests passed
- Web production build completed
- Web lint completed without errors
- 7 ML tests passed
- Updated portfolio materials prepared

---

# 8. Current Limitations and Future Development

Documenting limitations strengthens the project because it shows that the team understands what the current evidence can and cannot prove.

## 8.1 MARIS Validation

**Current limitation:** MARIS uses only three real missions along with synthetic development missions. Its current performance is not sufficient for dependable environmental forecasting.

**Future development:** Collect larger independent datasets, improve labels, compare against simpler baselines, evaluate on held-out water bodies, measure uncertainty, and complete live inference only after stronger validation.

## 8.2 Autonomous Mission Execution

**Current limitation:** Manual control, mission planning, and route tools are implemented, but full autonomous route execution is not currently presented as a completed field-validated capability.

**Future development:** Implement and repeatedly test automatic waypoint navigation, stopping accuracy, automatic probe deployment, obstacle response, and complete mission execution.

## 8.3 Probe-Depth Accuracy

**Current limitation:** Probe depth is estimated from tether deployment and spool behavior. Tether angle, changing spool radius, and uneven cable wrapping can introduce error.

**Future development:** Add a pressure-based depth sensor inside the probe and compare its readings against known depths.

## 8.4 Sensor Calibration

**Current limitation:** Additional calibration and comparison against known standards or reference instruments are required for stronger scientific accuracy claims.

**Future development:** Create calibration procedures, document calibration curves, repeat measurements, report uncertainty, and compare readings against reference instruments where possible.

## 8.5 Optical Sensor Window

**Current limitation:** The printed clear material used around the light and ultraviolet sensors is not fully transparent and can diffuse incoming light.

**Future development:** Replace the printed clear section with a sealed acrylic or polycarbonate optical window.

## 8.6 Long-Term Field Reliability

**Current limitation:** The prototype has demonstrated its core workflow, but extended operation across repeated missions and varied environments requires additional testing.

**Future development:** Test waterproofing duration, battery endurance, communications range, motor temperature, probe deployment cycles, sensor drift, and maintenance requirements.

## 8.7 Scientific Scope

**Current limitation:** AquaScan is best suited to calm, shallow, sheltered environments. It should not be compared directly with ocean-grade survey vessels designed for high waves, strong currents, or long deployments.

**Future development:** Define and validate specific operating limits for wind, waves, current, depth, range, and mission duration.

---

# 9. Detailed Communication-of-Solution Update

AquaScan addresses the theme “Engineering the Tools of Scientific Discovery” by expanding what researchers can observe, connect, and interpret in aquatic environments. Conditions at the surface do not always represent the conditions below. Dissolved oxygen, temperature, turbidity, pH, dissolved material, conductivity, salinity, light availability, and other measurements can change across a water body and through the water column.

AquaScan combines several scientific-tool functions into one integrated platform:

- **Mobility:** The vessel can travel between sampling locations instead of representing only one fixed point.
- **Depth-aware sensing:** The deployable probe can collect measurements below the surface.
- **Location context:** GPS information connects readings to the area where they were collected.
- **Time context:** Mission records connect readings to when they were collected.
- **Multi-parameter measurement:** Related sensor values can be compared at the same location and depth.
- **Mission visualization:** The dashboard displays paths, sample points, measurements, and system status.
- **Data organization:** CSV and JSON records allow measurements to be analyzed, graphed, mapped, and reused.
- **Predictive-development path:** MARIS demonstrates how future mission data could support forecasting and anomaly prioritization after stronger field validation.

## How the Current System Improves Scientific Observation

### Direct Measurement

The deployable probe directly contacts the water and collects sensor readings. This gives researchers evidence based on measured conditions rather than only surface appearance.

### Depth-Aware Data

The probe can collect readings below the surface. This can help reveal vertical changes such as thermal layering, reduced oxygen at depth, changes in turbidity, and reduced light penetration.

### Location-Based Sampling

GPS-linked records allow measurements from different areas to be compared. This can help identify localized runoff effects, sediment plumes, chemical changes, or other spatial patterns.

### Organized Interpretation

The dashboard and exported data allow results to be displayed as:

- Tables
- Graphs
- Route maps
- Sample points
- Heat maps
- Depth profiles
- Sensor summaries
- Experimental predictive-analysis outputs

### Repeatable Research Workflow

The mission planner and project tools allow future monitoring routes to be prepared, validated, saved, and repeated. Repeatable missions are important because environmental research often depends on comparing the same locations over time.

## Final Communication Statement

AquaScan is a working student-engineered scientific instrument that combines a mobile vessel, deployable multi-sensor probe, embedded control system, browser-based mission dashboard, structured data output, and an experimental predictive-analysis model. The prototype has demonstrated the core workflow required to collect location-based and depth-aware water-quality data in calm, shallow, and sheltered environments.

The post-States development process strengthened the project by improving field accessibility, communications architecture, safety behavior, mission organization, telemetry visibility, automated verification, and the future pathway for predictive analysis. The project does not claim that every engineering or scientific challenge has been solved. Instead, it documents a functioning system, measurable limitations, completed refinements, and a clear next development cycle.

---

# 10. Concise Judge-Facing Summary

## What Existed at States

- Working AquaScan vessel and deployable probe
- Unity-based control and visualization interface
- GPS-tagged sensor records
- Pool and pond testing
- Depth and location-based graphs and heat maps

## What Changed for Nationals

- Primary interface moved from Unity to a browser-based field dashboard
- Mission planning, validation, project saving, and project bundles were added
- WebSocket live-control and status behavior were expanded
- ESP32-to-Arduino communication was refined using a hardware UART bridge
- Probe sensing was separated onto an RS-485 communication pipeline
- Live telemetry and sensor averaging were added
- Safety and diagnostic visibility were strengthened
- MARIS was developed, trained, evaluated, exported, and tested
- Automated verification was expanded

## What Is Verified

- 26 web tests passed
- Web production build completed
- Web lint completed without errors
- 7 ML tests passed
- ONNX model export validated against PyTorch output

## What Is Still Future Development

- Full autonomous route execution
- Pressure-based direct depth measurement
- Larger calibration and repeatability studies
- Long-term field-reliability testing
- Larger independent real-world MARIS dataset
- Scientifically validated MARIS predictions
- Complete dependable live MARIS inference

