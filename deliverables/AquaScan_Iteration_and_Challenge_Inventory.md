# AquaScan Iteration and Challenge Inventory

## Purpose and Evidence Boundary

This is an evidence-backed inventory of AquaScan's development iterations, refinements, failures, limitations, and remaining challenges. It is intended as a material bank for the portfolio, presentation, interview answers, captions, engineering notebook entries, and judge questions.

The inventory is based on:

- The dated work log in `EngineeringDesignAQUASCAN/_analysis_outputs/portfolio_pages_text/page-31.txt` through `page-35.txt`
- The original portfolio's "Completed Refinements and Issues" section in `page-28.txt` and `page-29.txt`
- The detailed Nationals update in `deliverables/aquascan-nationals-update/AquaScan_Nationals_Master_Detailed_Text.md`
- Git history from December 22, 2025 through June 7, 2026
- Current uncommitted development work inspected on June 14, 2026
- Web runtime logs and MARIS evaluation artifacts

"Every single" is limited to what is recorded in these project artifacts. Some day-to-day physical build changes may not have been documented separately.

---

# 1. Full Dated Engineering Iteration Timeline

## Concept Selection and Problem Definition

1. **December 8, 2025 - Reviewed the theme and brainstormed directions.** The team explored possible tools for scientific discovery rather than starting with a predetermined product.
2. **December 12, 2025 - Researched scientific-discovery tools.** Sensors, field instruments, mapping systems, and data-collection tools were compared.
3. **December 18, 2025 - Selected water-quality monitoring.** The team chose an environmental problem that connected engineering, scientific measurement, and practical field use.
4. **January 3, 2026 - Researched current monitoring methods.** Manual sampling, buoys, drones, and surface vessels were compared.
5. **January 7, 2026 - Identified monitoring gaps.** The team focused on missing depth information, limited spatial coverage, and field-usability problems.
6. **January 11, 2026 - Brainstormed possible solutions.** The team developed buoy-network, drone-monitoring, and unmanned-surface-vessel concepts.
7. **January 16, 2026 - Compared solution strengths and weaknesses.** A mobile vessel with a deployable probe was selected because it combined spatial coverage with depth-aware sampling.
8. **January 22, 2026 - Finalized the AquaScan concept.** The selected concept became a dual-pontoon vessel carrying a depth-deployable multi-sensor probe.

## Architecture and Early CAD

9. **January 28, 2026 - Researched sensors.** Dissolved oxygen, turbidity, TDS, pH, temperature, light, UV, and distance sensors were investigated.
10. **February 2, 2026 - Planned system architecture.** The project was divided into vessel structure, propulsion, electronics, probe, and software subsystems.
11. **February 6, 2026 - Began vessel CAD.** The first dual-pontoon hull and electronics-tray layout was created.
12. **February 9, 2026 - Began probe CAD.** Sensor openings, internal supports, waterproof housing, and tether connection were planned.
13. **February 12, 2026 - Began deployment-system design.** The team planned the high-torque motor, spool, tether path, and vertical deployment layout.
14. **February 15, 2026 - Began electronics planning.** Arduino Mega, ESP32 communication, ESCs, power routing, and sensor integration were mapped.
15. **February 19, 2026 - Researched waterproofing.** PETG sealing, epoxy, O-rings, silicone, and JB Weld were compared.
16. **February 23, 2026 - Refined pontoon geometry and center tray.** Hull proportions changed to improve stability, payload support, and battery placement.
17. **February 27, 2026 - Refined probe housing and sensor placement.** Sensor openings and the clear light/UV cap arrangement were revised.
18. **March 2, 2026 - Refined spool and winch design.** Spool length, motor mounting, and tether payout were adjusted.
19. **March 5, 2026 - Selected propulsion components.** Motors, ESCs, propellers, shafts, and stuffing tubes were researched and selected.
20. **March 8, 2026 - Planned wiring and communications.** Battery, fuses, controllers, ESCs, sensors, and tether connections were mapped.
21. **March 11, 2026 - Continued portfolio research.** The problem definition, research, and possible-solution evidence were organized.
22. **March 13, 2026 - Prepared outreach and pitch material.** The project purpose, value, and funding needs were translated for an external audience.
23. **March 16, 2026 - Finalized major CAD dimensions.** Fit between the hull, probe, winch, and electronics tray was checked.
24. **March 18, 2026 - Presented the project direction to MI Technical Solutions.** The team discussed technical value, mentorship, and support.
25. **March 20, 2026 - Updated the design after feasibility review.** Scope, sensors, build plan, and competition timeline were rechecked.

