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

# 2. Current Limitations and Future Development
Documenting limitations strengthens the project because it shows that the team understands what the current evidence can and cannot prove.

## 2.1 MARIS Validation
**Current limitation:** MARIS uses only three real missions along with synthetic development missions. Its current performance is not sufficient for dependable environmental forecasting.
**Future development:** Collect larger independent datasets, improve labels, compare against simpler baselines, evaluate on held-out water bodies, measure uncertainty, and complete live inference only after stronger validation.

## 2.2 Autonomous Mission Execution
**Current limitation:** Manual control, mission planning, and route tools are implemented, but full autonomous route execution is not currently presented as a completed field-validated capability.
**Future development:** Implement and repeatedly test automatic waypoint navigation, stopping accuracy, automatic probe deployment, obstacle response, and complete mission execution.

## 2.3 Probe-Depth Accuracy
**Current limitation:** Probe depth is estimated from tether deployment and spool behavior. Tether angle, changing spool radius, and uneven cable wrapping can introduce error.
**Future development:** Add a pressure-based depth sensor inside the probe and compare its readings against known depths.

## 2.4 Sensor Calibration
**Current limitation:** Additional calibration and comparison against known standards or reference instruments are required for stronger scientific accuracy claims.
**Future development:** Create calibration procedures, document calibration curves, repeat measurements, report uncertainty, and compare readings against reference instruments where possible.

## 2.5 Optical Sensor Window
**Current limitation:** The printed clear material used around the light and ultraviolet sensors is not fully transparent and can diffuse incoming light.
**Future development:** Replace the printed clear section with a sealed acrylic or polycarbonate optical window.

## 2.6 Long-Term Field Reliability
**Current limitation:** The prototype has demonstrated its core workflow, but extended operation across repeated missions and varied environments requires additional testing.
**Future development:** Test waterproofing duration, battery endurance, communications range, motor temperature, probe deployment cycles, sensor drift, and maintenance requirements.

## 2.7 Scientific Scope
**Current limitation:** AquaScan is best suited to calm, shallow, sheltered environments. It should not be compared directly with ocean-grade survey vessels designed for high waves, strong currents, or long deployments.
**Future development:** Define and validate specific operating limits for wind, waves, current, depth, range, and mission duration.
---

# 3. Detailed Subsystem Architecture Reference
The following chapters separate AquaScan into specific engineering subsystems. Each chapter explains one responsibility boundary so software, networking, embedded control, sensing, mechanics, data processing, and predictive analysis are not combined into one broad description.
This reference is intentionally more detailed than the judge-facing summary. It can be used to select text for the portfolio, prepare presentation explanations, answer judge questions, and identify evidence that should be displayed beside each technical claim.

## System Boundary Summary
- **Physical vessel:** Provides flotation, structure, propulsion mounting, electronics support, and a stable platform for probe deployment.
- **Operator dashboard:** Provides human control, mission planning, telemetry display, visualization, project storage, and research-analysis interfaces.
- **Network gateway:** Connects the browser-based operator interface to the embedded control chain through Wi-Fi and WebSocket communication.
- **Actuator controller:** Applies deterministic commands to propulsion ESCs and the probe winch while enforcing local safety behavior.
- **Probe sensor controller:** Samples the probe's sensor channels and transmits structured records through the tether communication link.
- **Mission-data pipeline:** Converts sensor and mission records into reusable CSV/JSON data structures, route visualizations, graphs, and research inputs.
- **MARIS pipeline:** Trains and exports an experimental predictive model from structured mission windows and context features.

# 4. Operator Dashboard Shell

## Purpose and Boundary
The dashboard shell is responsible for organizing the human-facing application. It does not directly generate motor pulses or sample analog sensors. Its boundary is the operator experience: showing state, collecting user intent, and routing that intent to the correct software module.

## Responsibilities
- **Navigation:** Separates setup, run, drive, AI/research, sensors, planner, and review responsibilities into dedicated views.
- **Persistent status:** Keeps high-priority status such as telemetry health, safety state, project state, and motor output visible across views.
- **Mode management:** Distinguishes playback, simulator, and hardware/live-control operation.
- **Responsive operation:** Supports use through a browser rather than requiring the Unity development environment.
- **Human factors:** Uses simple and advanced modes so routine operation and engineering diagnostics do not compete for the same screen space.

## Current Implementation
- **Frontend framework:** The current dashboard is implemented with React, TypeScript, and Vite.
- **Three-dimensional visualization:** React Three Fiber and Three.js provide the route, water, boat, sample-point, and heat-map scene.
- **Charting:** Recharts supports numerical trend presentation where chart views are used.
- **Iconography:** Consistent interface icons support quick recognition of drive, sensor, plan, safety, and connection functions.
- **Local settings:** Browser storage preserves selected interface and live-control preferences.
- **Theme support:** Light and dark themes support different display and operating environments.

## Evidence Available
- **Dashboard screenshots:** Current captures show the drive, planner, sensor, and research-analysis views.
- **Automated interface tests:** Tests verify tab switching, theme switching, project saving, planner interaction, simulator controls, and research-analysis visibility.
- **Production build:** A production build completed successfully on June 14, 2026.
- **Lint verification:** The frontend completed its lint check without errors.

## Current Limitations
- **Field-device validation:** The interface still requires broader testing across different tablets, browsers, screen sizes, and outdoor lighting conditions.
- **Accessibility audit:** Keyboard navigation, contrast, and assistive-technology behavior require a formal accessibility review.
- **Authentication:** The current local field dashboard is not designed as a secure public internet service.
- **Operator training:** The interface reduces complexity but does not remove the need for a defined operating procedure.

## Next Validation Steps
- **Outdoor usability test:** Measure whether critical information remains readable under bright sunlight and glare.
- **Timed operator tasks:** Measure connection, arming, mission loading, and emergency-stop task completion time.
- **Failure-state review:** Test how clearly the interface explains stale telemetry, disconnected hardware, invalid plans, and sensor loss.
- **Device matrix:** Document supported browsers, screen sizes, and operating systems.

# 5. Mission Loading and Data Parsing

## Purpose and Boundary
Mission loading is responsible for converting stored CSV or JSON records into a consistent in-memory mission. It does not decide how the route is displayed or how the vessel is controlled. Its output is a validated mission structure used by later modules.

## Responsibilities
- **Format recognition:** Selects CSV or JSON parsing based on the source file type.
- **Required-field validation:** Requires timestamp, latitude, and longitude information for usable mission samples.
- **Metric normalization:** Maps equivalent field names, including dissolved_oxygen to the internal do identifier.
- **Unknown metric preservation:** Preserves additional numeric fields so future sensors are not discarded by the loader.
- **Chronological ordering:** Sorts valid samples by timestamp before playback or analysis.
- **Coordinate preparation:** Creates local positions from geographic coordinates for route visualization.

## Current Implementation
- **CSV input:** CSV headers can contain timestamps, geographic coordinates, operating values, and sensor metrics.
- **JSON input:** JSON samples can store measurements directly or inside a nested metrics object.
- **Invalid-row handling:** Rows without a valid timestamp, latitude, or longitude are skipped rather than treated as reliable samples.
- **Reserved fields:** Location, heading, depth, speed, battery, and altitude receive dedicated handling.
- **Source tracking:** The mission retains the source filename where available.
- **Mission naming:** Mission names come from JSON metadata or the source filename.

## Evidence Available
- **Loader tests:** Automated tests verify valid CSV loading, valid JSON loading, and rejection of CSV data without required headers.
- **Demo missions:** The repository contains pond and pool mission examples used by the loader and visualization pipeline.
- **Round-trip usage:** Loaded missions are used by playback, route summaries, planning tools, exports, research analysis, and MARIS preparation.

## Current Limitations
- **Schema versioning:** Raw CSV and JSON mission formats do not yet enforce a comprehensive versioned schema.
- **Unit enforcement:** The loader accepts numeric values but cannot independently prove that every value uses the intended scientific unit.
- **Data provenance:** Mission records need stronger metadata describing sensor calibration, operator, site, weather, and collection procedure.
- **Invalid-value policy:** More explicit handling is required for impossible, saturated, or out-of-range sensor values.

## Next Validation Steps
- **Versioned schema:** Define required and optional fields for each mission-data format version.
- **Unit metadata:** Store units and calibration identifiers with every sensor channel.
- **Quality flags:** Add per-sample flags for missing, stale, uncalibrated, or rejected measurements.
- **Import report:** Show the operator how many samples were loaded, skipped, corrected, or missing important fields.

# 6. Mission Playback

## Purpose and Boundary
Mission playback is responsible for reconstructing a mission over time from stored samples. It does not modify the original mission and does not command the physical boat. It provides an interpretive replay of collected or simulated records.

## Responsibilities
- **Duration calculation:** Calculates mission duration from the first and last valid sample timestamps.
- **Time normalization:** Maps a zero-to-one playback position into a specific target time.
- **Segment selection:** Finds the two samples surrounding the target playback time.
- **Interpolation:** Interpolates local position and related playback state between surrounding samples.
- **Timeline control:** Supports play, pause, scrubbing, and collapsed or expanded timeline presentation.

## Current Implementation
- **Timestamp-based segments:** Playback uses sample timestamps instead of assuming equal spacing between records.
- **Interpolated boat position:** The boat marker moves smoothly between recorded sample locations.
- **Current sample context:** Sensor and predictive panels can reference the sample associated with the current playback segment.
- **Mission review:** Playback can be used without a live vessel connection.

## Evidence Available
- **Playback tests:** Automated tests verify route-to-playback mapping and mission-segment behavior.
- **Visible timeline:** Dashboard screenshots show current playback time, mission duration, and route position.
- **Unity baseline:** The earlier Unity interface also demonstrated mission replay, providing evidence of design continuity.

## Current Limitations
- **Interpolation meaning:** Interpolated positions are visual estimates between samples, not additional physical measurements.
- **Irregular sampling:** Long gaps between records can make smooth interpolation appear more precise than the underlying data.
- **Event annotation:** Playback does not yet include a complete operator event log for probe deployment, calibration, or environmental observations.

## Next Validation Steps
- **Gap visualization:** Visually distinguish large time gaps or missing records.
- **Event markers:** Add deployment, retrieval, alarm, calibration, and operator-note markers.
- **Multiple-mission comparison:** Allow synchronized comparison of repeated missions along the same route.
- **Playback export:** Export annotated replay summaries for documentation and scientific review.

# 7. Mission Planning and Waypoint Editing

## Purpose and Boundary
The planning module is responsible for preparing and validating intended mission routes. It does not currently prove that the physical vessel can autonomously execute those routes. Planning and autonomous execution are intentionally treated as separate engineering claims.

## Responsibilities
- **Waypoint editing:** Updates timestamp, latitude, longitude, altitude, heading, speed, and depth fields.
- **Waypoint insertion:** Creates a midpoint between surrounding waypoints or offsets a final waypoint when extending a route.
- **Waypoint deletion:** Removes a waypoint while preserving a minimum viable route.
- **Waypoint ordering:** Moves waypoints earlier or later in the planned sequence.
- **Local-coordinate update:** Recalculates visualization position after geographic coordinates change.
- **Route validation:** Checks geographic validity, timestamp validity, duplicate times, chronological order, and high planned leg speed.
- **Plan export:** Exports the planned route as structured JSON or CSV.

## Current Implementation
- **Coordinate limits:** Latitude is checked against -90 to 90 degrees and longitude against -180 to 180 degrees.
- **Minimum route size:** A mission requires at least two waypoints for route validation.
- **Duplicate-time warning:** Repeated timestamps are identified because they can make mission timing ambiguous.
- **Leg-speed warning:** Planned legs exceeding 8 meters per second are flagged for review.
- **Metric synchronization:** Changes to depth and speed are reflected in the sample's metric collection.

## Evidence Available
- **Planner tests:** Automated tests verify waypoint updating, insertion, movement, deletion, validation, and export.
- **Planner screenshot:** The current interface displays waypoint count, planned distance, duration, and validation status.
- **Saved routes:** Project files preserve mission plans for later review.

## Current Limitations
- **Execution separation:** A valid route plan is not evidence that autonomous navigation has completed that route.
- **Obstacle awareness:** Planning does not yet incorporate a validated obstacle map or collision-avoidance model.
- **Environmental constraints:** Wind, current, shoreline hazards, and restricted areas are not yet fully included in route validation.
- **Energy estimation:** The current planner does not provide a validated battery-energy model for route completion.

## Next Validation Steps
- **Route-execution trials:** Compare commanded waypoint routes with measured GPS tracks across repeated runs.
- **Stopping accuracy:** Measure distance from each target when the vessel stops for sampling.
- **Obstacle constraints:** Add and test exclusion zones and minimum shoreline distance.
- **Energy model:** Estimate and validate route energy use using battery and motor-output data.

# 8. Project Files and Repeatable Mission Packages

## Purpose and Boundary
Project-file handling is responsible for preserving the operator's mission, selected visualization, visible layers, and live settings as one reusable package. It does not replace the raw scientific record; it stores application state needed to reopen and communicate a mission.