## Fabrication and Integration

26. **March 23, 2026 - Prepared files for 3D printing.** Hull, probe, tray, and deployment components were exported.
27. **March 25, 2026 - Began printing vessel components.** Pontoon and tray fabrication started.
28. **March 27, 2026 - Began printing probe components.** Probe shell, internal tray, fins, and sensor interfaces were fabricated.
29. **March 29, 2026 - Began electronics bench setup.** Microcontrollers, communication, and early wiring were tested outside the vessel.
30. **April 1, 2026 - Printed and checked deployment components.** Spool size, motor-mount fit, and cable path were tested.
31. **April 3, 2026 - Assembled pontoon sections.** Printed sections were joined and alignment was checked.
32. **April 5, 2026 - Installed structural reinforcement.** Tray supports and carbon-fiber-rod placement were checked.
33. **April 6, 2026 - Assembled probe housing.** The internal tray and sensor openings were checked.
34. **April 7, 2026 - Built wiring harness and power routing.** Battery output, fuses, ESC wiring, and controller connections were organized.
35. **April 8, 2026 - Installed motors and shaft hardware.** Motors, shafts, stuffing tubes, and propeller alignment were fitted.
36. **April 9, 2026 - Added hull-seam waterproofing.** Sealing methods and epoxy preparation were applied.
37. **April 10, 2026 - Developed the Unity control interface.** Manual control, communication, and motor-output logic were implemented.
38. **April 11, 2026 - Installed probe sensors.** Sensors were mounted and their openings were sealed.
39. **April 12, 2026 - Assembled the winch and spool.** The spool, motor, worm gear, and tether path were integrated.
40. **April 13, 2026 - Integrated tether and slip-ring concept.** Power and signal routing through the rotating spool were checked.
41. **April 14, 2026 - Continued selected-solution documentation.** Structure, propulsion, deployment, probe, and software sections were written.
42. **April 15, 2026 - Completed a full-vessel assembly session.** Battery, tray, probe, winch, and major systems were installed together.
43. **April 16, 2026 - Integrated vessel electronics.** Controllers, ESCs, motors, and power were connected inside the tray.

## Test, Diagnose, Refine, and Retest

44. **April 17, 2026 - Ran initial motor and waterproofing checks.** Basic motor operation and leak risks were examined.
45. **April 18, 2026 - Prepared for pool testing.** The vessel, probe, tether, tools, and procedure were assembled for controlled testing.
46. **April 19, 2026 - Conducted the first pool test.** Flotation, motor response, waterproofing, and basic probe deployment were tested together.
47. **April 20, 2026 - Evaluated pool-test results.** The team identified sealing, balance, movement, and deployment-reliability problems.
48. **April 21, 2026 - Made mechanical refinements.** The winch, probe fit, tether routing, and hull sealing were adjusted.
49. **April 22, 2026 - Updated software and sensor output.** Control response, sensor-record format, and data output were improved.
50. **April 23, 2026 - Improved diagrams and portfolio communication.** System diagrams, captions, and solution visuals were added.
51. **April 24, 2026 - Completed final assembly and display planning.** Prototype layout, display content, and final-build checks were prepared.
52. **April 25, 2026 - Prepared for pond testing.** Battery, tools, probe, tether, and the field data-collection plan were checked.
53. **April 26, 2026 - Conducted pond testing.** AquaScan operated in a real water body and collected water-quality data.
54. **April 27, 2026 - Reviewed field data and issues.** Sensor results, movement performance, and field limitations were evaluated.
55. **April 27, 2026 - Finalized trifold and display content.** Visuals, explanations, and prototype-support material were assembled.
56. **April 28, 2026 - Completed prototype touch-ups.** Sealing checks, wiring cleanup, and display-ready assembly were completed.
57. **April 28, 2026 - Finalized portfolio formatting.** Pages, figures, captions, references, and solution sections were organized.
58. **April 29, 2026 - Added final testing evidence.** Test results, photos, and refinements were added to the portfolio and display.
59. **April 29, 2026 - Prepared the final States submission.** PDF, USB drives, display, prototype, and presentation readiness were checked.