## Responsibilities
- **Project identity:** Stores a project identifier, name, save timestamp, and schema version.
- **Mission preservation:** Stores a clone of the mission used for planning and review.
- **Visualization preservation:** Stores the selected metric and layer visibility.
- **Live-setting preservation:** Stores host, port, deadzone, maximum output, send rate, and timeout settings.
- **Project summaries:** Produces short records containing project name, save time, and sample count.

## Current Implementation
- **Version 1 schema:** The current project file explicitly identifies version 1.
- **Safe defaults:** Missing fields are restored with default metric, layer, and connection settings where possible.
- **JSON serialization:** Project state is stored as readable structured JSON.
- **Unique identifiers:** Project IDs use a random UUID when supported or a time-based fallback.

## Evidence Available
- **Project-file tests:** Automated tests verify project creation, serialization, parsing, and preflight use.
- **Visible saved-plan state:** The planner displays saved project information.
- **Bundle workflow:** The dashboard exposes project and bundle actions for repeatable use.

## Current Limitations
- **Scientific provenance:** A project file does not yet fully describe calibration certificates, environmental context, or chain of custody.
- **Schema migration:** Only the current version is implemented; long-term migration behavior requires design.
- **Integrity protection:** Project JSON is readable and editable and does not currently provide cryptographic authenticity.

## Next Validation Steps
- **Metadata expansion:** Add team, site, operator, equipment, calibration, and environmental metadata.
- **Version migration tests:** Define and test behavior when future project versions are opened.
- **Integrity record:** Add checksums for included mission and configuration files.
- **Portable archive:** Create a documented package layout containing project state, raw data, exports, notes, and figures.

# 9. Preflight Readiness Checks

## Purpose and Boundary
Preflight checks are responsible for converting several independent setup conditions into a visible readiness summary. They do not guarantee a safe mission; they reduce the chance that known setup problems are ignored.

## Responsibilities
- **Mission check:** Confirms that a mission exists and contains enough waypoints.
- **Plan check:** Separates blocking route errors from warnings that require review.
- **Link check:** Confirms whether the WebSocket connection is active.
- **Telemetry check:** Evaluates whether recent status information is fresh, stale, connecting, offline, or in error.
- **GPS check:** Reports whether live geographic coordinates are present in status packets.
- **Safety-state check:** Requires disarmed state and a clear E-stop during mission preparation.

## Current Implementation
- **Pass/warn/fail states:** Each check produces a status, label, and explanatory detail.
- **Readiness rule:** Preflight is considered ready only when no check is in the fail state.
- **Visible explanation:** The operator sees why a check passed, warned, or failed.

## Evidence Available
- **Preflight tests:** Automated tests verify readiness construction from project, connection, telemetry, GPS, arm, and E-stop state.
- **Planner screenshot:** The dashboard shows validation and saved-project status in the planning workflow.

## Current Limitations
- **Checklist completeness:** Mechanical fasteners, waterproofing inspection, propeller clearance, and physical battery connection are not automatically sensed.
- **False confidence:** A passing software preflight cannot prove that all physical systems are safe.
- **GPS validity:** The presence of coordinates does not by itself prove adequate GPS accuracy.

## Next Validation Steps
- **Physical checklist:** Add operator-confirmed checks for structure, waterproofing, propellers, tether, and probe attachment.
- **GPS quality fields:** Display satellite count, fix quality, and horizontal accuracy when available.
- **Preflight logging:** Record who completed each check and when it was completed.
- **Abort criteria:** Define conditions that require mission cancellation or return to shore.

# 10. Three-Dimensional Route Visualization

## Purpose and Boundary
The scene module is responsible for visually representing the mission environment, route, samples, boat marker, and probe marker. It is an interpretation layer and does not replace numerical tables or calibrated maps.

## Responsibilities
- **Mission bounds:** Calculates route center and viewing radius from local sample positions.
- **Route line:** Draws the sequence of mission samples as a visible path.
- **Sample points:** Shows individual measurements and supports sample selection.
- **Boat marker:** Shows the current live or replayed boat location and heading.
- **Probe marker:** Shows a depth-related marker beneath the boat where supported.
- **Camera protection:** Keeps the camera above the rendered water surface.
- **Editable positions:** Supports waypoint movement during planning mode.

## Current Implementation
- **Model boat:** Loads a converted GLB boat model when available.
- **Fallback boat:** Uses a procedural model when the external boat model is unavailable.
- **Water surface:** Uses a generated shader and noise textures for a visually understandable water environment.
- **Track geometry:** Creates a line geometry from ordered mission points.
- **Interactive samples:** Sample markers respond to selection and planning interactions.

## Evidence Available
- **Current dashboard images:** Screenshots show the route, sample markers, boat, and water scene.
- **Scene-related tests:** Mission loading, local coordinates, and route summaries support the scene behavior.
- **Unity baseline comparison:** Earlier Unity visuals show that the core visualization requirement existed before the web rebuild.

## Current Limitations
- **Not a surveyed map:** The rendered water plane is a visualization environment, not a georeferenced aerial chart.
- **Vertical exaggeration:** Probe and depth graphics may be visually scaled for clarity.
- **Environmental simplification:** Waves, current, bathymetry, shoreline, vegetation, and obstacles are not comprehensively represented.

## Next Validation Steps
- **Map overlay:** Add a georeferenced basemap or site plan where permitted and available.
- **Bathymetry integration:** Display measured bottom depth after sonar or depth-survey data become available.
- **Scale legend:** Provide explicit horizontal and vertical scale indicators.
- **Uncertainty display:** Show GPS and depth uncertainty around displayed samples.

# 11. Heat Maps and Metric Visualization

## Purpose and Boundary
Metric visualization is responsible for converting numerical sensor values into colors, points, layers, and spatial summaries. It helps identify patterns but cannot independently establish causation or sensor accuracy.

## Responsibilities
- **Metric registry:** Defines display names, units, expected ranges, and color gradients for known measurements.
- **Point coloring:** Colors individual sample points according to the selected metric.
- **Heat-map generation:** Creates smooth local color influence around recorded sample locations.
- **Layer visibility:** Allows track, point, and heat-map layers to be shown or hidden.
- **Local scaling:** Uses observed mission values to improve visual contrast while retaining metric context.

## Current Implementation
- **Known metrics:** Default supported metrics include temperature, pH, dissolved oxygen, salinity, TDS, conductivity, turbidity, light, UV, depth, speed, and battery.
- **Expected ranges:** Metric descriptors provide reference ranges used by legends and normalization.
- **Smooth heat texture:** The scene creates a canvas-based heat texture from sample positions and values.
- **Radial influence:** Each measurement affects a local area in the visualization rather than coloring only one pixel.

## Evidence Available
- **Generated graph sets:** The repository contains depth profiles, route graphs, operating graphs, and area heat maps.
- **Portfolio figures:** The existing portfolio uses graphs and heat maps as scientific communication evidence.
- **Dashboard scene:** The current web interface renders metric-colored route information.

## Current Limitations
- **Interpolation uncertainty:** Color between samples is a visualization estimate, not a direct measurement.
- **Sampling density:** Sparse samples can produce a smooth-looking map that contains limited physical evidence.
- **Range interpretation:** Automatic local contrast can exaggerate small differences if the legend is ignored.
- **Causation:** A heat map can reveal a pattern but cannot prove the source of that pattern.

## Next Validation Steps
- **Sampling-density overlay:** Show how much direct data supports each visualized region.
- **Fixed-range option:** Allow comparison using a consistent scale across repeated missions.
- **Uncertainty mask:** Reduce visual confidence farther from measured sample points.
- **Reference comparison:** Compare heat-map patterns with independent samples or reference instruments.

# 12. Joystick Input and Drive Mixing

## Purpose and Boundary
The drive-mixing module converts operator joystick intent into normalized left and right propulsion commands. It does not directly operate the ESC pins; it produces a command that later embedded controllers validate and apply.

## Responsibilities
- **Pointer input:** Converts touch or mouse position into normalized horizontal and vertical joystick values.
- **Magnitude limiting:** Limits joystick values to the available circular control area.
- **Radial deadzone:** Removes small unintended movements near the joystick center.
- **Differential mixing:** Combines forward/reverse and turning input into left and right motor commands.
- **Output limiting:** Applies a configurable maximum output before converting to ESC pulses.
- **Safety gating:** Commands neutral output when the system is not armed or when E-stop is active.

## Current Implementation
- **Neutral pulse:** The software uses 1500 microseconds as the neutral ESC command.
- **Pulse range:** The software maps normalized motor output into a 1000-to-2000-microsecond range.
- **Arcade mixing:** Left output is based on forward input plus turn input, while right output uses forward input minus turn input.
- **Normalization:** Mixed values are divided by the largest magnitude when needed so output remains within valid limits.
- **Sequence assignment:** Each generated drive command receives a sequence number.

## Evidence Available
- **Drive-math tests:** Automated tests verify deadzone, differential mixing, and ESC pulse mapping behavior.
- **Visible motor outputs:** The dashboard displays left and right requested pulse values.
- **Firmware clamping:** Both ESP32 and Arduino firmware clamp pulse values before applying or forwarding them.

## Current Limitations
- **No closed-loop speed control:** The current drive command controls requested motor output rather than measured vessel speed.
- **Motor mismatch:** Identical pulse requests may not produce identical thrust from both propulsion sides.
- **Environmental forces:** Wind and current can change vessel response without changing the joystick command.

## Next Validation Steps
- **Thrust calibration:** Measure left and right propulsion response across the pulse range.
- **Heading feedback:** Use GPS or compass feedback to evaluate straight-line tracking.
- **Rate limiting:** Evaluate controlled command ramping to reduce abrupt mechanical and electrical loads.
- **Closed-loop control:** Develop and validate heading or speed control only after reliable feedback is available.

# 13. Browser Live-Connection State

## Purpose and Boundary
The live-connection hook manages the browser's active relationship with the boat gateway. It is responsible for connection state, command transmission, status parsing, telemetry history, simulator behavior, and safe user-interface state after disconnect.

## Responsibilities
- **Connection lifecycle:** Tracks idle, connecting, connected, and error states.
- **Hello message:** Identifies the client after the WebSocket opens.
- **Status parsing:** Converts status and sensor JSON into the dashboard's typed state.
- **Telemetry age:** Calculates the age of the most recently received packet.
- **History buffer:** Retains a limited recent telemetry history for display and review.
- **Command loop:** Sends drive commands at the configured rate while live control is active.
- **Simulator path:** Supports software-only operation without real boat hardware.

## Current Implementation
- **Default endpoint:** The default access-point route is ws://192.168.4.1:81/.
- **Default send rate:** The current browser settings use a 10 Hz default command send rate.
- **Default timeout setting:** The browser exposes a three-second default timeout setting for connection-health logic.
- **UI throttling:** Status updates are queued so high-rate packets do not force unnecessary screen updates.
- **Telemetry history limit:** The current browser history retains up to 24 recent snapshots.
- **Disconnect reset:** Disconnecting resets armed state and returns displayed motor output to neutral.

## Evidence Available
- **Live-hook tests:** Application tests exercise connected controls and status-dependent interface behavior.
- **Connected dashboard capture:** Screenshots show live connection and telemetry state.
- **Status schema:** Typed status fields document the expected live information.

## Current Limitations
- **Wireless reliability:** Wi-Fi range and interference require measured field characterization.
- **Single-link dependence:** Loss of the WebSocket removes the primary operator connection.
- **Clock alignment:** Browser receipt time and embedded device time are not yet synchronized into a complete timebase.
- **Telemetry storage:** Recent in-memory history is limited and is not a complete mission log.

## Next Validation Steps
- **Range testing:** Measure packet loss, control response, and safe neutralization at increasing distances.
- **Reconnect procedure:** Test recovery after temporary link loss without unsafe output.
- **Timestamp protocol:** Add synchronized timestamps to status and sensor packets.
- **Persistent telemetry log:** Store raw incoming packets with mission records for later analysis.

# 14. WebSocket Application Protocol

## Purpose and Boundary
The WebSocket protocol defines structured messages exchanged between the operator dashboard and ESP32 gateway. It is separate from the serial bridge protocol used between embedded controllers.

## Responsibilities
- **Client identification:** The hello message identifies the operator software and version.
- **Drive command:** The drive message carries sequence, armed state, E-stop state, joystick input, and left/right pulse requests.
- **Emergency stop:** The E-stop message requests immediate safe neutralization.
- **Probe control:** The probe-control message requests raise, lower, or stop with a bounded speed.
- **Mission upload:** Begin, waypoint, commit, and abort messages support transfer of planned mission data.
- **Status response:** Status messages report applied control state, telemetry, and safety information.
- **Sensor response:** Sensor messages report probe measurements and freshness information.

## Current Implementation
- **JSON transport:** Human-readable JSON is used for browser-to-gateway messages.
- **Sequence numbers:** Commands carry sequence values that support traceability.
- **Accepted ranges:** Motor pulses and winch speeds are clamped by embedded firmware.
- **Message routing:** The ESP32 selects handlers based on the message type.
- **Mission acknowledgement:** Mission-upload messages receive acceptance and progress responses.