---

# 2. Recorded Software and System Iterations

1. **December 22, 2025 - Unity/URP project baseline.** The repository began as a standard Unity 2022.3 URP project.
2. **December 23, 2025 - First AquaScan visualization system.** Mission data structures, CSV/JSON loading, playback, boat route, point cloud, heat map, and water shader were added.
3. **December 23, 2025 - Heat-map and water-visual refinement.** Mesh blending and water visuals were revised after the initial implementation.
4. **December 23, 2025 - Boat-rotation correction.** Route-renderer rotation logic was fixed after the boat orientation was found to be wrong.
5. **December 23, 2025 - Camera and visualization refinement.** An orbit camera was added and heat-map, sample-point, metric, and water behavior were revised again.
6. **April 30, 2026 - Playback-only interface became a live-control system.** Unity gained operating modes, joystick input, differential-drive mixing, ESC pulse mapping, WebSocket control, live status, E-stop behavior, expanded metrics, firmware, and control tests.
7. **May 5, 2026 - AI, depth estimation, and richer visualization.** ONNX inference support, a spool-depth estimator, a vertex-color heat-map shader, pool mission data, the MARIS training pipeline, synthetic data, and ML tests were added.
8. **May 6, 2026 - Browser dashboard created.** AquaScan was rebuilt as a React/Vite/Three.js dashboard to remove the need for Unity on the field operator device.
9. **May 8, 2026 - Unity HUD and repository cleanup pass.** Unity controls and HUD behavior were updated while large generated/dependency content was removed from version control.
10. **May 10, 2026 - ESP32/Arduino control-chain refinement.** Documentation and both primary firmware sketches were revised together.
11. **May 28, 2026 - Hardware bring-up and direct-motor-test pass.** A dedicated Mega direct-motor test appeared, and live boat, sensor, firmware, and dashboard behavior were revised.
12. **June 7, 2026 - RS-485 sensor pipeline and UI telemetry.** Probe sensor records were carried through the Arduino and ESP32 into the web dashboard.
13. **June 14, 2026 - Nationals verification and documentation pass.** The system was documented as a set of explicit subsystem boundaries, tests were expanded, and evidence/limitations were organized.
14. **June 14, 2026 - Current hardware-reliability pass.** Current work raises the ESP32-to-Mega bridge from 19,200 to 115,200 baud, separates control UART from RS-485, limits serial work per loop, recovers from lost frame boundaries, reduces debug traffic while armed, exposes neutralization reasons, starts in AP mode, defaults the dashboard to the boat AP, adds sensor averaging, and improves immediate arm-command handling.

---

# 3. Major Challenge-Response-Result Iterations

## Waterproofing the Vessel and Probe

- **Challenge:** PETG is water resistant but printed layer lines, seams, removable caps, rotating shafts, and sensor openings can still leak.
- **Response:** The team used compressed O-rings, silicone around sensor openings, epoxy resin, JB Weld, sealed interfaces, marine grease, and stuffing tubes rather than relying on printed plastic alone.
- **Evidence/result:** O-ring test pieces held water for approximately 12 hours without visible leakage, and the probe remained sealed during pool testing.
- **Remaining challenge:** Short immersion tests do not prove long-term pressure resistance, aging resistance, or repeated-cycle reliability.

## Structural Support, Payload, and Balance

- **Challenge:** The vessel needed to support a heavy battery, electronics tray, winch, probe, and propulsion hardware without flexing or becoming unbalanced.
- **Response:** Internal pontoon ribs, carbon-fiber rods, truss-style reinforcement, and deliberate heavy-component placement were added.
- **Evidence/result:** The loaded vessel floated with the waterline approximately 3.5 inches up the 7-inch pontoon height.
- **Remaining challenge:** Stability and structural behavior still need quantitative testing across different payloads, waves, and turns.