## Evidence Available
- **Protocol examples:** Project documentation includes example hello, drive, E-stop, and status messages.
- **Firmware handlers:** The ESP32 source contains dedicated handlers for drive, E-stop, probe, and mission-upload messages.
- **Upload tests:** Automated tests verify construction of the mission-upload message plan.

## Current Limitations
- **Authentication:** The current local protocol does not provide a comprehensive authenticated command system.
- **Schema enforcement:** Firmware uses targeted field parsing rather than a full formal JSON schema validator.
- **Version negotiation:** Client version is transmitted but full compatibility negotiation is not implemented.
- **Network exposure:** The control endpoint should not be exposed to an untrusted public network.

## Next Validation Steps
- **Protocol specification:** Document every message, required field, optional field, range, and failure response.
- **Security model:** Define pairing, authentication, and trusted-network requirements.
- **Malformed-message testing:** Systematically test truncated, duplicated, delayed, invalid, and out-of-order messages.
- **Compatibility tests:** Verify behavior when dashboard and firmware versions differ.

# 15. ESP32 Boat Network Gateway

## Purpose and Boundary
The boat ESP32 is the network gateway between the browser dashboard and lower-level vessel controls. It manages Wi-Fi, WebSocket messages, bridge commands, telemetry assembly, optional GPS and battery readings, and status broadcasting. It is not the primary probe sensor sampler and is not the preferred real-time ESC output device in the current bridge configuration.

## Responsibilities
- **Network startup:** Attempts router station mode and starts a fallback access point if the router connection fails.
- **WebSocket server:** Listens for dashboard connections on port 81.
- **Client tracking:** Tracks a limited number of socket slots and current connected-client count.
- **Command handling:** Parses drive, E-stop, probe-control, and mission-upload messages.
- **Bridge keepalive:** Periodically sends drive and probe state to the Arduino Mega bridge.
- **Telemetry assembly:** Combines bridge, GPS, battery, and sensor information into status messages.
- **Safe neutralization:** Tracks neutralization reason and count.

## Current Implementation
- **Station timeout:** Router connection is attempted for 15 seconds before fallback behavior.
- **Bridge serial:** Hardware Serial2 uses 115200 baud on configured RX and TX pins.
- **Bridge enabled:** The current configuration uses the Arduino bridge rather than direct ESP32 ESC outputs.
- **Status interval:** Status broadcasts are scheduled every 250 milliseconds.
- **Bridge keepalive interval:** Bridge commands are scheduled every 100 milliseconds.
- **GPS freshness:** GPS is considered fresh within a configured 3000-millisecond window.
- **Sensor freshness:** Probe data is considered fresh within a configured 3000-millisecond window.
- **Battery sampling:** Optional battery sampling is scheduled at one-second intervals when enabled.

## Evidence Available
- **Firmware source:** The gateway firmware documents message handlers, state fields, bridge parsing, telemetry, and network behavior.
- **Serial-monitor evidence:** Current debug captures show gateway and bridge behavior during development.
- **Connected-dashboard evidence:** The browser interface displays connection and telemetry state originating from the gateway.

## Current Limitations
- **Credential handling:** Development network credentials must not be treated as a production security design and should be changed before broader use.
- **Optional telemetry:** GPS and battery telemetry depend on installed, wired, and calibrated hardware.
- **String-based parsing:** Embedded JSON parsing is intentionally lightweight and requires careful malformed-input testing.
- **Single gateway:** The architecture currently depends on one boat ESP32 for the primary operator network connection.

## Next Validation Steps
- **Security cleanup:** Remove development credentials from distributable firmware and document secure setup.
- **Stress testing:** Measure behavior with multiple clients, rapid commands, malformed packets, and long-duration operation.
- **Telemetry validation:** Compare gateway-reported values with direct measurements and bridge output.
- **Watchdog strategy:** Document and test recovery from gateway software failure or restart.

# 16. Router Mode and Fallback Access Point

## Purpose and Boundary
The networking-mode subsystem determines how the operator device reaches the boat. Router mode and fallback access-point mode solve different field setup problems and must be documented separately from the browser interface itself.

## Responsibilities
- **Router mode:** Allows the ESP32 to join an existing local network when configured credentials and coverage are available.
- **Fallback access point:** Allows the ESP32 to create a boat-local network when router connection fails.
- **Operator route selection:** Requires the operator device to have a network route to the ESP32 before live control can work.
- **IP discovery:** Uses serial-monitor output to show the selected network mode and assigned address.

## Current Implementation
- **Connection attempt:** Station mode is attempted before the fallback access point starts.
- **Fallback purpose:** The access point supports operation without dependence on a separate router.
- **Dashboard separation:** Loading the web dashboard and connecting its WebSocket to the boat are separate network actions.

## Evidence Available
- **Firmware startup messages:** Serial output identifies router success or fallback access-point startup.
- **Dashboard host field:** The operator interface allows the boat host and port to be configured.
- **Default settings:** The default project settings use the ESP access-point address and WebSocket port.

## Current Limitations
- **Coverage variability:** Router signal strength and access-point range vary by environment and antenna placement.
- **Network switching:** Changing the operator device between networks can interrupt dashboard or boat access.
- **Security limitations:** Development access-point credentials and unencrypted WebSocket traffic are not suitable for untrusted environments.

## Next Validation Steps
- **Range comparison:** Compare reliable control range in router and access-point modes.
- **Setup guide:** Create a short operator decision tree for choosing and verifying the network mode.
- **Secure transport review:** Evaluate authentication and encrypted communication requirements for future deployment.
- **Automatic discovery:** Investigate local device discovery without relying only on a manually entered IP address.

# 17. ESP32-to-Arduino Hardware UART Bridge

## Purpose and Boundary
The hardware UART bridge carries concise control and status records between the network gateway and the Arduino Mega actuator controller. It is separate from the WebSocket JSON protocol and separate from the RS-485 probe-sensor link.

## Responsibilities
- **Drive forwarding:** Transfers sequence, armed state, E-stop state, and requested left/right pulses.
- **Winch forwarding:** Transfers probe direction and requested speed.
- **Applied-status return:** Returns the actual drive state applied by the Arduino.
- **Winch-status return:** Returns the Arduino's current winch direction and speed.
- **Probe-line forwarding:** Carries RS-485 sensor records received and forwarded by the Arduino.

## Current Implementation
- **Physical serial port:** ESP32 Serial2 connects to Arduino Mega Serial2 at 115200 baud.
- **Drive record:** D-prefixed CSV records represent drive commands.
- **Winch record:** W-prefixed CSV records represent winch commands.
- **Status record:** S-prefixed CSV records represent applied drive status.
- **Probe-status record:** P-prefixed CSV records represent applied winch status.
- **Sensor forwarding record:** R-prefixed lines carry the original probe record toward the ESP32.
- **Read budgets:** Both controllers limit bytes processed per loop to preserve responsiveness.

## Evidence Available
- **Firmware documentation:** Source comments define bridge record formats and serial assignments.
- **Serial-monitor capture:** Current evidence shows command sequence, arm state, drive output, and winch status.
- **Status display:** Returned bridge values appear in gateway status and dashboard telemetry.

## Current Limitations
- **No formal framing checksum:** Bridge CSV lines do not currently include a dedicated error-detection checksum.
- **Electrical-level requirement:** The Mega's 5-volt transmit signal requires appropriate protection before entering a 3.3-volt ESP32 input.
- **Cable and noise effects:** Internal wiring quality and motor noise can affect serial reliability.
- **Text overhead:** Human-readable CSV is easy to debug but less compact than a binary protocol.

## Next Validation Steps
- **Error counters:** Track rejected, malformed, incomplete, and timed-out bridge records.
- **Checksum evaluation:** Evaluate adding a checksum or stronger frame validation.
- **Noise testing:** Test bridge reliability while propulsion and winch motors operate under load.
- **Electrical documentation:** Document grounding, level shifting, connector pinout, and wire routing.

# 18. Arduino Mega Actuator Controller

## Purpose and Boundary
The Arduino Mega is responsible for deterministic local control of propulsion outputs, winch outputs, command timeouts, bridge parsing, and RS-485 reception. It does not provide the browser interface or primary Wi-Fi connection.

## Responsibilities
- **ESC output:** Applies left and right propulsion pulse commands.
- **Winch output:** Controls separate lower and raise outputs.
- **Local safety:** Forces propulsion neutral and winch stop after command timeout.
- **Bridge parsing:** Validates and applies D-prefixed and W-prefixed commands.
- **Status reporting:** Returns applied drive and winch state.
- **RS-485 forwarding:** Receives probe records and forwards accepted records to the ESP32.
- **Diagnostics:** Reports RS-485 byte, line, and buffer information while disarmed.

## Current Implementation
- **Left ESC pin:** The left ESC signal is attached to Arduino pin 9.
- **Right ESC pin:** The right ESC signal is attached to Arduino pin 10.
- **Winch lower pin:** The lower command uses pin 7.
- **Winch raise pin:** The raise command uses pin 6.
- **RS-485 direction pin:** The direction-control line uses pin 45.
- **Startup neutral hold:** The Arduino holds neutral for five seconds during ESC startup.
- **Command timeout:** Drive and winch commands time out after 3500 milliseconds.
- **Status interval:** Applied drive and winch status are returned every second.

## Evidence Available
- **Firmware source:** The Arduino sketch documents output pins, serial assignments, timeout logic, and record parsing.
- **Serial-monitor evidence:** Captured output shows applied drive and winch state.
- **Direct motor test sketch:** A separate Mega direct-motor test supports isolated propulsion bring-up.

## Current Limitations
- **Open-loop actuation:** The controller applies requested output but does not measure actual propeller RPM or winch position.
- **Timeout tuning:** Timeout values must balance safe stopping with tolerance for temporary communication delays.
- **Controller load:** Simultaneous serial parsing, RS-485 handling, and output control require continued long-duration testing.

## Next Validation Steps
- **Output verification:** Measure actual ESC signal pulses with an oscilloscope or logic analyzer.
- **Load testing:** Run propulsion, winch, and sensor communication together for extended periods.
- **Fault injection:** Disconnect bridge communication and confirm neutralization and winch stop.
- **State logging:** Record timeout reason, received command, and applied output during validation trials.

# 19. Propulsion ESC Signal Control

## Purpose and Boundary
The ESC signal subsystem defines how normalized propulsion requests become electrical command pulses. It is separate from mechanical propeller efficiency, motor cooling, and vessel navigation performance.

## Responsibilities
- **Neutral command:** Uses a 1500-microsecond pulse for stopped output.
- **Reverse command range:** Uses the lower portion of the accepted pulse range for reverse request.
- **Forward command range:** Uses the upper portion of the accepted pulse range for forward request.
- **Clamping:** Rejects requests outside the configured 1000-to-2000-microsecond limits.
- **Applied-state reporting:** Returns the actual clamped pulse values through status messages.

## Current Implementation
- **Servo library output:** The Arduino Mega applies ESC pulses through Servo-controlled signal pins.
- **Safe boot:** Neutral is applied before and during the startup arming delay.
- **Disarmed behavior:** Disarmed or E-stop state results in neutral output.
- **Timeout behavior:** Command timeout results in neutral output.
- **Direct ESP32 option:** The gateway firmware contains an optional direct PWM path, but the current configuration uses the Arduino bridge.

## Evidence Available
- **Motor-output telemetry:** The dashboard and serial monitor display left and right pulse requests or applied values.
- **Control tests:** Automated software tests verify pulse mapping from normalized drive commands.
- **Firmware clamps:** Both gateway and actuator firmware constrain pulse values.

## Current Limitations
- **Pulse-to-thrust uncertainty:** A pulse value is not a direct measurement of thrust, speed, or electrical load.
- **ESC calibration:** Individual ESC behavior can depend on calibration and startup sequence.
- **Reverse behavior:** Reverse response can differ from forward response and may include ESC-specific delays.

## Next Validation Steps
- **Bench characterization:** Measure motor current, RPM, and thrust across selected pulse values.
- **Matched propulsion:** Compare left and right response and compensate only after measurement.
- **Thermal monitoring:** Measure motor and ESC temperature during sustained output.
- **Emergency-stop timing:** Measure time from E-stop input to neutral signal and vessel response.

# 20. Mechanical Propulsion and Cooling

## Purpose and Boundary
The mechanical propulsion subsystem converts motor rotation into thrust while protecting internal components from water. It is separate from the electrical ESC command and from high-level navigation software.

## Responsibilities
- **Motor mounting:** Supports propulsion motors inside the vessel structure.
- **Shaft transmission:** Transfers rotation through shafts to external propellers.
- **Water exclusion:** Uses stuffing-tube and sealing methods to reduce water entry around rotating shafts.
- **Propeller alignment:** Maintains usable alignment between motor, shaft, and propeller.
- **Cooling:** Uses passive water-routing concepts to reduce heat buildup during longer operation.

## Current Implementation
- **Internal motors:** Motors remain protected inside the hull rather than being intentionally submerged.
- **Stuffing tubes:** Shafts pass through the hull using a marine-style sealed tube arrangement.
- **Marine grease:** Grease supports lubrication and contributes to water resistance around the rotating shaft.
- **Passive cooling route:** Water is routed near the motor cooling jacket without requiring an additional pump.
- **Dual propulsion:** Left and right propulsion allow differential steering.

## Evidence Available
- **Pool testing:** The propulsion system moved the loaded vessel during controlled testing.
- **Pond testing:** The system operated in a real calm-water environment.
- **Completed-refinement record:** The original portfolio documents the change from water-exposed motor assumptions to an internal motor and stuffing-tube system.

## Current Limitations
- **Efficiency measurement:** Current evidence does not fully quantify thrust, power consumption, or propulsive efficiency.
- **Seal wear:** Rotating-shaft seals and grease require inspection and maintenance.
- **Cooling validation:** The passive cooling route requires measured temperature validation during extended operation.
- **Debris exposure:** External propellers can be affected by vegetation, fishing line, and shallow-water debris.

## Next Validation Steps
- **Bollard-pull test:** Measure static thrust at controlled command levels.
- **Endurance test:** Measure motor, ESC, and battery behavior during sustained operation.
- **Leak inspection:** Inspect shaft penetrations before and after repeated propulsion runs.
- **Debris procedure:** Define inspection and safe clearing procedures for propeller obstruction.

# 21. Probe Winch Electrical Control

## Purpose and Boundary
The winch electrical-control subsystem commands probe lowering and raising. It is separate from the spool geometry used to estimate depth and separate from the probe's own sensor electronics.

## Responsibilities
- **Direction control:** Supports raise, lower, and stop states.
- **Speed control:** Accepts a bounded zero-to-255 winch speed request.
- **Local application:** The Arduino applies separate lower and raise outputs.
- **Timeout stop:** Stops the winch after loss of recent winch commands.
- **Status return:** Reports applied direction and speed through the bridge.

## Current Implementation
- **Browser command:** The operator dashboard sends a probe_control message with direction and speed.
- **Gateway translation:** The ESP32 converts the request into a W-prefixed serial bridge record.
- **Arduino output:** The Arduino clamps speed and applies one directional output at a time.
- **Stop behavior:** Stop requests and timeouts clear winch output.

## Evidence Available
- **Firmware records:** ESP32 and Arduino source contain dedicated probe and winch handlers.
- **Serial-monitor evidence:** Captured output displays winch sequence, direction, and speed.
- **Dashboard controls:** The live interface exposes probe-control actions and state.

## Current Limitations
- **No direct position feedback:** The current winch controller does not directly measure spool angle or deployed cable length.
- **No tension sensing:** The system does not currently measure tether tension or detect snagging through a dedicated sensor.
- **Open-loop speed:** Requested speed does not guarantee a measured deployment rate.

## Next Validation Steps
- **Encoder integration:** Measure spool rotation and direction with an encoder.
- **Limit detection:** Add validated upper and lower travel limits.
- **Tension monitoring:** Evaluate a load or current sensor for snag and overload detection.
- **Deployment repeatability:** Measure time, length, and depth consistency across repeated cycles.

# 22. Spool Geometry and Estimated Probe Depth

## Purpose and Boundary
The spool-depth estimator converts measured spool rotation into an estimated cable length and depth. It is a mathematical estimate and must not be described as direct pressure-based depth measurement.

## Responsibilities
- **Core-radius modeling:** Uses the spool core radius as the starting cable-wrap radius.
- **Cable-diameter modeling:** Increases effective radius as cable layers build.
- **Spool-width modeling:** Calculates approximate wraps per layer from spool width and cable diameter.
- **Layer iteration:** Accumulates cable length across completed and partial layers.
- **Depth factor:** Applies a depth factor to convert deployed cable length into estimated vertical depth.
- **Rotation conversion:** Supports conversion from degrees or encoder ticks into rotations.

## Current Implementation
- **Layer-aware length:** The algorithm does not assume every rotation releases the same cable length.
- **Geometry sanitization:** Invalid or missing geometry values are replaced with safe defaults.
- **Bounded iteration:** Layer processing uses a maximum count to avoid an uncontrolled loop.
- **Estimated result:** The output remains an estimate because cable angle and underwater motion are not directly measured.

## Evidence Available
- **Software implementation:** Both the web and Unity-era code contain spool-depth estimation logic.
- **Portfolio limitation statement:** The original portfolio correctly identifies depth measurement as a current limitation.
- **Future pressure-sensor plan:** The portfolio already proposes direct pressure-based depth measurement.

## Current Limitations
- **Changing radius uncertainty:** Real cable packing may not match ideal layer geometry.
- **Cable angle:** Current, vessel movement, and probe drag can make cable length longer than vertical depth.
- **Slack and stretch:** Slack, elasticity, and imperfect winding introduce additional error.
- **No measured rotations:** The estimator requires reliable rotation or encoder input that is not yet fully implemented in the control chain.

## Next Validation Steps
- **Known-depth test:** Compare estimated deployment against marked depths in a pool.
- **Encoder calibration:** Measure actual cable release per encoder count across layers.
- **Pressure comparison:** Compare spool estimate with a pressure-based probe sensor.
- **Error model:** Report depth error as a function of deployment length and operating condition.

# 23. Probe Mechanical Housing

## Purpose and Boundary
The probe housing protects embedded electronics while exposing sensors to the water conditions they must measure. It is separate from sensor calibration and from the winch control system.

## Responsibilities
- **Waterproof enclosure:** Protects electronics and internal connections from direct water exposure.
- **Sensor access:** Provides designed openings so sensors can contact or observe the surrounding water.
- **Tether attachment:** Transfers mechanical load and carries power and communication.
- **Internal organization:** Supports the controller, wiring, and sensor interfaces.
- **Hydrodynamic stability:** Uses shape, fins, and weight to reduce unwanted movement.

## Current Implementation
- **Printed body:** The probe body and internal support components are primarily 3D printed.
- **O-ring interfaces:** Main removable connections use compressed O-ring sealing.
- **Silicone sealing:** Selected sensor openings use sealant where permanent sealing is acceptable.
- **Stabilizing fins:** Fins help reduce uncontrolled rotation or swinging.
- **Added weight:** Internal weight helps the probe descend instead of floating near the surface.

## Evidence Available
- **Physical prototype:** The current probe is a visible integrated model.
- **Pool testing:** The probe remained sealed during controlled pool testing.
- **O-ring test:** O-ring test pieces held water for approximately 12 hours without visible leakage.
- **Completed-refinement record:** The portfolio documents waterproofing, stability, and deployment refinements.

## Current Limitations
- **Long-duration sealing:** Short tests do not establish long-term pressure, aging, or repeated-cycle reliability.
- **Printed-material porosity:** Layer lines and interfaces can permit moisture entry if sealing is incomplete.
- **Serviceability tradeoff:** Permanent sealant can make maintenance and sensor replacement more difficult.
- **Optical-window limitation:** Printed clear material diffuses light and reduces optical sensor accuracy.

## Next Validation Steps
- **Repeated immersion test:** Conduct multiple timed immersion cycles followed by internal inspection.
- **Pressure test:** Test sealing at depths exceeding expected operating depth.
- **Leak indicator:** Evaluate internal moisture detection for early warning.
- **Optical window:** Replace printed clear material with sealed acrylic or polycarbonate.

# 24. Probe Sensor ESP32

## Purpose and Boundary
The probe ESP32 is responsible for sampling local sensor channels, constructing a structured sensor record, printing diagnostic output, and transmitting the record through RS-485. It is not responsible for propulsion or browser networking.

## Responsibilities
- **Sampling schedule:** Samples the probe sensor set at a fixed interval.
- **Analog acquisition:** Reads turbidity, pH, dissolved oxygen, TDS, UV, and light analog channels.
- **Digital temperature:** Reads a DS18B20 temperature sensor when the required libraries and sensor are available.
- **Distance acquisition:** Uses ultrasonic trigger and echo timing to calculate a distance value.
- **Voltage conversion:** Converts raw ADC counts into approximate sensor voltage.
- **Sequence assignment:** Assigns a unique increasing sequence number to each sample record.
- **RS-485 transmission:** Transmits a P-prefixed CSV sensor record.

## Current Implementation
- **Sample interval:** The current probe firmware samples every 1000 milliseconds.
- **Serial and RS-485 rate:** Diagnostic serial and RS-485 communication use 19200 baud.
- **ADC reference:** Analog conversion uses a 3.3-volt reference and a 4095-count ADC maximum.
- **Temperature fallback:** If DS18B20 libraries are unavailable, the firmware reports temperature as nan rather than inventing a value.
- **Distance timeout:** Ultrasonic timing uses a 30000-microsecond timeout.
- **Transmit direction:** A control pin changes a MAX485-style module between receive and transmit states.

## Evidence Available
- **Probe firmware:** The source documents sensor pins, sampling, CSV order, and RS-485 transmission.
- **Raw and voltage fields:** Each analog channel is reported both as raw ADC count and converted voltage.
- **Sequence-based averaging:** The dashboard uses the sensor sequence to avoid averaging the same packet multiple times.

## Current Limitations
- **Calibration not embedded:** Raw voltage conversion is not the same as a validated scientific-unit calibration.
- **ADC limitations:** ESP32 ADC behavior can vary and may require calibration, attenuation configuration, and filtering.
- **Sensor interference:** Simultaneous sensors and shared power can introduce noise or interaction.
- **Timing simplicity:** One-second sampling does not automatically guarantee synchronized sensor response.

## Next Validation Steps
- **Channel calibration:** Develop a documented equation and reference procedure for every analog sensor.
- **Noise characterization:** Measure raw-value variability with motors off, motors on, winch active, and RS-485 transmitting.
- **Power validation:** Measure supply voltage and grounding at the probe under load.
- **Synchronized records:** Document sensor response time and whether all channels represent the same effective moment.

# 25. RS-485 Probe Communication

## Purpose and Boundary
The RS-485 link carries probe sensor records through the tether to the Arduino Mega. It is separate from the ESP32-to-Arduino control bridge and is intended to provide a more appropriate wired link for the probe.

## Responsibilities
- **Differential communication:** Uses an RS-485 transceiver arrangement rather than direct long-distance TTL serial.
- **Probe transmission:** The probe sends P-prefixed structured sensor lines.
- **Mega reception:** The Arduino receives data on Serial3 and forwards accepted records.
- **Direction control:** The transceiver direction pin is held in receive mode on the Mega side.
- **Line validation:** The Mega accepts P-prefixed or bare numeric sensor CSV records and ignores unrelated lines.
- **Diagnostic counting:** The Mega tracks received bytes, completed lines, buffered bytes, and accepted probe lines.

## Current Implementation
- **Baud rate:** The current probe RS-485 link uses 19200 baud.
- **Mega serial port:** Arduino Mega Serial3 receives the probe link.
- **Receive budget:** The Mega limits RS-485 bytes processed per loop.
- **Line buffer:** The Mega clears the RS-485 buffer when a record exceeds the configured maximum length.
- **Forwarding format:** Accepted probe lines are forwarded to the gateway with an R prefix.

## Evidence Available
- **RS-485 diagnostics:** When disarmed, the Mega prints recurring byte and line statistics.
- **Firmware forwarding path:** The complete probe-to-Mega-to-gateway forwarding path exists in source.
- **Dashboard sensor fields:** Forwarded sensor data appears in the typed live status and sensor interface.

## Current Limitations
- **Termination and biasing:** The current portfolio text does not fully document measured termination and bias requirements.
- **Error detection:** The text CSV record does not contain a dedicated checksum.
- **Tether validation:** Long-duration communication through the final deployed tether requires quantified testing.
- **Motor-noise exposure:** Winch and propulsion systems can introduce electrical noise that must be tested.

## Next Validation Steps
- **Cable-length test:** Measure valid packet rate across the expected tether length.
- **Noise test:** Measure communication while propulsion and winch motors operate.
- **Error-rate log:** Record dropped, malformed, overlength, and duplicated sensor lines.
- **Electrical diagram:** Document transceiver wiring, grounding, termination, shielding, and connector pinout.

# 26. Temperature Sensor Channel

## Purpose and Boundary
The temperature channel measures water temperature and provides physical context for oxygen solubility, stratification, biological activity, and other sensor readings.

## Responsibilities
- **Scientific responsibility:** The temperature channel measures water temperature and provides physical context for oxygen solubility, stratification, biological activity, and other sensor readings.
- **Scientific role:** Temperature helps interpret dissolved oxygen and identify possible thermal layering.
- **Current sensor path:** The probe firmware supports a DS18B20 digital temperature sensor on the configured temperature pin.

## Current Implementation
- **Failure representation:** Disconnected or unavailable temperature is represented as nan rather than a fabricated number.
- **MARIS use:** Temperature is included as a water feature and contributes to engineered temporal features.
- **Visualization use:** Temperature can be selected for route coloring, graphs, and heat maps.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the temperature sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The temperature sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current temperature sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The temperature sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Calibration:** Compare against a traceable reference thermometer across the expected range.
- **Response time:** Measure how quickly the sensor stabilizes after changing depth or location.
- **Depth profiles:** Pause at known depths long enough for stable comparison.
- **Uncertainty:** Report repeatability and reference difference.

# 27. Turbidity Sensor Channel