## Motor Waterproofing and Propulsion Redesign

- **Challenge:** The original concept assumed the motors could be exposed more directly to water, but research showed the selected motors were not designed for full submersion.
- **Response:** The propulsion system changed to protected internal motors driving external propellers through stuffing tubes and shafts.
- **Evidence/result:** Motors stayed inside the hull, water-entry risk was reduced, and the propulsion system operated during controlled testing.
- **Remaining challenge:** Shaft-seal wear, alignment, debris exposure, thrust, efficiency, and endurance remain insufficiently quantified.

## Motor Heat Management

- **Challenge:** Sustained motor load created a risk of overheating during longer missions.
- **Response:** A passive water-cooling route was added without adding a separate pump.
- **Evidence/result:** The design addresses heat buildup while keeping the system mechanically simple.
- **Remaining challenge:** Motor and ESC temperatures have not been fully measured during long-duration loaded operation.

## Probe Deployment, Drag, and Stability

- **Challenge:** The probe could swing, drag, float upward, tangle the tether, or fail to remain vertical.
- **Response:** Stabilizing fins, internal weight, a wider spool surface, revised tether routing, worm gearing, and probe-fit refinements were used.
- **Evidence/result:** Deployment, retrieval, and underwater stability improved after mechanical refinement.
- **Remaining challenge:** The system lacks direct position feedback, tension sensing, snag detection, and validated deployment repeatability.

## Optical Sensor Accuracy

- **Challenge:** The "clear" printed material became frosted and diffused light before it reached the light and UV sensors.
- **Response:** The team identified material transmission as the cause and proposed a smaller sealed acrylic or polycarbonate optical window.
- **Evidence/result:** The limitation is explicitly documented instead of presenting the readings as fully accurate.
- **Remaining challenge:** The optical-window redesign and calibrated comparison still need to be completed.

## Depth Measurement

- **Challenge:** Probe depth cannot be assumed to equal tether payout because spool radius changes, cable packs unevenly, cable stretches, slack develops, and current pulls the cable at an angle.
- **Response:** A layer-aware spool-depth estimator was implemented instead of assuming constant cable release per rotation.
- **Evidence/result:** The software models core radius, cable diameter, spool width, completed layers, partial layers, and a depth factor.
- **Remaining challenge:** The estimator lacks fully integrated encoder measurements and should be compared with known pool depths and a pressure sensor.

## Field Interface Accessibility

- **Challenge:** The original Unity system proved the concept but required a dedicated Unity application and created field-device setup friction.
- **Response:** The primary operator experience was rebuilt as a browser-based React/Vite application.
- **Evidence/result:** The dashboard supports mission loading, visualization, planning, project saving, direct control, status, and research views from a browser.
- **Remaining challenge:** Broader tablet/browser testing, outdoor glare testing, accessibility review, and operator-task timing are still needed.

## Communication-Chain Reliability

- **Challenge:** Operator commands, motor control, sensor telemetry, and diagnostics competed across a complex embedded communication path.
- **Response:** The architecture was separated into WebSocket, ESP32-to-Mega hardware UART, Mega-to-probe RS-485, and direct real-time actuator outputs.
- **Evidence/result:** Responsibilities and failure locations became easier to inspect; RS-485 sensor records now reach the dashboard.
- **Remaining challenge:** There is no formal UART/RS-485 checksum, motor noise may affect signals, and long-duration loaded testing is incomplete.

## Serial Congestion and Lost Frames

- **Challenge:** High-rate commands, probe records, GPS bytes, status traffic, and debug printing can delay control loops or corrupt text-frame boundaries.
- **Response:** Current firmware work raises the control bridge to 115,200 baud, applies per-loop byte budgets, treats record markers as recovery boundaries, reduces debug output while armed, and stops oversized status lines from automatically neutralizing the vessel.
- **Evidence/result:** The implementation now explicitly records the last neutralization reason and count for diagnosis.
- **Remaining challenge:** The revised firmware still requires bench and loaded-vessel stress testing.

## Network Availability