## Purpose and Boundary
The turbidity channel measures an optical response related to suspended material and water clarity. It can help reveal runoff, sediment movement, and reduced light penetration.

## Responsibilities
- **Scientific responsibility:** The turbidity channel measures an optical response related to suspended material and water clarity. It can help reveal runoff, sediment movement, and reduced light penetration.
- **Current acquisition:** The probe ESP32 reads raw analog turbidity input and converts it to voltage.
- **Data products:** Raw and voltage values can appear in telemetry, averages, mission records, and visualizations.

## Current Implementation
- **Research use:** Turbidity contributes to stormwater fingerprint and bloom-risk analysis.
- **Anomaly use:** High turbidity is included in the first-pass anomaly-label logic.
- **Interpretation caution:** Voltage or raw response is not automatically a calibrated NTU value.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the turbidity sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The turbidity sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current turbidity sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The turbidity sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Standard comparison:** Calibrate with known turbidity standards or a validated comparison instrument.
- **Container effects:** Control lighting, bubbles, sensor orientation, and container reflections during calibration.
- **Repeatability:** Measure repeated readings at each standard.
- **Field validation:** Compare spatial patterns with visible conditions and independent samples.

# 28. pH Sensor Channel

## Purpose and Boundary
The pH channel measures an electrochemical response associated with acidity or basicity. pH affects aquatic organisms and the behavior of nutrients and metals.

## Responsibilities
- **Scientific responsibility:** The pH channel measures an electrochemical response associated with acidity or basicity. pH affects aquatic organisms and the behavior of nutrients and metals.
- **Current acquisition:** The probe ESP32 reads raw analog pH input and reports approximate voltage.
- **MARIS use:** pH is a temporal water feature and contributes to bloom and anomaly labels.

## Current Implementation
- **Anomaly thresholds:** The first-pass anomaly label flags pH below 6.4 or above 9.0.
- **Interpretation caution:** Raw ADC and voltage values are not calibrated pH without buffer-based conversion.
- **Maintenance need:** pH probes require storage, conditioning, calibration, and drift monitoring.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the ph sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The ph sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current ph sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The ph sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Buffer calibration:** Use at least two appropriate pH buffers and document temperature.
- **Drift test:** Repeat buffer checks before and after missions.
- **Response test:** Measure stabilization time between solutions.
- **Field comparison:** Compare against a calibrated handheld pH instrument.

# 29. Dissolved-Oxygen Sensor Channel

## Purpose and Boundary
The dissolved-oxygen channel is central to AquaScan because low oxygen at depth can be hidden by acceptable surface conditions and can directly affect aquatic life.

## Responsibilities
- **Scientific responsibility:** The dissolved-oxygen channel is central to AquaScan because low oxygen at depth can be hidden by acceptable surface conditions and can directly affect aquatic life.
- **Current acquisition:** The probe ESP32 reads raw dissolved-oxygen analog input and reports voltage.
- **Visualization use:** Dissolved oxygen is represented in profiles, route maps, and heat maps.

## Current Implementation
- **MARIS target:** Current oxygen and future oxygen values are primary MARIS regression targets.
- **Research use:** Low oxygen and oxygen decline are used in anomaly and nighttime oxygen-trap analysis.
- **Interpretation caution:** Voltage is not a validated mg/L result without sensor-specific calibration and compensation.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the dissolved-oxygen sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The dissolved-oxygen sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current dissolved-oxygen sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The dissolved-oxygen sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Reference comparison:** Compare with a calibrated dissolved-oxygen meter.
- **Temperature compensation:** Document how temperature affects calibration and interpretation.
- **Depth profile protocol:** Allow stabilization at each known depth.
- **Low-oxygen validation:** Use safe controlled conditions or reference solutions rather than assuming natural low values.

# 30. Total Dissolved Solids Sensor Channel

## Purpose and Boundary
The TDS channel provides an indirect indication of dissolved material and helps compare water composition across locations and depths.

## Responsibilities
- **Scientific responsibility:** The TDS channel provides an indirect indication of dissolved material and helps compare water composition across locations and depths.
- **Current acquisition:** The probe ESP32 reads TDS raw ADC input and reports approximate voltage.
- **Related measurements:** TDS is interpreted alongside conductivity, salinity, pH, turbidity, and other context.

## Current Implementation
- **MARIS use:** TDS is included as a temporal feature and contributes to the first-pass bloom label.
- **Research use:** TDS can support stormwater fingerprint analysis where conductivity is unavailable.
- **Interpretation caution:** TDS estimates depend on calibration and the relationship between conductivity and dissolved composition.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the total dissolved solids sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The total dissolved solids sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current total dissolved solids sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The total dissolved solids sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Standard calibration:** Use conductivity or TDS standards appropriate to the expected range.
- **Temperature effect:** Document temperature compensation behavior.
- **Cross-sensor comparison:** Compare TDS and conductivity consistency.
- **Field samples:** Compare selected measurements with laboratory or handheld results.

# 31. Conductivity and Salinity Data Channels

## Purpose and Boundary
Conductivity and salinity help describe ionic content and can support identification of runoff, mixing, groundwater influence, or changing water composition.

## Responsibilities
- **Scientific responsibility:** Conductivity and salinity help describe ionic content and can support identification of runoff, mixing, groundwater influence, or changing water composition.
- **Mission-data support:** The software mission schema supports conductivity and salinity values.
- **Research use:** Conductivity, TDS, and salinity are used as related indicators in stormwater fingerprint analysis.

## Current Implementation
- **MARIS use:** Conductivity and salinity are included in the temporal feature set.
- **Visualization use:** Both values can be graphed and mapped when present.
- **Current hardware boundary:** The present probe telemetry source emphasizes raw/voltage channels; calibrated conductivity and salinity require complete sensor and conversion validation.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the conductivity and salinity data channels measurement or a related raw/voltage representation.
- **Visualization pathway:** The conductivity and salinity data channels value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current conductivity and salinity data channels implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The conductivity and salinity data channels response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Reference standards:** Calibrate using known conductivity standards.
- **Salinity relationship:** Document the conversion or sensor source used for salinity.
- **Temperature compensation:** Measure and document temperature influence.
- **Source classification:** Compare signatures from known water sources before classifying field patterns.

# 32. Light Sensor Channel

## Purpose and Boundary
The light channel helps evaluate light penetration and the conditions available for underwater photosynthesis and visual clarity.

## Responsibilities
- **Scientific responsibility:** The light channel helps evaluate light penetration and the conditions available for underwater photosynthesis and visual clarity.
- **Current acquisition:** The probe ESP32 reads a light analog channel and reports raw ADC and voltage.
- **Depth interpretation:** Light values can be compared across depth profiles.

## Current Implementation
- **Research use:** Low light supports nighttime classification and light-limitation analysis.
- **MARIS use:** Light is included as a temporal feature and can act as fallback context for solar radiation.
- **Known limitation:** The printed clear probe section diffuses light and reduces measurement accuracy.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the light sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The light sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current light sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The light sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Optical-window replacement:** Install a true sealed transparent window.
- **Reference comparison:** Compare against a calibrated lux sensor in controlled lighting.
- **Angular test:** Measure sensitivity to sensor orientation and shading.
- **Depth test:** Compare attenuation through known water depths and turbidity levels.

# 33. Ultraviolet Sensor Channel

## Purpose and Boundary
The ultraviolet channel explores how UV-related light changes across conditions and depths. It is an experimental measurement requiring careful optical and calibration validation.

## Responsibilities
- **Scientific responsibility:** The ultraviolet channel explores how UV-related light changes across conditions and depths. It is an experimental measurement requiring careful optical and calibration validation.
- **Current acquisition:** The probe ESP32 reads UV raw ADC input and reports approximate voltage.
- **Visualization use:** UV records can be graphed and mapped when present.

## Current Implementation
- **Research use:** UV is considered an optional feature in stormwater-fingerprint research readiness.
- **Optical limitation:** The current printed optical section reduces confidence in the reading.
- **Interpretation caution:** Raw voltage is not automatically a calibrated UV index.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the ultraviolet sensor channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The ultraviolet sensor channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current ultraviolet sensor channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The ultraviolet sensor channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **True optical window:** Replace the diffusing printed clear section.
- **Reference instrument:** Compare with a validated UV sensor under controlled conditions.
- **Spectral limitation:** Document the sensor's wavelength response and intended quantity.
- **Depth attenuation:** Measure how UV response changes with depth and turbidity.

# 34. Ultrasonic Distance Channel

## Purpose and Boundary
The ultrasonic distance channel uses trigger-and-echo timing to estimate a local distance value. Its scientific meaning depends on sensor placement and the medium through which the measurement is taken.

## Responsibilities
- **Scientific responsibility:** The ultrasonic distance channel uses trigger-and-echo timing to estimate a local distance value. Its scientific meaning depends on sensor placement and the medium through which the measurement is taken.
- **Current acquisition:** The probe firmware sends a trigger pulse and measures echo duration.
- **Distance conversion:** Echo duration is converted to centimeters using an assumed sound-speed relationship.

## Current Implementation
- **Timeout behavior:** A missing echo produces nan rather than a false distance.
- **Telemetry use:** Distance can be displayed and averaged in the dashboard.
- **Depth caution:** This channel should not be presented as validated probe depth without a demonstrated physical measurement configuration.

## Evidence Available
- **Firmware or mission field:** The current code and data structures include the ultrasonic distance channel measurement or a related raw/voltage representation.
- **Visualization pathway:** The ultrasonic distance channel value can be incorporated into telemetry, mission records, graphs, maps, or research analysis when available.

## Current Limitations
- **Calibration boundary:** The current ultrasonic distance channel implementation must not be treated as a validated scientific-unit result without the required calibration.
- **Environmental effects:** The ultrasonic distance channel response may be affected by temperature, fouling, bubbles, mounting, power quality, and response time.

## Next Validation Steps
- **Known-distance test:** Compare readings against measured targets.
- **Medium validation:** Confirm whether the selected ultrasonic hardware and calculation are appropriate for air or water operation.
- **Orientation test:** Measure the effect of angle and target surface.
- **Depth-claim separation:** Continue distinguishing distance telemetry from validated pressure-based probe depth.

# 35. GPS and Geographic Coordinate Handling

## Purpose and Boundary
The GPS and coordinate subsystem connects measurements to location and converts geographic coordinates into local positions for visualization and planning. It is separate from autonomous navigation control.

## Responsibilities
- **Live GPS telemetry:** The boat gateway can parse optional GPS data when the supported library and hardware are available.
- **Mission coordinates:** Every valid mission sample requires latitude and longitude.
- **Local projection:** Geographic coordinates are converted into local east-west and north-south offsets.
- **Reverse conversion:** Edited local positions can be converted back to geographic coordinates.
- **Route context:** Location connects sensor readings to specific areas of a water body.

## Current Implementation
- **Earth-radius approximation:** The web coordinate conversion uses an Earth radius of 6,378,137 meters.
- **Local east-west distance:** Longitude difference is scaled by cosine of the origin latitude.
- **Local north-south distance:** Latitude difference is converted to a local distance.
- **Altitude handling:** Altitude can contribute to the local vertical coordinate when available.
- **Freshness window:** Gateway GPS telemetry is treated as fresh within a configured time window.

## Evidence Available
- **Coordinate tests:** Automated tests verify projection direction and geographic round-trip behavior.
- **Route maps:** Current mission visuals show GPS-linked paths and samples.
- **Pond data:** The existing portfolio uses location-based heat maps as field evidence.

## Current Limitations
- **Accuracy not quantified:** Coordinates alone do not report GPS uncertainty or fix quality.
- **Local approximation:** The projection is appropriate for small local areas but is not a complete geographic information system.
- **Navigation separation:** Displaying a GPS route does not prove autonomous route-following accuracy.

## Next Validation Steps
- **Static-position test:** Measure coordinate variation while the vessel remains stationary.
- **Known-point comparison:** Compare against surveyed or independently measured reference points.
- **Route-repeatability test:** Compare repeated paths along the same planned mission.
- **Quality telemetry:** Add fix type, satellites, and accuracy estimates when available.

# 36. Battery Telemetry and Power-State Reporting

## Purpose and Boundary
Battery telemetry estimates electrical state for operator awareness. It is separate from the physical power distribution, fusing, battery chemistry, and validated endurance calculation.

## Responsibilities
- **Voltage sensing:** The gateway includes optional analog battery measurement support.
- **Divider scaling:** A voltage-divider factor converts sensed ADC voltage into estimated battery voltage.
- **Percent estimation:** Configured empty and full voltages are used to estimate battery percentage.
- **Status display:** Battery percentage can appear in dashboard telemetry and mission records.

## Current Implementation
- **Optional input:** Battery sensing remains disabled until the measurement circuit is wired and calibrated.
- **Configured range:** The example configuration uses 10.5 volts as empty and 12.6 volts as full.
- **Sampling interval:** Battery telemetry is updated at a configured one-second interval when enabled.
- **Bounded percentage:** The estimated result is clamped between zero and one hundred percent.