- **Challenge:** Router coverage, AP coverage, IP discovery, firewall rules, and switching between dashboard and boat networks can interrupt field control.
- **Response:** Router/fallback-AP behavior was documented, the web server was exposed on the local network, and current work defaults live settings to the boat AP route.
- **Evidence/result:** The operator can load the dashboard from another device and connect directly to the boat-local access point.
- **Remaining challenge:** Range, interference, automatic discovery, secure transport, and network-switching procedures require validation.

## Safety State and Failure Visibility

- **Challenge:** A live-control interface must fail safely when messages are malformed, stale, disconnected, or delayed.
- **Response:** The system uses disarmed startup, neutral-on-timeout, clamped ESC pulses, a latched E-stop, visible telemetry-health states, and status returned from the actuator controller.
- **Evidence/result:** Current work adds explicit neutralization-reason alerts so an operator can see why the boat stopped.
- **Remaining challenge:** A network E-stop still depends on the communication path; physical hazard analysis and measured stop timing remain incomplete.

## Sensor Data Interpretation

- **Challenge:** Raw ADC counts and voltage conversions can look scientific even when they are not calibrated environmental measurements.
- **Response:** The dashboard labels raw/voltage readings, keeps unknown numeric metrics, and current work adds per-sequence sensor averaging.
- **Evidence/result:** The interface warns the operator to calibrate before interpreting pH, DO, TDS, turbidity, UV, or light values.
- **Remaining challenge:** Every sensor needs calibration curves, standards, uncertainty, compensation, and repeatability evidence.

## Predictive Analysis and MARIS

- **Challenge:** The project wanted predictive use, but only three real missions were available.
- **Response:** MARIS was built as an explicitly experimental multi-task pipeline using real and synthetic missions, portable ONNX export, and a labeled heuristic fallback.
- **Evidence/result:** The ONNX export was validated against PyTorch within approximately 0.00000095 maximum absolute difference.
- **Remaining challenge:** Current performance is not suitable for dependable environmental forecasting, and live primary-model integration remains incomplete.

---

# 4. Comprehensive Challenge Bank

## Mechanical and Physical Challenges

1. Printed PETG can leak through layer lines and interfaces.
2. Removable probe caps need reliable compression seals.
3. Sensor openings create multiple water-entry paths.
4. Rotating propeller shafts create difficult dynamic seals.
5. Permanent sealant improves sealing but reduces serviceability.
6. Heavy batteries and winch hardware can unbalance the vessel.
7. The electronics tray and pontoon span can flex under payload.
8. Propeller and shaft alignment must be maintained after assembly.
9. External propellers are exposed to weeds, fishing line, and debris.
10. Sustained propulsion may overheat motors or ESCs.
11. Passive cooling performance has not been quantitatively validated.
12. The probe can swing, rotate, drag, or float.
13. The tether can tangle, wrap unevenly, stretch, or go slack.
14. The probe can snag without a dedicated tension sensor.
15. The winch lacks direct position and travel-limit feedback.
16. Real spool packing differs from ideal geometric layers.
17. Tether payout is not the same as vertical depth.
18. Repeated deployment cycles may wear seals and mechanisms.
19. Calm-water success does not prove operation in waves or current.
20. Long-term battery endurance and maintenance requirements remain unknown.

## Electrical, Embedded, and Communication Challenges

1. ESP32, Arduino Mega, ESCs, sensors, and motors require correct shared grounding.
2. The Mega's 5-volt TX signal must be protected before entering a 3.3-volt ESP32 RX input.
3. Motor and winch electrical noise can corrupt serial or sensor signals.
4. The control UART and RS-485 probe bus must remain separate.
5. Human-readable CSV frames are easy to debug but have overhead.
6. UART and RS-485 records do not currently include a dedicated checksum.
7. A lost newline can merge frames and cause parsing failure.
8. Oversized or malformed records need recovery without unsafe behavior.
9. Serial parsing, WebSocket processing, GPS, and actuator updates compete for loop time.
10. Excessive debug printing can reduce real-time responsiveness.
11. Timeout values must stop the boat safely without reacting to every short delay.
12. A single boat ESP32 remains a primary communication dependency.
13. Router and AP coverage vary by environment and antenna placement.
14. The operator device may lose boat access when switching networks.
15. Manual IP entry increases setup friction.
16. Development credentials and unencrypted WebSockets are not secure deployment mechanisms.
17. Embedded JSON parsing is lightweight and requires malformed-input testing.
18. Multiple clients and rapid command streams require stress testing.
19. GPS and battery fields depend on installed and calibrated hardware.
20. A complete synchronized timebase does not yet exist across browser and embedded devices.