## Evidence Available
- **Dashboard field:** Battery state is included in live status and mission types.
- **Portfolio data:** Battery graphs and operating summaries exist in generated output sets.
- **Firmware implementation:** The gateway includes ADC conversion and percentage estimation logic.

## Current Limitations
- **Disabled hardware:** The current configured sense pin indicates that live battery sensing requires final wiring and calibration.
- **Voltage-only limitation:** Open-circuit or loaded voltage does not provide a perfect state-of-charge estimate.
- **No current measurement:** The current telemetry does not provide a complete power or energy measurement.
- **Load sag:** Motor load can temporarily reduce measured voltage.

## Next Validation Steps
- **Divider calibration:** Compare reported voltage against a trusted multimeter.
- **Load testing:** Record voltage under propulsion and winch loads.
- **Current sensing:** Add current measurement for power and energy analysis.
- **Endurance model:** Relate mission duration and control output to remaining battery capacity.

# 37. Telemetry Schema and Health Evaluation

## Purpose and Boundary
Telemetry schema defines the fields used to represent live vessel, actuator, sensor, location, battery, and safety state. Health evaluation determines whether the latest information is fresh enough to trust for operator awareness.

## Responsibilities
- **Drive state:** Carries connected, armed, E-stop, sequence, and applied pulse values.
- **Neutralization state:** Carries the last neutralization reason and count.
- **Probe state:** Carries raise/lower/stop direction and speed.
- **Radio state:** Carries received signal strength where available.
- **Location state:** Carries latitude, longitude, altitude, heading, and speed.
- **Sensor state:** Carries sensor freshness, sequence, raw values, voltages, and distance.
- **Timing state:** Carries browser receipt time, packet age, and last-seen time.

## Current Implementation
- **Health categories:** The dashboard distinguishes offline, connecting, fresh, stale, and error states.
- **Sensor freshness:** Gateway status marks probe data freshness according to elapsed time.
- **Packet age:** The browser periodically updates how long it has been since telemetry was received.
- **Typed fields:** TypeScript types make expected telemetry fields explicit in the dashboard code.

## Evidence Available
- **Telemetry interface:** The current UI displays control, sensor, battery, location, and connection information.
- **Status source:** Gateway firmware constructs status and sensor JSON records.
- **Automated coverage:** Tests cover sensor averaging and interface state dependent on telemetry.

## Current Limitations
- **Clock source:** Packet age is based on browser receipt timing rather than a complete synchronized embedded timestamp.
- **Optional fields:** Missing optional hardware can produce absent values that require clear operator interpretation.
- **No complete raw log:** Live status display does not by itself preserve every packet for later scientific audit.

## Next Validation Steps
- **Timestamp synchronization:** Add embedded sample and transmission timestamps.
- **Raw packet archive:** Store complete telemetry during each mission.
- **Field-quality flags:** Mark stale, missing, estimated, raw, calibrated, and invalid values explicitly.
- **Alarm thresholds:** Define and validate warnings without implying unsupported scientific conclusions.

# 38. Sensor Averaging

## Purpose and Boundary
Sensor averaging summarizes unique live sensor packets for operator review. It is not a calibration process and does not replace raw-data preservation.

## Responsibilities
- **Duplicate rejection:** Ignores a sensor packet when its sequence number matches the previously processed sequence.
- **Independent fields:** Tracks a separate sum and count for every supported sensor value.
- **Missing-value handling:** Skips a field when that value is missing or non-finite without discarding the entire packet.
- **Packet counting:** Reports the number of unique sensor packets included.
- **Reset behavior:** Can reset averages while remembering the current sequence to avoid immediate duplicate inclusion.

## Current Implementation
- **Averaged fields:** Temperature, distance, turbidity, pH, dissolved oxygen, TDS, UV, and light raw/voltage fields are supported.
- **Immutable update:** Each accepted packet produces a new accumulator state for predictable dashboard behavior.
- **Finite-number rule:** Only finite numeric values contribute to an average.

## Evidence Available
- **Dedicated tests:** Tests verify unique-sequence averaging, independent missing fields, and reset behavior.
- **Sensor dashboard:** The current interface exposes averaged sensor information.

## Current Limitations
- **Average interpretation:** A mean can hide short anomalies, drift, noise structure, and sensor response delay.
- **No uncertainty metric:** The current average does not report standard deviation, range, or confidence interval.
- **No time weighting:** Every accepted packet contributes equally regardless of timing.

## Next Validation Steps
- **Variability statistics:** Add minimum, maximum, standard deviation, and sample timing.
- **Raw-data retention:** Preserve every packet used in the displayed average.
- **Stable-window rule:** Define when an average is considered stable enough for a sampling record.
- **Outlier policy:** Document any future outlier rejection rather than silently removing data.

# 39. Mission Upload Protocol

## Purpose and Boundary
Mission upload converts a planned route into a sequence of network messages for transfer to the boat gateway. It provides a protocol foundation and does not prove autonomous execution of the uploaded route.

## Responsibilities
- **Begin message:** Declares mission identity, checksum, waypoint count, and sequence.
- **Waypoint messages:** Transfers each planned sample with location and operating fields.
- **Commit message:** Requests acceptance after all waypoints are transmitted.
- **Abort message:** Cancels an active upload with an explanatory reason.
- **Acknowledgement:** Reports whether a message was accepted.
- **Progress reporting:** Reports received and expected waypoint counts.

## Current Implementation
- **Stable mission identity:** A mission ID is derived from mission information.
- **Checksum:** The upload plan includes a mission checksum for consistency checking.
- **Sequence continuity:** Upload messages receive sequence values.
- **Gateway validation:** The ESP32 validates mission ID, waypoint index, checksum, and received count.
- **Temporary state:** The gateway tracks whether an upload is active and how many waypoints have arrived.

## Evidence Available
- **Upload-plan tests:** Automated tests verify mission-upload message construction.
- **Gateway handlers:** Firmware contains begin, waypoint, commit, and abort handling.
- **Dashboard design:** The project interface exposes mission-upload protocol concepts.

## Current Limitations
- **No execution engine claim:** Uploading a plan does not mean the boat currently executes autonomous navigation.
- **Storage behavior:** The current gateway protocol foundation does not fully document persistent onboard route storage.
- **Checksum strength:** The current checksum approach requires formal review before safety-critical use.

## Next Validation Steps
- **Transfer fault testing:** Test missing, duplicated, delayed, corrupted, and out-of-order waypoint messages.
- **Persistent storage:** Define how accepted missions survive restart and how they are selected.
- **Execution state machine:** Design and separately validate autonomous mission execution.
- **Operator confirmation:** Require explicit review before an uploaded mission can be executed.

# 40. Research-Analysis Scaffolding

## Purpose and Boundary
Research-analysis scaffolding evaluates whether a mission contains the measurements needed to investigate specific environmental hypotheses. It is separate from MARIS and separate from validated scientific conclusions.

## Responsibilities
- **Nighttime oxygen-trap hypothesis:** Explores whether repeated depth-aware missions can identify localized nighttime oxygen minima.
- **Stormwater fingerprint hypothesis:** Explores whether repeated multivariate routes can distinguish runoff-related source patterns.
- **Readiness scoring:** Calculates how many required and useful data fields are present.
- **Signal summaries:** Reports counts and heuristic indicators relevant to each research question.
- **Survey recommendations:** Lists additional mission timing, locations, and measurements required for stronger investigation.
- **AI plan:** Documents possible future analytical methods after appropriate data are available.

## Current Implementation
- **Oxygen-trap fields:** Uses dissolved oxygen and depth as primary requirements with conductivity, TDS, turbidity, light, and precipitation as useful context.
- **Stormwater fields:** Uses conductivity and turbidity as primary requirements with UV, light, temperature, oxygen, TDS, and salinity as context.
- **Readiness weighting:** Required fields receive greater weight than optional fields.
- **Heuristic phenotypes:** Current stormwater categories are exploratory signatures rather than validated source classifications.

## Evidence Available
- **Dashboard research view:** The AI/research tab presents readiness, hypotheses, signals, and recommended surveys.
- **Automated tests:** Tests verify research-readiness analysis from mission data.
- **Explicit status language:** The interface distinguishes readiness and heuristic analysis from a loaded ONNX model.

## Current Limitations
- **Hypothesis not proof:** The scaffolding proposes research questions but does not prove those phenomena occurred.
- **Heuristic thresholds:** Current signatures are exploratory and require independent labels and scientific review.
- **Data completeness:** Readiness scores evaluate available fields, not calibration quality or sampling design quality.

## Next Validation Steps
- **Protocol review:** Have domain experts review the proposed survey designs and interpretation rules.
- **Repeated-event data:** Collect multiple before, during, and after-event missions.
- **Independent samples:** Pair selected missions with grab samples or validated reference measurements.
- **Statistical plan:** Predefine analysis methods before drawing conclusions.

# 41. MARIS Data Ingestion

## Purpose and Boundary
MARIS data ingestion converts mission CSV and JSON files into model-ready mission objects. It is separate from the web dashboard parser even though both consume related mission formats.

## Responsibilities
- **File discovery:** Finds CSV and JSON files in the configured mission directory.
- **CSV parsing:** Requires timestamp, latitude, and longitude and preserves numeric metrics.
- **JSON parsing:** Reads mission name, samples, direct numeric values, and nested metrics.
- **Timestamp normalization:** Converts valid timestamps into a consistent UTC-based internal representation.
- **Metric aliasing:** Maps dissolved_oxygen into the internal do feature name.
- **Sample sorting:** Orders mission samples chronologically.

## Current Implementation
- **Mission object:** Each mission stores a name, source, and ordered sample list.
- **Sample object:** Each sample stores time, latitude, longitude, and a metric dictionary.
- **Unknown numeric fields:** Additional numeric measurements are retained.
- **Invalid-sample filtering:** Samples missing valid time or coordinates are excluded.

## Evidence Available
- **Data-loader tests:** Tests verify loading of demo CSV, pool CSV, and demo JSON missions.
- **Training artifacts:** The current model report records three real missions used by the first-pass run.

## Current Limitations
- **Limited real data:** Three real missions are not enough for broad predictive claims.
- **Data leakage risk:** Random window splitting can place related windows from the same mission in both training and evaluation sets.
- **Metadata limits:** Current mission data do not fully encode calibration quality, site conditions, or independent labels.

## Next Validation Steps
- **Mission-level split:** Hold out entire missions or sites during evaluation.
- **Provenance fields:** Store sensor version, calibration, operator, site, and weather context.
- **Quality filtering:** Define explicit rules for missing, invalid, and uncalibrated values.
- **External dataset:** Evaluate MARIS on independent data not generated by the development pipeline.

# 42. MARIS Synthetic Mission Generator

## Purpose and Boundary
The synthetic generator creates varied mission records for pipeline development and software testing. It is not a substitute for measured environmental data and should not be used to claim field accuracy.

## Responsibilities
- **Temporal generation:** Creates multi-hour missions at a fixed time step.
- **Spatial path:** Generates changing latitude, longitude, and depth patterns.
- **Daylight context:** Models a simple daylight cycle affecting light and solar radiation.
- **Weather context:** Generates wind, precipitation, and pressure variation.
- **Water relationships:** Generates simplified relationships among temperature, depth, turbidity, dissolved material, pH, light, UV, and oxygen.
- **Rare anomalies:** Occasionally injects oxygen decreases and turbidity increases.

## Current Implementation
- **Default development seed:** The generator supports deterministic output using a seed.
- **Eutrophic variation:** Some generated missions receive conditions intended to create different risk patterns.
- **Storm window:** Selected missions include a simulated precipitation period.
- **Depth profile:** Depth changes over time to exercise depth-aware features.
- **Noise:** Random variation is added to avoid perfectly deterministic sensor relationships.

## Evidence Available
- **Current artifact report:** The first-pass artifact used 12 synthetic missions.
- **Feature tests:** Synthetic missions support tests of feature shapes, resampling, and normalization.
- **Smoke training:** Synthetic data support a small end-to-end training test.

## Current Limitations
- **Designed relationships:** The generator reflects developer assumptions rather than discovered environmental truth.
- **Evaluation inflation:** Performance on synthetic-like patterns may overstate real-world model usefulness.
- **Missing complexity:** Real ecosystems contain interactions, sensor faults, and disturbances not captured by the generator.

## Next Validation Steps
- **Use restriction:** Continue labeling synthetic data as development support rather than field evidence.
- **Sensitivity review:** Measure how model results change when synthetic assumptions change.
- **Real-data priority:** Reduce dependence on synthetic records as real mission coverage improves.
- **Simulation documentation:** Document every synthetic relationship and its rationale.

# 43. MARIS Feature Engineering

## Purpose and Boundary
Feature engineering converts resampled mission records into temporal sequences and context vectors. This stage defines what information the model can use and therefore strongly affects model behavior.

## Responsibilities
- **Water features:** Uses temperature, dissolved oxygen, pH, salinity, TDS, conductivity, turbidity, light, UV, and depth.
- **Weather features:** Uses air temperature, wind speed, pressure, precipitation, and solar radiation when available.
- **Rolling features:** Calculates smoothed oxygen, temperature, and turbidity values.
- **Delta features:** Calculates changes in oxygen, temperature, and depth.
- **Stratification estimate:** Calculates an engineered stratification index from temperature and depth assumptions.
- **Depth-gradient feature:** Relates oxygen change to depth change.
- **Cyclical time:** Encodes hour and day-of-year using sine and cosine values.
- **Spatial context:** Includes latitude, longitude, and rounded grid coordinates.

## Current Implementation
- **Temporal window:** The default model window represents 60 minutes sampled in five-minute steps.
- **Window padding:** Early samples are left-padded with zeros when a full history window is unavailable.
- **Resampling:** Mission records are converted onto a five-minute step using the most recent available sample.
- **Default context:** Missing optional weather features receive fallback values.
- **Normalization:** Temporal and context features are standardized using calculated mean and standard deviation.
- **Small-variance protection:** Very small standard deviations are replaced with one to avoid unstable division.

## Evidence Available
- **Normalization artifact:** The training pipeline exports feature names and normalization values.
- **Feature tests:** Tests verify defaults, engineered fields, shapes, and finite normalized values.
- **Model input definition:** The exported model explicitly uses temporal and context inputs.

## Current Limitations
- **Fallback bias:** Default weather or missing-sensor values can create artificial patterns.
- **Zero-padding meaning:** Zero-padded normalized input may not represent a physically neutral history.
- **Engineered assumption:** The stratification calculation is an estimate, not a measured bottom-temperature profile.
- **Resampling limitation:** Carrying the most recent sample forward can hide gaps and change timing relationships.

## Next Validation Steps
- **Missingness indicators:** Add explicit flags showing which measurements are observed or imputed.
- **Gap-aware resampling:** Prevent long missing periods from appearing as continuous stable measurements.
- **Feature ablation:** Measure whether each feature group improves independent evaluation.
- **Domain review:** Review engineered features and assumptions with water-quality experts.

# 44. MARIS Model Architecture

## Purpose and Boundary
The MARIS model architecture combines a temporal sequence encoder with a context encoder and four task-specific output heads. The architecture is a first-pass development choice rather than proof that this is the best model for the problem.

## Responsibilities
- **Temporal encoder:** Processes the recent sequence of water, weather, and engineered features.
- **Context encoder:** Processes the current geographic, depth, time, and weather context.
- **Feature fusion:** Combines temporal and context embeddings.
- **Current oxygen head:** Outputs one dissolved-oxygen regression value.
- **Forecast head:** Outputs three future dissolved-oxygen values.
- **Bloom head:** Outputs a probability through a sigmoid activation.
- **Anomaly head:** Outputs a probability through a sigmoid activation.

## Current Implementation
- **First LSTM:** The first recurrent layer has 64 hidden units.
- **Second LSTM:** The second recurrent layer has 32 hidden units.
- **Context network:** The context branch maps inputs through 32 and then 16 units with ReLU activations.
- **Fusion network:** The combined representation maps through 64 and then 32 units with ReLU activations.
- **Regression outputs:** Oxygen and forecast heads use linear output layers.
- **Probability outputs:** Bloom and anomaly heads apply sigmoid activations.

## Evidence Available
- **Model source:** The PyTorch architecture is present in the repository.
- **Checkpoint artifact:** A trained PyTorch checkpoint exists.
- **ONNX artifact:** A portable exported model exists.
- **Smoke test:** Training tests verify finite outputs and artifact generation.

## Current Limitations
- **Architecture comparison:** The current model has not been shown to outperform simpler models on independent missions.
- **Dataset size:** The architecture may be too complex relative to the available real dataset.
- **Probability calibration:** Sigmoid output is not automatically a calibrated probability.
- **Interpretability:** The current architecture does not directly explain which measurements drove each output.

## Next Validation Steps
- **Baseline comparison:** Compare against persistence, linear regression, tree models, and simple threshold methods.
- **Mission-level cross-validation:** Evaluate across held-out missions or sites.
- **Calibration analysis:** Measure probability calibration for bloom and anomaly outputs.
- **Interpretability analysis:** Evaluate feature importance or sensitivity without overstating causation.

# 45. MARIS Labels and Targets

## Purpose and Boundary
Targets define what MARIS is trained to predict. Current oxygen and forecast targets come from mission values, while bloom and anomaly targets are generated from development rules. This distinction is critical to accurate interpretation.

## Responsibilities
- **Current oxygen target:** Uses the dissolved-oxygen value associated with the current resampled record.
- **Forecast targets:** Use dissolved oxygen at 30, 60, and 120 minutes after the current record.
- **Bloom label:** Uses a rule score based on temperature, solar radiation, turbidity, TDS, and pH.
- **Anomaly label:** Uses rules involving low oxygen, oxygen decline, high turbidity, and extreme pH.
- **End-of-mission forecast behavior:** Forecast indexing is capped at the last available record.

## Current Implementation
- **Bloom threshold:** The current bloom rule labels a record positive when at least three specified conditions are true.
- **Anomaly thresholds:** The current rule includes oxygen below 4.0, oxygen decline below -1.0, turbidity above 18.0, pH below 6.4, or pH above 9.0.
- **Forecast horizons:** The current model uses 30-, 60-, and 120-minute horizons.
- **Development labels:** Bloom and anomaly labels are proxies used for pipeline development.

## Evidence Available
- **Feature source:** Target construction is visible in the feature-engineering source.
- **Metrics report:** The artifact report includes bloom and anomaly accuracy.
- **Prediction sample:** The exported prediction sample shows current and forecast outputs with risk probabilities.

## Current Limitations
- **Proxy-label limitation:** Rule-generated labels do not prove real bloom presence or scientifically validated anomaly status.
- **Forecast boundary bias:** Capping future targets at the final record can create repeated end-of-mission targets.
- **Class balance:** Accuracy can be misleading when positive and negative labels are imbalanced.

## Next Validation Steps
- **Independent labels:** Use laboratory results, expert review, and validated event observations.
- **Boundary handling:** Exclude windows without complete future target horizons or explicitly mark them.
- **Class metrics:** Report precision, recall, F1, confusion matrices, and class counts.
- **Threshold review:** Treat current thresholds as hypotheses requiring scientific justification.

# 46. MARIS Training and Internal Evaluation

## Purpose and Boundary
The training module optimizes all four MARIS tasks and reports preliminary internal metrics. It demonstrates that the pipeline functions end to end but does not establish external scientific validity.

## Responsibilities
- **Reproducibility:** Sets NumPy and PyTorch random seeds.
- **Dataset construction:** Combines discovered real missions with generated synthetic missions.
- **Normalization export:** Saves feature statistics for later input preparation.
- **Train/evaluation split:** Randomly shuffles model windows into an 80/20 split.
- **Optimization:** Uses the Adam optimizer.
- **Multi-task loss:** Combines oxygen MSE, forecast MSE, bloom binary cross-entropy, and anomaly binary cross-entropy.
- **Evaluation:** Calculates regression RMSE and binary accuracy.

## Current Implementation
- **Current report data:** The current artifact reports 1,158 total windows and 232 evaluation windows.
- **Current real missions:** The report identifies three real missions.
- **Current synthetic missions:** The report identifies twelve synthetic missions.
- **Oxygen RMSE:** The current artifact reports approximately 1.92 mg/L.
- **Forecast RMSE:** The current artifact reports approximately 2.08 mg/L.
- **Bloom accuracy:** The current artifact reports approximately 59.5 percent.
- **Anomaly accuracy:** The current artifact reports approximately 93.5 percent.

## Evidence Available
- **Metrics artifact:** Evaluation and export results are stored in metrics.json.
- **Prediction artifact:** A sample CSV contains actual oxygen and model outputs.
- **Training smoke test:** An automated test verifies finite outputs and expected artifacts.
- **ML suite:** Seven ML tests passed on June 14, 2026.

## Current Limitations
- **Window-level leakage risk:** Related windows from one mission can appear in both training and evaluation groups.
- **Synthetic dominance:** Synthetic missions outnumber real missions in the current report.
- **Limited metrics:** Accuracy alone is insufficient for imbalanced classification.
- **No external test:** The report does not yet include a genuinely independent field test set.

## Next Validation Steps
- **Group split:** Split by mission, water body, or collection event.
- **External test set:** Reserve independent real-world missions for final evaluation.
- **Confidence intervals:** Report uncertainty across repeated training and evaluation runs.
- **Baseline table:** Compare every task against simple and interpretable baselines.

# 47. MARIS ONNX Export and Runtime Integration

## Purpose and Boundary
ONNX export makes the MARIS calculation portable to compatible runtimes. Export validation proves computational consistency between formats, not environmental prediction accuracy.

## Responsibilities
- **Wrapper output:** The export wrapper returns oxygen, forecast, bloom, and anomaly tensors in a fixed order.
- **Input naming:** The exported graph names temporal and context inputs.
- **Output naming:** The exported graph names oxygen, forecast, bloom, and anomaly outputs.
- **Dynamic batch:** The batch dimension is exported as dynamic.
- **Numerical comparison:** ONNX Runtime output is compared with PyTorch output.

## Current Implementation
- **ONNX opset:** The current export uses opset version 17.
- **CPU runtime validation:** The validation uses the CPU execution provider.
- **Validation rule:** The export is considered validated when maximum absolute difference is below 0.0001.
- **Current difference:** The current report records a maximum absolute difference of approximately 0.00000095.
- **Web runtime dependency:** The dashboard includes ONNX Runtime Web and model-loading scaffolding.

## Evidence Available
- **Exported artifact:** aquascan_multitask.onnx exists in the artifact directory.
- **Metrics record:** The report records successful export and validation.
- **Research-model loader:** The web application can parse metadata and load enabled ONNX research models.

## Current Limitations
- **Primary-model integration incomplete:** The current primary dashboard prediction display still uses a clearly labeled heuristic fallback.
- **Input-construction requirement:** Live MARIS use requires correct temporal windows, context features, and normalization.
- **Model availability:** Research model metadata currently contains disabled stub definitions rather than enabled validated research models.

## Next Validation Steps
- **Integration test:** Feed known evaluation samples through browser ONNX Runtime and compare outputs.
- **Input parity:** Verify feature order, normalization, padding, and missing values exactly match training.
- **Performance test:** Measure load time, memory use, and inference time on intended field devices.
- **Deployment gate:** Enable live model output only after independent validation and clear operator labeling.

# 48. Heuristic Predictive Fallback

## Purpose and Boundary
The heuristic fallback provides transparent development outputs when validated ONNX inference is unavailable. It is separate from MARIS and must not be presented as machine-learning model inference.

## Responsibilities
- **Current oxygen:** Uses the measured or mission dissolved-oxygen value.
- **Forecast heuristic:** Adjusts future oxygen according to temperature, depth, precipitation, recent oxygen trend, wind, and estimated stratification.
- **Bloom heuristic:** Combines normalized temperature, light or solar, turbidity, TDS, and pH indicators.
- **Anomaly heuristic:** Uses low oxygen, oxygen decline, turbidity, temperature change, and extreme pH.
- **Visible labeling:** Returns the backend name Heuristic fallback and status Fallback predictor active.

## Current Implementation
- **Cross-platform continuity:** Similar deterministic logic exists in the web and Unity-era inference adapter.
- **No hidden model claim:** The interface exposes the fallback backend instead of calling it validated MARIS output.
- **Immediate development feedback:** The fallback allows predictive interface design before complete model integration.

## Evidence Available
- **Source implementation:** The web domain contains the fallback prediction calculation.
- **Dashboard capture:** The current AI view visibly labels heuristic fallback.
- **Automated test:** Mission-loading tests verify that playback can produce fallback prediction output.

## Current Limitations
- **Not scientifically validated:** The weights and thresholds are development heuristics.
- **Not MARIS:** Fallback values do not come from the exported multi-task model.
- **False precision:** Numerical output may appear precise despite simplified assumptions.

## Next Validation Steps
- **Label preservation:** Keep backend and validation status visible in every output.
- **Baseline use:** Use the heuristic as a comparison baseline during MARIS evaluation.
- **Uncertainty language:** Avoid treating the forecast as a dependable field prediction.
- **Removal decision:** Retain, revise, or remove the fallback based on validated user needs.

# 49. Automated Web Verification

## Purpose and Boundary
Automated web verification checks deterministic software behavior. It does not validate physical vessel performance, sensor accuracy, or environmental conclusions.

## Responsibilities
- **Application behavior:** Tests mission loading, tab switching, planner tools, playback controls, themes, saved projects, preflight, simulator controls, research analysis, and drive modes.
- **Data parsing:** Tests CSV and JSON loading and invalid-header rejection.
- **Coordinate math:** Tests local projection direction and reverse conversion.
- **Control math:** Tests drive mixing and ESC mapping.
- **Planning math:** Tests waypoint editing, validation, route summary, and export.
- **Research support:** Tests phenomenon readiness, ONNX metadata parsing, and feature-vector order.
- **Sensor averaging:** Tests unique packet handling, missing values, and reset behavior.

## Current Implementation
- **Test runner:** The web application uses Vitest.
- **UI testing:** React Testing Library exercises visible application behavior.
- **Current total:** Twenty-six web tests passed on June 14, 2026.
- **Build check:** TypeScript compilation and Vite production bundling completed.
- **Lint check:** ESLint completed without errors.