## Control and Safety Challenges

1. Differential-drive commands request output but do not measure actual vessel speed.
2. Equal pulse commands may not produce equal thrust from both motors.
3. Reverse response may differ from forward response.
4. ESC behavior depends on calibration and startup sequence.
5. Wind and current change vessel motion without changing joystick commands.
6. Propeller RPM, thrust, current draw, and winch position are not closed-loop measurements.
7. A software preflight cannot inspect every physical fastener, seal, propeller, or battery connection.
8. GPS coordinates alone do not prove accurate position.
9. A network E-stop depends on the link being available.
10. Local timeout is the independent fallback when the network fails.
11. Physical hazards include propellers, tether, winch, battery, and moving mechanisms.
12. A formal hazard-and-risk table is still needed.
13. Emergency-stop response time has not been quantitatively measured.
14. Full autonomous route execution is not field validated.
15. Obstacle avoidance, exclusion zones, and shoreline constraints are not validated.
16. Route planning does not yet include a validated energy model.

## Sensor and Scientific Challenges

1. Raw voltage conversion is not scientific calibration.
2. pH requires standards, calibration curves, and temperature-aware validation.
3. Dissolved oxygen requires calibration and may be affected by temperature, flow, bubbles, and fouling.
4. Turbidity requires standards and is sensitive to bubbles, fouling, and optical geometry.
5. TDS and conductivity require calibration and temperature compensation.
6. Salinity derived from conductivity needs a documented method and validation.
7. Temperature sensors require response-time and reference comparison.
8. Light and UV sensors are affected by the frosted printed optical window.
9. Ultrasonic distance readings can be affected by mounting and environmental conditions.
10. ESP32 ADC behavior can vary and may need attenuation, filtering, and calibration.
11. Shared power and simultaneous sensors can create interference.
12. One-second sampling does not guarantee synchronized sensor response.
13. Sensor drift and fouling require repeated field checks.
14. Units are accepted from mission files but not independently proven.
15. Invalid, saturated, impossible, or out-of-range values need a stronger policy.
16. Mission records need calibration IDs, site context, weather, operator, and procedure metadata.
17. Sensor averages can hide spikes, drift, and noise structure.
18. Current averages do not report range, standard deviation, or confidence intervals.
19. GPS uncertainty and fix quality are not fully represented.
20. Heat-map interpolation is not a direct measurement between sample points.
21. Sparse data can produce a visually smooth but weakly supported heat map.
22. A heat map reveals patterns but cannot prove causation.
23. Vertical and horizontal visualization may be exaggerated for clarity.
24. The rendered water scene is not a surveyed georeferenced map.
25. Bathymetry, waves, current, vegetation, and obstacles are simplified or absent.
26. A small number of pool and pond trials does not establish repeatability or long-term reliability.

## Software, Data, and User-Experience Challenges