## Evidence Available
- **Test output:** The current verification run reports three passing web test files and twenty-six passing tests.
- **Build output:** The production build transformed and emitted the application assets.
- **Source tests:** Test files document the expected software behavior.

## Current Limitations
- **Hardware gap:** Software tests do not prove that motors, sensors, GPS, or radio links work physically.
- **Browser coverage:** Automated tests do not yet represent every intended browser and device.
- **End-to-end gap:** The current suite does not fully automate browser-to-boat-to-probe validation.

## Next Validation Steps
- **Hardware-in-loop tests:** Test commands through actual controllers with motors safely disconnected or instrumented.
- **Browser matrix:** Run key workflows across intended devices.
- **Failure simulation:** Automate stale telemetry, malformed packets, disconnect, E-stop, and sensor-loss scenarios.
- **Regression archive:** Store test results with each Nationals release candidate.

# 50. Automated MARIS Verification

## Purpose and Boundary
Automated MARIS verification checks data loading, feature construction, normalization, training execution, finite outputs, and artifact creation. It does not validate environmental accuracy.

## Responsibilities
- **Data tests:** Verify demo CSV, pool CSV, and demo JSON mission loading.
- **Feature tests:** Verify feature defaults, temporal/context shapes, resampling fields, and finite normalization.
- **Smoke training:** Runs a small training job and checks that expected artifacts and finite metrics are produced.
- **Checkpoint check:** Confirms that the saved PyTorch checkpoint contains model state.
- **Prediction check:** Confirms that a prediction sample is created.

## Current Implementation
- **Test framework:** The ML pipeline uses pytest.
- **Current total:** Seven ML tests passed on June 14, 2026.
- **Reduced smoke configuration:** The smoke test uses a small synthetic set and skips ONNX export for speed.
- **Finite-value requirement:** Model outputs are asserted to contain finite values during evaluation.

## Evidence Available
- **Test output:** The current verification run reports seven passing tests.
- **Artifacts:** The repository contains checkpoint, ONNX, normalization, metrics, and prediction sample outputs.
- **ONNX validation:** The full artifact report records successful numerical export validation.

## Current Limitations
- **Scientific gap:** Passing tests only prove expected software behavior.
- **Coverage gap:** Tests do not establish performance across independent real water bodies.
- **Robustness gap:** The current tests do not comprehensively cover corrupted data, extreme missingness, or model-distribution shift.

## Next Validation Steps
- **Data-quality tests:** Add explicit tests for missing, duplicated, out-of-order, and physically impossible records.
- **Mission-split tests:** Automate evaluation with held-out missions.
- **Baseline tests:** Assert that MARIS is compared with simpler methods.
- **Runtime parity tests:** Compare PyTorch, desktop ONNX, and browser ONNX results.

# 51. Physical Testing Evidence Boundary

## Purpose and Boundary
Physical testing demonstrates that AquaScan can function as an integrated prototype. It must be distinguished from software unit tests and from complete scientific validation.

## Responsibilities
- **Flotation testing:** Assesses whether the loaded vessel remains afloat and reasonably balanced.
- **Pool testing:** Provides a controlled environment for propulsion, waterproofing, probe deployment, and live output checks.
- **Pond testing:** Provides a real calm-water environment with natural spatial and depth variation.
- **Seal testing:** Assesses water resistance of O-ring and probe interfaces.
- **Data-output testing:** Confirms that collected records can produce graphs, maps, heat maps, and profiles.

## Current Implementation
- **Loaded waterline:** The original portfolio reports a loaded waterline of approximately 3.5 inches on a 7-inch pontoon height.
- **O-ring duration:** The original portfolio reports approximately 12 hours without visible leakage for O-ring test pieces.
- **Pool result:** The vessel floated, moved, and deployed the probe in controlled water.
- **Pond result:** The system collected varying measurements across locations and depths.

## Evidence Available
- **Portfolio narrative:** The existing testing and evaluation pages document pool and pond activity.
- **Graphs and heat maps:** Generated figures show depth and location-based variation.
- **Prototype photographs:** The vessel, probe, and display provide physical evidence.

## Current Limitations
- **Limited quantitative targets:** Many physical results are descriptive rather than compared against predefined pass/fail requirements.
- **Reference accuracy:** Sensor outputs require stronger comparison with known standards.
- **Repeatability:** A small number of trials does not establish long-term reliability.

## Next Validation Steps
- **Requirements matrix:** Define target, method, measured result, uncertainty, and pass/fail for every critical requirement.
- **Repeated trials:** Repeat propulsion, deployment, waterproofing, and sampling tests.
- **Controlled comparisons:** Compare measurements against reference instruments and known depths.
- **Failure log:** Record every failed trial and the resulting refinement.

# 52. Calibration and Measurement Quality

## Purpose and Boundary
Calibration and measurement quality determine whether sensor values support scientific conclusions. This subsystem is conceptually separate from collecting, transmitting, displaying, or modeling a value.

## Responsibilities
- **Calibration reference:** Each sensor requires comparison against known standards or a validated reference instrument.
- **Repeatability:** Repeated measurements under the same condition must be characterized.
- **Response time:** The time required for a stable reading must be measured.
- **Drift:** Sensor response before and after a mission must be compared.
- **Uncertainty:** Reported results should include expected error or variability.
- **Quality flags:** Records should indicate raw, calibrated, estimated, missing, stale, or rejected status.

## Current Implementation
- **Current raw telemetry:** The probe provides raw ADC and voltage evidence useful for calibration development.
- **Current limitation language:** The portfolio acknowledges sensor accuracy and optical-window limitations.
- **Structured records:** Mission formats can carry calibrated values after conversion procedures are established.

## Evidence Available
- **Raw and voltage fields:** Current telemetry preserves useful evidence for later calibration work.
- **Graphs:** Generated outputs can support calibration curves and repeatability plots.
- **Reference plan:** The Nationals critique and current limitations identify calibration as a priority.

## Current Limitations
- **Incomplete calibration:** Current data should not be presented as fully validated scientific-unit measurements for every channel.
- **Sensor-specific needs:** Different sensors require different standards, maintenance, and compensation.
- **Environmental interactions:** Temperature, fouling, bubbles, flow, light, and electrical noise can change readings.

## Next Validation Steps
- **Calibration protocol:** Write a repeatable procedure for each sensor.
- **Before/after checks:** Record reference checks before and after every field mission.
- **Uncertainty table:** Report reference difference, repeatability, range, and response time.
- **Calibration metadata:** Store calibration date, equation, reference, and operator with mission data.

# 53. Safety Case

## Purpose and Boundary
The safety case documents how AquaScan reduces risk during setup, testing, operation, recovery, and troubleshooting. Safety is not one button; it is a combination of mechanical, electrical, software, and operating controls.

## Responsibilities
- **Disarmed startup:** The control chain starts without active propulsion.
- **Neutral ESC output:** Neutral pulses are applied during startup and unsafe states.
- **Command timeout:** Embedded controllers stop propulsion and winch output when commands become stale.
- **Latched E-stop:** The operator can request and observe emergency-stop state.
- **Joystick release:** Returning the joystick toward center requests neutral output.
- **Preflight state:** The dashboard identifies unsafe armed or E-stop conditions during preparation.
- **Debug visibility:** Status output supports confirmation of applied control state.

## Current Implementation
- **Two-level timeout behavior:** Gateway and Arduino timeouts provide local response to communication loss.
- **Pulse clamping:** Requested ESC pulses remain inside configured bounds.
- **Winch clamping:** Requested winch speed remains inside zero-to-255 bounds.
- **Physical test precautions:** Motors can be disconnected for initial pulse and communication verification.

## Evidence Available
- **Firmware logic:** Safety conditions are implemented in the gateway and actuator-controller source.
- **Dashboard controls:** Arm, disarm, E-stop, connection, and motor-output state are visible.
- **Serial evidence:** Applied state can be inspected through debug output.

## Current Limitations
- **No complete hazard analysis:** A formal hazard-and-risk table is not yet included.
- **Mechanical hazards:** Propellers, winch, tether, battery, and moving parts require physical procedures beyond software.
- **E-stop link dependence:** A network E-stop command depends on the communication path; local timeout is the independent fallback.

## Next Validation Steps
- **Hazard analysis:** Document hazard, cause, consequence, prevention, detection, and response.
- **Measured stop time:** Measure command-to-neutral and vessel stopping behavior.
- **Physical emergency procedure:** Define safe power isolation and recovery steps.
- **Operator checklist:** Require a documented preflight, launch, recovery, and shutdown procedure.

# 54. Cybersecurity and Configuration Boundaries

## Purpose and Boundary
Cybersecurity defines who can connect to and command the system and how sensitive configuration is protected. The current prototype is intended for controlled local development, not exposure to untrusted networks.

## Responsibilities
- **Trusted-network assumption:** Current operation assumes a controlled local network or boat access point.
- **Configuration separation:** Network settings and live host settings are configuration concerns rather than scientific data.
- **Command authority:** Only authorized operators should be able to arm or command the vessel.
- **Data privacy:** Mission data can include precise location and should be handled intentionally.

## Current Implementation
- **Local WebSocket:** The current gateway uses local WebSocket communication.
- **Fallback access point:** The boat can create a local network for field access.
- **Configurable endpoint:** The dashboard allows host and port configuration.
- **Project storage:** Project files preserve live settings for repeatable setup.

## Evidence Available
- **Visible configuration:** Dashboard settings and firmware constants make the current configuration inspectable.
- **Development context:** The system is used as a prototype in controlled environments.

## Current Limitations
- **Development credentials:** Hard-coded or shared development credentials must not be treated as a secure deployment design.
- **No command authentication:** The current prototype does not implement a comprehensive authenticated command protocol.
- **Unencrypted transport:** Local WebSocket traffic is not encrypted.
- **Configuration leakage:** Repository and portfolio materials must not expose real private credentials.

## Next Validation Steps
- **Credential removal:** Use placeholder or provisioned credentials in distributable firmware.
- **Pairing procedure:** Define how an operator device becomes authorized.
- **Authenticated commands:** Evaluate message authentication for future deployments.
- **Security documentation:** State the trusted-environment requirement and prohibited network exposure.

# 55. Requirements and Validation Matrix Framework

## Purpose and Boundary
A requirements matrix connects each design claim to a measurable target, test method, evidence source, result, and current status. It is the central structure for converting a narrative prototype into judge-scannable engineering proof.

## Responsibilities
- **Requirement definition:** States what the system must do and under what conditions.
- **Target:** Defines the measurable value or pass condition before testing.
- **Method:** Defines equipment, setup, repetitions, and procedure.
- **Evidence:** Identifies the graph, photograph, log, code result, or measurement supporting the result.
- **Result:** Reports the measured value without hiding failure.
- **Status:** Marks pass, partial, fail, or not yet tested.
- **Refinement link:** Connects failed or partial results to the next design change.

## Current Implementation
- **Current evidence sources:** Portfolio pages, graphs, heat maps, photographs, firmware logs, dashboard screenshots, automated test output, and MARIS artifacts are available.
- **Distinct validation types:** Physical testing, software verification, model evaluation, and scientific calibration are treated separately.
- **Limitation visibility:** Unvalidated claims are explicitly identified as future development.

## Evidence Available
- **Existing testing narrative:** The States portfolio documents pool and pond testing.
- **Post-States verification:** Current software and ML checks provide exact passing totals.
- **Iteration pages:** The updated portfolio contains problem-change-evidence-impact summaries.

## Current Limitations
- **Missing targets:** Several existing physical claims lack a predefined numeric target.
- **Mixed evidence strength:** A screenshot, unit test, field measurement, and scientific calibration do not provide the same kind of proof.
- **Incomplete retesting:** Some refinements require a documented before-and-after comparison.

## Next Validation Steps
- **Build matrix:** Create one row for every critical requirement and claim.
- **Prioritize claims:** Test depth accuracy, sensor calibration, control safety, deployment reliability, range, and endurance first.
- **Attach evidence IDs:** Number figures, logs, and test records so every result can be located quickly.
- **Update after failure:** Treat failed tests as evidence that defines the next iteration.

# 56. Final Technical Position
AquaScan should be presented as a working integrated prototype and an evolving scientific-discovery platform. Its strongest evidence is the combination of a physical vessel, a deployable sensor probe, location- and depth-aware data organization, field testing, a browser-based control and visualization system, an embedded communications chain, structured mission records, and an experimental predictive-analysis pipeline.
The Nationals update is strongest when each subsystem is explained independently. The web dashboard should be evaluated as an operator and data-visualization system. The ESP32 gateway should be evaluated as a network and telemetry bridge. The Arduino Mega should be evaluated as a local actuator and RS-485 controller. The probe should be evaluated as a waterproof sensor platform. MARIS should be evaluated as an implemented but not yet field-validated predictive proof of concept.
This subsystem separation makes the engineering process easier to defend. It prevents one successful software test from being mistaken for physical validation, prevents one field test from being mistaken for scientific calibration, and prevents a successful model export from being mistaken for validated environmental prediction.