1. Unity proved the initial concept but was inconvenient as the primary field interface.
2. Browser support still needs a documented device matrix.
3. Outdoor glare and sunlight readability need testing.
4. Keyboard navigation, contrast, and assistive-technology behavior need an accessibility audit.
5. Operators still need a defined operating procedure and training.
6. The dashboard is local-field software, not a secure public internet service.
7. Mission CSV/JSON formats lack a comprehensive versioned schema.
8. Project-file migration behavior is not defined beyond version 1.
9. Project JSON is editable and does not provide cryptographic authenticity.
10. Project packages lack complete chain-of-custody and scientific provenance.
11. Interpolated playback positions can imply more precision than the records support.
12. Playback lacks a complete event log for deployment, calibration, alarms, and observations.
13. Long data gaps need visible distinction.
14. A valid route plan is not evidence that the vessel executed the route.
15. The planner lacks validated obstacle, environment, and energy constraints.
16. Preflight software can create false confidence if physical checks are omitted.
17. Recent telemetry history is not a complete permanent raw mission log.
18. Optional/missing telemetry needs clear operator interpretation.
19. The live protocol lacks comprehensive authentication and version negotiation.
20. Control endpoints should not be exposed to untrusted networks.
21. Automated tests do not prove hardware operation.
22. End-to-end browser-to-boat-to-probe automation is incomplete.
23. Current runtime logs show earlier React hook-order failures that caused application crashes during development.
24. Current runtime logs show a React Three Fiber/Performance `DataCloneError` associated with an out-of-memory condition.
25. Current runtime logs repeatedly warn that `THREE.Clock` is deprecated and should be replaced with `THREE.Timer`.
26. The Three.js boat model requires conversion tooling; a procedural fallback was needed when Blender or the GLB model was unavailable.

## MARIS and Machine-Learning Challenges

1. Only three real missions are present in the current training report.
2. Synthetic missions outnumber real missions.
3. Synthetic relationships encode developer assumptions rather than discovered environmental truth.
4. Synthetic-like evaluation can overstate real-world usefulness.
5. Random window splitting can leak related windows from one mission into both training and evaluation.
6. There is no genuinely independent held-out field-water-body test set.
7. Current mission metadata does not fully describe calibration quality or independent labels.
8. Bloom and anomaly labels are proxies generated by rules, not confirmed scientific observations.
9. Forecast targets near the end of a mission can repeat the final record.
10. Accuracy can mislead when classes are imbalanced.
11. Current model architecture has not been shown to beat simpler baselines on independent missions.
12. The model may be too complex for the amount of real data.
13. Sigmoid output is not automatically a calibrated probability.
14. The model does not directly explain which measurements drove each result.
15. Default values and missing-sensor fallbacks can create artificial patterns.
16. Zero-padded normalized history may not be physically neutral.
17. Carry-forward resampling can hide gaps and change time relationships.
18. Current oxygen RMSE is approximately 1.92 and forecast RMSE is approximately 2.08 in the saved report.
19. Current bloom accuracy is approximately 59.5 percent, which is not strong evidence for dependable bloom prediction.
20. Current anomaly accuracy is high in the internal report, but it still depends on the current data and labeling design.
21. The primary dashboard still uses a clearly labeled heuristic fallback rather than validated live MARIS inference.
22. Heuristic numerical outputs may appear more precise than their assumptions justify.
23. Live MARIS integration requires correct temporal windows, context features, normalization, metadata, and model availability.
24. Model-distribution shift, corrupted data, and extreme missingness are not comprehensively tested.

## Documentation, Evidence, and Project-Management Challenges

1. The project spans mechanics, electronics, embedded firmware, Unity, web development, data science, ML, scientific calibration, and competition documentation.
2. Changes in one subsystem can create failures in another, making integration testing essential.
3. Several physical claims are descriptive rather than tied to predefined numeric pass/fail requirements.
4. Screenshots, software tests, field measurements, and scientific calibration provide different strengths of evidence.
5. Some refinements still need documented before-and-after comparisons.
6. Competition deadlines required scope control and prioritization.
7. The team had to communicate technical work to judges, sponsors, mentors, and operators with different levels of detail.
8. The repository history includes very large generated/dependency commits, showing the challenge of source-control hygiene.
9. Several commit messages are nonspecific, reducing the usefulness of history as an engineering record.
10. The project must distinguish implemented capability from proposed, experimental, or future capability.
11. The system must avoid overstating autonomy, calibration accuracy, ML validity, or commercial readiness.
12. Field evidence is stronger than simulation, but field testing is harder to repeat and control.

---

# 5. Strong Presentation and Portfolio Story Angles

## "We Did Not Stop at a Working Prototype"

The States prototype proved the central concept, but the team treated that success as the start of engineering validation. Pool and pond testing exposed real limitations in sealing, balance, deployment, communication, field access, and scientific interpretation. Those findings drove the Nationals development cycle.

## "Testing Changed the Design"

The strongest refinement story is that testing directly caused design changes:

- Water exposure research changed the propulsion system from exposed-motor assumptions to internal motors and stuffing tubes.
- Pool testing exposed sealing, balance, movement, and deployment issues.
- Optical-sensor results exposed the frosted clear-print problem.
- Field-access limitations drove the Unity-to-browser transition.
- Communication behavior drove the separation of control UART and RS-485 sensor traffic.
- Serial reliability concerns drove baud-rate increases, frame recovery, byte budgets, reduced diagnostics, and neutralization-reason tracking.

## "The Project Became a System, Not Just a Boat"

AquaScan evolved from a physical vessel concept into an integrated system with:

- Mechanical structure and waterproofing
- Propulsion and probe deployment
- Sensor acquisition
- Embedded control and safety
- Wireless communication
- Mission data and visualization
- Field operator workflow
- Automated verification
- Experimental predictive analysis

## "We Know the Difference Between Data and Evidence"

The team can explain that:

- A sensor voltage is not automatically a calibrated measurement.
- A smooth heat map is not measurement between samples.
- A planned route is not proof of autonomous execution.
- A software test is not proof of physical performance.
- A machine-learning score is not proof of field validity.
- A successful short test is not proof of long-term reliability.

## "Remaining Limitations Are the Next Engineering Requirements"

The major future requirements are:

1. Add direct pressure-based probe-depth measurement.
2. Add encoder and tension feedback to the winch.
3. Complete sensor-by-sensor calibration and uncertainty reporting.
4. Quantify waterproofing, propulsion, cooling, battery, and communication endurance.
5. Implement and validate autonomous route execution and obstacle response.
6. Add stronger protocol framing, diagnostics, and security.
7. Expand independent real-world datasets before making predictive claims.
8. Validate the dashboard across field devices and outdoor conditions.

---

# 6. Concise Interview Answer Material

## What was the biggest mechanical challenge?

Waterproofing moving and serviceable parts. The team could not rely on printed PETG alone, especially around shafts, caps, and sensor openings. The design evolved into a multi-layer sealing strategy using O-rings, sealants, epoxy, stuffing tubes, and marine grease.

## What changed most after testing?

Pool testing exposed sealing, balance, movement, and probe-deployment issues. Those results led to winch, tether, probe-fit, and hull-sealing refinements. Continued field development then exposed software-access and communication-reliability limitations, leading to the browser dashboard and separated communication buses.

## What did not work as expected?

The clearest physical example was the printed "clear" optical section. It came out frosted and diffused light, reducing light and UV sensor accuracy. Software development also exposed boat-orientation errors, React hook-order crashes, memory-related rendering failures, and serial-frame reliability concerns.

## Why was the interface rebuilt?

Unity was valuable for proving mission playback, route visualization, heat maps, and control concepts, but it created field setup friction. Rebuilding the operator interface in a browser made the system easier to open on compatible field devices without requiring the Unity application.

## What is the most important remaining scientific limitation?

Calibration. AquaScan can acquire, transmit, organize, and visualize sensor outputs, but stronger scientific claims require sensor-specific standards, calibration curves, reference comparisons, repeatability testing, and uncertainty reporting.

## What is the most important remaining controls limitation?

The system is still primarily open loop. It requests motor and winch outputs but does not yet measure actual propeller RPM, vessel speed, spool position, cable tension, or direct probe depth.

## What is the most important remaining ML limitation?

MARIS has only three real missions and relies heavily on synthetic development data and proxy labels. It demonstrates a future direction, but it is not ready for dependable environmental forecasting.

---

# 7. Verified Current Position as of June 14, 2026

- The integrated prototype supports manual control, telemetry, mission replay, planning, project saving, visualization, probe communication, and an experimental ML/export pipeline.
- The web application has documented successful automated tests, production build, and lint checks.
- MARIS has documented automated tests and validated ONNX export.
- Pool and pond testing provide evidence that the central concept is plausible in calm, shallow, sheltered water.
- The system is not a finished commercial product.
- Full autonomous execution, direct depth measurement, extensive calibration, long-term field reliability, secure communications, and field-validated MARIS inference remain open engineering work.

